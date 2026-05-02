import * as vscode from 'vscode';
import Parser = require('web-tree-sitter');
import * as path from 'path';

let parserInstance: Parser | null = null;
const languageCache: Map<string, Parser.Language> = new Map();

/**
 * Initialize tree-sitter WASM runtime.
 * Must be called once before parsing.
 */
export async function initParser(extensionPath: string): Promise<void> {
    if (parserInstance) {return;}

    await Parser.init({
        locateFile(scriptName: string) {
            return path.join(extensionPath, 'parsers', scriptName);
        },
    });

    parserInstance = new Parser();
}

/**
 * Load a language grammar (.wasm file) for tree-sitter.
 */
export async function loadLanguage(language: string, extensionPath: string): Promise<Parser.Language | null> {
    if (languageCache.has(language)) {
        return languageCache.get(language)!;
    }

    const wasmPath = path.join(extensionPath, 'parsers', `tree-sitter-${language}.wasm`);

    try {
        const lang = await Parser.Language.load(wasmPath);
        languageCache.set(language, lang);
        return lang;
    } catch (e) {
        vscode.window.showWarningMessage(`Context Enhancer: Failed to load grammar for ${language}`);
        console.error(`[context-enhancer] Failed to load ${wasmPath}:`, e);
        return null;
    }
}

/**
 * Parse source code into a tree-sitter tree.
 */
export function parseSource(sourceCode: string, language: Parser.Language): Parser.Tree | null {
    if (!parserInstance) {
        console.error('[context-enhancer] Parser not initialized');
        return null;
    }

    parserInstance.setLanguage(language as any);
    return parserInstance.parse(sourceCode);
}

/**
 * Get the parser instance (for testing/debugging).
 */
export function getParser(): Parser | null {
    return parserInstance;
}
