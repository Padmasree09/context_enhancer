import { CodeChunk, ScoredChunk } from '../types';

/**
 * BM25 retrieval algorithm.
 * Lightweight, no ML, no embeddings — just term frequency magic.
 * 
 * BM25 params:
 *   k1 = term frequency saturation (1.2–2.0 typical)
 *   b  = length normalization (0.75 typical)
 */
export class BM25Retriever {
    private k1 = 1.5;
    private b = 0.75;

    /**
     * Score and rank chunks against a query.
     * Returns top-K most relevant chunks.
     */
    retrieve(query: string, chunks: CodeChunk[], topK: number = 10): ScoredChunk[] {
        if (chunks.length === 0) {return [];}

        const queryTerms = this.tokenize(query);
        if (queryTerms.length === 0) {return [];}

        // Precompute document frequencies (how many chunks contain each term)
        const df = this.computeDF(queryTerms, chunks);
        const avgDl = this.computeAvgDocLength(chunks);
        const N = chunks.length;

        const scored: ScoredChunk[] = [];

        for (const chunk of chunks) {
            const score = this.scoreDocument(queryTerms, chunk, df, avgDl, N);
            if (score > 0) {
                scored.push({ chunk, score });
            }
        }

        // Sort descending by score, take top K
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK);
    }

    private scoreDocument(
        queryTerms: string[],
        chunk: CodeChunk,
        df: Map<string, number>,
        avgDl: number,
        N: number
    ): number {
        const docTerms = this.tokenize(chunk.content + ' ' + chunk.symbolName);
        const docLength = docTerms.length;
        const tf = this.computeTF(docTerms);

        let score = 0;

        for (const term of queryTerms) {
            const termFreq = tf.get(term) || 0;
            if (termFreq === 0) {continue;}

            const docFreq = df.get(term) || 0;
            // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
            const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);

            // BM25 TF component
            const tfNorm = (termFreq * (this.k1 + 1)) /
                (termFreq + this.k1 * (1 - this.b + this.b * (docLength / avgDl)));

            score += idf * tfNorm;
        }

        // Boost: symbol name match gets a 2x boost
        const symbolTerms = this.tokenize(chunk.symbolName);
        for (const term of queryTerms) {
            if (symbolTerms.includes(term)) {
                score *= 1.5;
                break;
            }
        }

        return score;
    }

    private computeDF(queryTerms: string[], chunks: CodeChunk[]): Map<string, number> {
        const df = new Map<string, number>();
        for (const term of queryTerms) {
            df.set(term, 0);
        }

        for (const chunk of chunks) {
            const docTerms = new Set(this.tokenize(chunk.content + ' ' + chunk.symbolName));
            for (const term of queryTerms) {
                if (docTerms.has(term)) {
                    df.set(term, (df.get(term) || 0) + 1);
                }
            }
        }

        return df;
    }

    private computeTF(terms: string[]): Map<string, number> {
        const tf = new Map<string, number>();
        for (const term of terms) {
            tf.set(term, (tf.get(term) || 0) + 1);
        }
        return tf;
    }

    private computeAvgDocLength(chunks: CodeChunk[]): number {
        let total = 0;
        for (const chunk of chunks) {
            total += this.tokenize(chunk.content).length;
        }
        return total / chunks.length;
    }

    /**
     * Simple tokenizer: lowercase, split on non-alphanumeric,
     * also split camelCase and snake_case.
     */
    private tokenize(text: string): string[] {
        return text
            .toLowerCase()
            // Split camelCase: insertBefore → insert before
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            // Split on non-word chars
            .split(/[^a-z0-9]+/)
            .filter(t => t.length > 1); // drop single chars
    }
}
