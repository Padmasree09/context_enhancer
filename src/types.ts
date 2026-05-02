export interface CodeChunk {
    /** Unique ID: filePath#startLine */
    id: string;
    /** Absolute file path */
    filePath: string;
    /** Language identifier (typescript, python, etc.) */
    language: string;
    /** The type of symbol: function, class, method, interface, etc. */
    symbolType: string;
    /** Name of the function/class/method */
    symbolName: string;
    /** The raw source code of this chunk */
    content: string;
    /** Start line (0-based) */
    startLine: number;
    /** End line (0-based) */
    endLine: number;
}

export interface ScoredChunk {
    chunk: CodeChunk;
    score: number;
}

/** Supported languages and their tree-sitter grammar file names */
export const SUPPORTED_LANGUAGES: Record<string, string> = {
    'typescript': 'tree-sitter-typescript',
    'javascript': 'tree-sitter-javascript',
    'python': 'tree-sitter-python',
    'rust': 'tree-sitter-rust',
    'go': 'tree-sitter-go',
    'java': 'tree-sitter-java',
    'c': 'tree-sitter-c',
    'cpp': 'tree-sitter-cpp',
};

/** Map VS Code languageId to file extension patterns */
export const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
    'typescript': ['ts', 'tsx'],
    'javascript': ['js', 'jsx', 'mjs'],
    'python': ['py'],
    'rust': ['rs'],
    'go': ['go'],
    'java': ['java'],
    'c': ['c', 'h'],
    'cpp': ['cpp', 'hpp', 'cc', 'cxx'],
};
