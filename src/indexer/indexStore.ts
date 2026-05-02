import { CodeChunk } from '../types';

/**
 * In-memory index store for code chunks.
 * Keyed by file path for fast invalidation on file change.
 */
export class IndexStore {
    private chunksByFile: Map<string, CodeChunk[]> = new Map();
    private _totalChunks = 0;

    /** Add/replace chunks for a given file */
    setFileChunks(filePath: string, chunks: CodeChunk[]): void {
        const existing = this.chunksByFile.get(filePath);
        if (existing) {
            this._totalChunks -= existing.length;
        }
        this.chunksByFile.set(filePath, chunks);
        this._totalChunks += chunks.length;
    }

    /** Remove all chunks for a file (e.g., file deleted) */
    removeFile(filePath: string): void {
        const existing = this.chunksByFile.get(filePath);
        if (existing) {
            this._totalChunks -= existing.length;
            this.chunksByFile.delete(filePath);
        }
    }

    /** Get all chunks across all files */
    getAllChunks(): CodeChunk[] {
        const all: CodeChunk[] = [];
        for (const chunks of this.chunksByFile.values()) {
            all.push(...chunks);
        }
        return all;
    }

    /** Get chunks for a specific file */
    getFileChunks(filePath: string): CodeChunk[] {
        return this.chunksByFile.get(filePath) || [];
    }

    /** Check if a file is indexed */
    hasFile(filePath: string): boolean {
        return this.chunksByFile.has(filePath);
    }

    /** Total number of indexed chunks */
    get totalChunks(): number {
        return this._totalChunks;
    }

    /** Total number of indexed files */
    get totalFiles(): number {
        return this.chunksByFile.size;
    }

    /** Clear entire index */
    clear(): void {
        this.chunksByFile.clear();
        this._totalChunks = 0;
    }
}
