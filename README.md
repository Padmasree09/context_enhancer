# Context Enhancer

> **Pre-retrieves semantic code context and injects it into GitHub Copilot Chat for faster, smarter, codebase-aware responses.**

[![VS Code](https://img.shields.io/badge/VS%20Code-^1.111.0-blue?logo=visualstudiocode)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-orange)]()

---

## Problem

GitHub Copilot Chat doesn't automatically know about your entire codebase. It only sees the currently open file and whatever context you manually attach. This means responses often miss project-specific patterns, utility functions, and architectural decisions scattered across your workspace.

## Solution

**Context Enhancer** bridges this gap by:

1. **Parsing** your source files into Abstract Syntax Trees using [Tree-sitter](https://tree-sitter.github.io/) (WASM)
2. **Extracting** semantic code chunks — functions, classes, interfaces, methods, type aliases
3. **Indexing** them in-memory with real-time file-watching
4. **Retrieving** the most relevant chunks at query time using a custom **BM25 ranking algorithm**
5. **Injecting** the retrieved context into Copilot Chat via the VS Code Chat Participant API

The result: Copilot responses that are **grounded in your actual codebase**, not just general knowledge.

---

## Features

### AST-Based Code Indexing
Parses source files into syntax trees and extracts meaningful code units (functions, classes, interfaces, methods) — not arbitrary line ranges.

### BM25 Information Retrieval
Custom implementation of the Okapi BM25 ranking algorithm with:
- **IDF weighting** — rare terms get higher importance
- **Term-frequency saturation** — diminishing returns for repeated terms
- **Document-length normalization** — fair scoring across short and long functions
- **Symbol-name boosting** — 1.5× score boost when query matches a function/class name

### Real-Time Incremental Indexing
File-system watchers automatically re-index files on save, create, and delete — no manual re-indexing needed.

### Token-Budget-Aware Context Injection
Selects the top-K ranked chunks within a ~3,000-token budget, preventing context overflow while maximizing relevance.

### Multi-Turn Conversation Support
Maintains chat history across turns, so follow-up questions stay coherent with previously retrieved context.

### Multi-Language Support
Supports **8 languages** out of the box:

| Language    | File Extensions       |
|-------------|-----------------------|
| TypeScript  | `.ts`, `.tsx`         |
| JavaScript  | `.js`, `.jsx`, `.mjs` |
| Python      | `.py`                 |
| Rust        | `.rs`                 |
| Go          | `.go`                 |
| Java        | `.java`               |
| C           | `.c`, `.h`            |
| C++         | `.cpp`, `.hpp`, `.cc`, `.cxx` |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   VS Code Extension                 │
├─────────────┬──────────────┬────────────────────────┤
│   Parser    │   Chunker    │     Index Store         │
│ (Tree-sitter│ (AST node    │  (In-memory, file-keyed │
│   WASM)     │  extraction) │   with O(1) invalidation│
├─────────────┴──────────────┴────────────────────────┤
│                  BM25 Retriever                      │
│       (Query → Ranked code chunks)                   │
├──────────────────────────────────────────────────────┤
│              Chat Participant (@ctx)                  │
│  (Context injection → LLM prompt → Streamed response)│
└──────────────────────────────────────────────────────┘
```

**Module Breakdown:**

| Module | File | Responsibility |
|--------|------|----------------|
| **Parser** | `src/indexer/parser.ts` | Initializes Tree-sitter WASM, loads language grammars, parses source into ASTs |
| **Chunker** | `src/indexer/chunker.ts` | Walks AST nodes, extracts semantic chunks per language-specific node types |
| **Index Store** | `src/indexer/indexStore.ts` | In-memory chunk storage keyed by file path for fast add/remove/lookup |
| **BM25 Retriever** | `src/retriever/bm25.ts` | Scores and ranks chunks against a query using BM25 with symbol boosting |
| **Chat Participant** | `src/participant/chatParticipant.ts` | Registers `@ctx`, orchestrates retrieval, builds prompts, streams LLM responses |

---

## Getting Started

### Prerequisites

- **VS Code** `^1.111.0`
- **GitHub Copilot Chat** extension installed and active
- **Node.js** `18+`

### Installation

```bash
# Clone the repository
git clone https://github.com/Padmasree09/context_enhancer.git
cd context_enhancer

# Install dependencies
npm install

# Compile
npm run compile
```

### Running in Development

1. Open the project in VS Code
2. Press `F5` to launch the **Extension Development Host**
3. In the new VS Code window, open any project you want to index
4. Use `@ctx` in Copilot Chat to ask questions with pre-retrieved context

---

## Usage

### Index Your Workspace

Run the command palette (`Ctrl+Shift+P`) and select:

```
Context Enhancer: Index Workspace
```

This scans up to 500 files and indexes all semantic code chunks. A progress notification shows the indexing status.

### Ask Questions with Context

In Copilot Chat, type:

```
@ctx How does the authentication middleware work?
@ctx What does the handlePayment function do?
@ctx Explain the database connection setup
```

The extension will:
1. Retrieve the most relevant code chunks from your index
2. Show you which files and symbols were injected
3. Stream a response grounded in your actual code

### Clear the Index

```
Context Enhancer: Clear Index
```

### Status Bar

The status bar shows the current chunk count: `CTX: 42` — indicating 42 code chunks are indexed and ready for retrieval.

---

## Commands

| Command | Description |
|---------|-------------|
| `Context Enhancer: Index Workspace` | Parse and index all supported files in the workspace |
| `Context Enhancer: Clear Index` | Clear the in-memory index |

---

## How BM25 Ranking Works

The retriever uses the [Okapi BM25](https://en.wikipedia.org/wiki/Okapi_BM25) algorithm — a bag-of-words ranking function used by search engines:

```
Score(Q, D) = Σ IDF(qi) · [ tf(qi, D) · (k1 + 1) / (tf(qi, D) + k1 · (1 - b + b · |D|/avgdl)) ]
```

**Parameters:**
- `k1 = 1.5` — term frequency saturation
- `b = 0.75` — document length normalization
- Symbol name matches receive a **1.5× score multiplier**

This approach is fast, requires no embeddings or external ML services, and runs entirely locally.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Extension source code |
| **VS Code Extension API** | Editor integration, file watchers, commands, status bar |
| **VS Code Chat Participant API** | Copilot Chat integration with `@ctx` |
| **VS Code Language Model API** | LLM access (GPT-4o via Copilot) |
| **Tree-sitter (WASM)** | Source code parsing into ASTs |
| **BM25** | Information retrieval and ranking |

---

## Project Structure

```
context-enhancer/
├── src/
│   ├── extension.ts              # Extension entry point, activation, file watchers
│   ├── types.ts                  # Shared types (CodeChunk, ScoredChunk, language maps)
│   ├── indexer/
│   │   ├── parser.ts             # Tree-sitter WASM initialization and parsing
│   │   ├── chunker.ts            # AST → semantic code chunk extraction
│   │   └── indexStore.ts         # In-memory file-keyed chunk storage
│   ├── participant/
│   │   └── chatParticipant.ts    # Chat Participant registration and LLM orchestration
│   ├── retriever/
│   │   └── bm25.ts               # BM25 ranking algorithm implementation
│   └── test/
│       └── extension.test.ts     # Test suite
├── parsers/                       # Tree-sitter WASM binaries
├── package.json
├── tsconfig.json
└── eslint.config.mjs
```

---

## Development

```bash
# Watch mode (auto-compile on save)
npm run watch

# Lint
npm run lint

# Run tests
npm test
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

## Acknowledgments

- [Tree-sitter](https://tree-sitter.github.io/) — Incremental parsing library
- [VS Code Extension API](https://code.visualstudio.com/api) — Editor integration
- [Okapi BM25](https://en.wikipedia.org/wiki/Okapi_BM25) — Ranking algorithm
- [GitHub Copilot](https://github.com/features/copilot) — LLM backbone
