import * as vscode from 'vscode';
import { initParser, loadLanguage, parseSource } from './indexer/parser';
import { extractChunks } from './indexer/chunker';
import { IndexStore } from './indexer/indexStore';
import { BM25Retriever } from './retriever/bm25';
import { registerChatParticipant } from './participant/chatParticipant';
import { LANGUAGE_EXTENSIONS } from './types';

const indexStore = new IndexStore();
const retriever = new BM25Retriever();

let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
    console.log('[context-enhancer] Activating...');

    // Status bar indicator
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(symbol-structure) CTX: 0';
    statusBarItem.tooltip = 'Context Enhancer: indexed chunks';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Initialize tree-sitter
    try {
        await initParser(context.extensionPath);
    } catch (e) {
        console.error('[context-enhancer] Failed to init parser:', e);
        vscode.window.showErrorMessage('Context Enhancer: Failed to initialize tree-sitter parser.');
        return;
    }

    // Register Chat Participant
    const participant = registerChatParticipant(context, indexStore, retriever);
    context.subscriptions.push(participant);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('context-enhancer.indexWorkspace', () => indexWorkspace(context)),
        vscode.commands.registerCommand('context-enhancer.clearIndex', () => {
            indexStore.clear();
            updateStatusBar();
            vscode.window.showInformationMessage('Context Enhancer: Index cleared.');
        })
    );

    // File watchers — re-index on save
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx,py,rs,go,java,c,cpp,h,hpp}');
    watcher.onDidChange(uri => indexFile(uri, context));
    watcher.onDidCreate(uri => indexFile(uri, context));
    watcher.onDidDelete(uri => {
        indexStore.removeFile(uri.fsPath);
        updateStatusBar();
    });
    context.subscriptions.push(watcher);

    // Index open editors immediately
    for (const editor of vscode.window.visibleTextEditors) {
        await indexFile(editor.document.uri, context);
    }

    // Also index when a new editor opens
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor) {
                await indexFile(editor.document.uri, context);
            }
        })
    );

    console.log('[context-enhancer] Activated. Use @ctx in Copilot Chat.');
    vscode.window.showInformationMessage('Context Enhancer active. Type @ctx in Copilot Chat to use pre-retrieved context.');
}

async function indexWorkspace(context: vscode.ExtensionContext): Promise<void> {
    const extensions = Object.values(LANGUAGE_EXTENSIONS).flat();
    const globPattern = `**/*.{${extensions.join(',')}}`;

    const files = await vscode.workspace.findFiles(globPattern, '**/node_modules/**', 500);

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Context Enhancer: Indexing workspace...' },
        async (progress) => {
            let indexed = 0;
            for (const file of files) {
                await indexFile(file, context);
                indexed++;
                progress.report({ increment: (100 / files.length), message: `${indexed}/${files.length}` });
            }
        }
    );

    updateStatusBar();
    vscode.window.showInformationMessage(
        `Context Enhancer: Indexed ${indexStore.totalFiles} files, ${indexStore.totalChunks} chunks.`
    );
}

async function indexFile(uri: vscode.Uri, context: vscode.ExtensionContext): Promise<void> {
    const language = getLanguageFromUri(uri);
    if (!language) {return;}

    const lang = await loadLanguage(language, context.extensionPath);
    if (!lang) {return;}

    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const sourceCode = doc.getText();

        const tree = parseSource(sourceCode, lang);
        if (!tree) {return;}

        const chunks = extractChunks(tree, sourceCode, uri.fsPath, language);
        indexStore.setFileChunks(uri.fsPath, chunks);
        updateStatusBar();
    } catch (e) {
        // Silently skip files that can't be read
        console.warn(`[context-enhancer] Failed to index ${uri.fsPath}:`, e);
    }
}

function getLanguageFromUri(uri: vscode.Uri): string | null {
    const ext = uri.fsPath.split('.').pop()?.toLowerCase();
    if (!ext) {return null;}

    for (const [language, extensions] of Object.entries(LANGUAGE_EXTENSIONS)) {
        if (extensions.includes(ext)) {
            return language;
        }
    }
    return null;
}

function updateStatusBar(): void {
    statusBarItem.text = `$(symbol-structure) CTX: ${indexStore.totalChunks}`;
    statusBarItem.tooltip = `Context Enhancer: ${indexStore.totalChunks} chunks from ${indexStore.totalFiles} files`;
}

export function deactivate() {
    indexStore.clear();
}

