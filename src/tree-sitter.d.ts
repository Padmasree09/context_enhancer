/**
 * Custom type declarations for web-tree-sitter.
 * The package's own .d.ts/d.cts are broken with commonjs module resolution.
 */
declare module 'web-tree-sitter' {
    interface Point {
        row: number;
        column: number;
    }

    interface Range {
        startPosition: Point;
        endPosition: Point;
        startIndex: number;
        endIndex: number;
    }

    interface SyntaxNode {
        type: string;
        text: string;
        startPosition: Point;
        endPosition: Point;
        startIndex: number;
        endIndex: number;
        childCount: number;
        parent: SyntaxNode | null;
        child(index: number): SyntaxNode | null;
        childForFieldName(fieldName: string): SyntaxNode | null;
        children: SyntaxNode[];
        namedChildren: SyntaxNode[];
    }

    interface Tree {
        rootNode: SyntaxNode;
        delete(): void;
    }

    class Language {
        static load(path: string): Promise<Language>;
        readonly version?: number;
    }

    class Parser {
        static init(options?: { locateFile?: (scriptName: string, scriptDirectory?: string) => string }): Promise<void>;
        constructor();
        setLanguage(language: Language | null): this;
        parse(input: string, oldTree?: Tree | null): Tree | null;
        delete(): void;
    }

    namespace Parser {
        export type { SyntaxNode, Tree, Language, Point, Range };
    }

    export = Parser;
}
