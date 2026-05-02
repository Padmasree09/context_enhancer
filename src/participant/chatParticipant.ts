import * as vscode from 'vscode';
import { IndexStore } from '../indexer/indexStore';
import { BM25Retriever } from '../retriever/bm25';
import { ScoredChunk } from '../types';

const TOP_K = 8; // Max chunks to inject
const MAX_CONTEXT_CHARS = 12000; // Don't exceed ~3K tokens of context

export function registerChatParticipant(
    context: vscode.ExtensionContext,
    indexStore: IndexStore,
    retriever: BM25Retriever
): vscode.Disposable {

    const participant = vscode.chat.createChatParticipant(
        'context-enhancer.ctx',
        async (
            request: vscode.ChatRequest,
            chatContext: vscode.ChatContext,
            stream: vscode.ChatResponseStream,
            token: vscode.CancellationToken
        ) => {
            const query = request.prompt;

            if (!query.trim()) {
                stream.markdown('Please provide a question or task.');
                return;
            }

            // 1. Retrieve relevant chunks
            const allChunks = indexStore.getAllChunks();

            if (allChunks.length === 0) {
                stream.markdown(
                    '⚠️ **No indexed files.** Run `Context Enhancer: Index Workspace` first.\n\n' +
                    'Falling back to answering without pre-retrieved context...\n\n'
                );
            }

            const scoredChunks = retriever.retrieve(query, allChunks, TOP_K);

            // 2. Build context string from top chunks (respecting token budget)
            const contextBlock = buildContextBlock(scoredChunks);

            // 3. Show user what context was injected
            if (scoredChunks.length > 0) {
                stream.markdown(`*Injected ${scoredChunks.length} relevant code chunks:*\n`);
                for (const { chunk, score } of scoredChunks) {
                    const relPath = vscode.workspace.asRelativePath(chunk.filePath);
                    stream.markdown(`- \`${relPath}\` → **${chunk.symbolName}** (score: ${score.toFixed(2)})\n`);
                }
                stream.markdown('\n---\n\n');
            }

            // 4. Call the language model with injected context
            const [model] = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4o'
            });

            if (!model) {
                stream.markdown('❌ No language model available. Make sure Copilot is active.');
                return;
            }

            const messages = [
                vscode.LanguageModelChatMessage.User(buildSystemPrompt(contextBlock)),
                vscode.LanguageModelChatMessage.User(query),
            ];

            // Include conversation history for multi-turn
            const history = chatContext.history;
            if (history.length > 0) {
                const historyMessages = history.slice(-4).map(turn => {
                    if (turn instanceof vscode.ChatResponseTurn) {
                        const parts = turn.response
                            .filter((p): p is vscode.ChatResponseMarkdownPart => p instanceof vscode.ChatResponseMarkdownPart)
                            .map(p => p.value.value)
                            .join('');
                        return vscode.LanguageModelChatMessage.Assistant(parts.slice(0, 2000));
                    }
                    return vscode.LanguageModelChatMessage.User((turn as vscode.ChatRequestTurn).prompt);
                });
                messages.splice(1, 0, ...historyMessages);
            }

            const response = await model.sendRequest(messages, {}, token);

            for await (const fragment of response.text) {
                stream.markdown(fragment);
            }
        }
    );

    participant.iconPath = new vscode.ThemeIcon('symbol-structure');

    return participant;
}

function buildSystemPrompt(contextBlock: string): string {
    if (!contextBlock) {
        return 'You are a helpful coding assistant. Answer the user\'s question.';
    }

    return `You are a helpful coding assistant with access to the user's codebase.
Below are the most relevant code chunks from their workspace, pre-retrieved using semantic analysis and BM25 ranking.
Use this context to give accurate, specific answers. Reference file paths and function names when relevant.

--- RETRIEVED CODE CONTEXT ---
${contextBlock}
--- END CONTEXT ---

Answer the user's question using the context above. If the context doesn't contain relevant information, say so and answer to the best of your ability.`;
}

function buildContextBlock(scoredChunks: ScoredChunk[]): string {
    let block = '';
    let charCount = 0;

    for (const { chunk } of scoredChunks) {
        const entry = `// File: ${chunk.filePath} | ${chunk.symbolType}: ${chunk.symbolName} (lines ${chunk.startLine}-${chunk.endLine})\n${chunk.content}\n\n`;

        if (charCount + entry.length > MAX_CONTEXT_CHARS) {
            break;
        }

        block += entry;
        charCount += entry.length;
    }

    return block;
}
