import Parser = require('web-tree-sitter');
import { CodeChunk } from '../types';

/**
 * Node types we extract as semantic chunks, per language.
 * These are the AST node types tree-sitter uses.
 */
const CHUNK_NODE_TYPES: Record<string, string[]> = {
    'typescript': [
        'function_declaration',
        'method_definition',
        'class_declaration',
        'interface_declaration',
        'type_alias_declaration',
        'arrow_function',       // only top-level or exported
        'export_statement',
    ],
    'javascript': [
        'function_declaration',
        'method_definition',
        'class_declaration',
        'arrow_function',
        'export_statement',
    ],
    'python': [
        'function_definition',
        'class_definition',
    ],
    'rust': [
        'function_item',
        'impl_item',
        'struct_item',
        'enum_item',
        'trait_item',
    ],
    'go': [
        'function_declaration',
        'method_declaration',
        'type_declaration',
    ],
    'java': [
        'method_declaration',
        'class_declaration',
        'interface_declaration',
    ],
    'c': [
        'function_definition',
        'struct_specifier',
    ],
    'cpp': [
        'function_definition',
        'class_specifier',
        'struct_specifier',
    ],
};

/**
 * Extracts semantic chunks from a parsed tree-sitter tree.
 */
export function extractChunks(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
    language: string
): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const targetTypes = CHUNK_NODE_TYPES[language] || CHUNK_NODE_TYPES['typescript'];

    function walk(node: Parser.SyntaxNode) {
        if (targetTypes.includes(node.type)) {
            const symbolName = extractSymbolName(node, language);
            const content = sourceCode.slice(node.startIndex, node.endIndex);

            // Skip tiny chunks (one-liners, getters, etc.)
            const lineCount = node.endPosition.row - node.startPosition.row;
            if (lineCount < 2) {
                // Still walk children for nested definitions
                for (let i = 0; i < node.childCount; i++) {
                    walk(node.child(i)!);
                }
                return;
            }

            chunks.push({
                id: `${filePath}#${node.startPosition.row}`,
                filePath,
                language,
                symbolType: node.type,
                symbolName: symbolName || '<anonymous>',
                content,
                startLine: node.startPosition.row,
                endLine: node.endPosition.row,
            });

            // Don't recurse into chunks we already captured — 
            // prevents double-counting methods inside classes.
            // Exception: class bodies — we DO want methods inside classes as separate chunks.
            if (node.type.includes('class') || node.type.includes('impl')) {
                for (let i = 0; i < node.childCount; i++) {
                    walk(node.child(i)!);
                }
            }
            return;
        }

        // Recurse
        for (let i = 0; i < node.childCount; i++) {
            walk(node.child(i)!);
        }
    }

    walk(tree.rootNode);
    return chunks;
}

/**
 * Attempts to extract a human-readable name from the AST node.
 */
function extractSymbolName(node: Parser.SyntaxNode, _language: string): string | null {
    // Most languages: look for a 'name' or 'identifier' child
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
        return nameNode.text;
    }

    // For export statements, dig into the declaration
    if (node.type === 'export_statement') {
        const declaration = node.childForFieldName('declaration');
        if (declaration) {
            const innerName = declaration.childForFieldName('name');
            if (innerName) {
                return innerName.text;
            }
        }
    }

    // For variable declarators with arrow functions
    const parent = node.parent;
    if (parent && parent.type === 'variable_declarator') {
        const varName = parent.childForFieldName('name');
        if (varName) {
            return varName.text;
        }
    }

    return null;
}
