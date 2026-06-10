/**
 * memory-index — a real, queryable BM25-style index over THIS repo's own corpus.
 *
 * The harness "Memory" component requires more than a flat grep: a ranked index
 * built IN CODE over the agent's durable knowledge. agentdial's corpus is its
 * markdown brain + docs + the long-term memory layer:
 *
 *   - MEMORY.md            (the ≤2k-token bootstrap index)
 *   - memory/**.md         (LEARNINGS, daily logs, topics, archive)
 *   - brain/**.md          (Obsidian knowledge graph: MOC + notes + ORG_*)
 *   - docs/**.md           (protocol / architecture docs)
 *   - PROTOCOL.md, README.md, CLAUDE.md, AGENTS.md  (root knowledge files)
 *
 * Scoring is Okapi BM25 over a paragraph-chunked corpus, with a small
 * source-authority multiplier (MEMORY.md / LEARNINGS rank above generic docs).
 * Pure stdlib — no external index, no embeddings service. Deterministic.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root, resolved relative to this module (dist/lib or src/lib → repo root). */
const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..");

/** One indexed chunk: a paragraph-sized unit of a source file. */
export interface MemoryChunk {
  /** Repo-relative source path. */
  file: string;
  /** 1-based line where this chunk starts in the source file. */
  startLine: number;
  /** The chunk text. */
  text: string;
  /** Source-authority weight (higher = more canonical). */
  weight: number;
  /** Tokenized terms (lowercased) for scoring. */
  terms: string[];
}

/** A scored search hit. */
export interface MemoryHit {
  file: string;
  startLine: number;
  score: number;
  /** A short excerpt (first ~240 chars of the chunk, whitespace-collapsed). */
  excerpt: string;
}

/** Directories under the repo root whose `.md` files form the corpus. */
const CORPUS_DIRS = ["memory", "brain", "docs"] as const;
/** Individual root files that are part of the knowledge corpus. */
const ROOT_FILES = [
  "MEMORY.md",
  "PROTOCOL.md",
  "README.md",
  "CLAUDE.md",
  "AGENTS.md",
  "IDENTITY.md",
] as const;

/** Source-authority weight for a repo-relative path. */
function weightFor(relPath: string): number {
  if (relPath === "MEMORY.md") return 3.0; // bootstrap index — most canonical
  if (relPath.startsWith("memory/LEARNINGS")) return 2.5;
  if (relPath.startsWith("memory/topics/")) return 2.2;
  if (relPath === "PROTOCOL.md") return 2.0; // the AIP spec
  if (relPath.startsWith("brain/")) return 1.6; // knowledge graph
  if (relPath.startsWith("memory/daily/")) return 1.4;
  if (relPath.startsWith("docs/")) return 1.3;
  return 1.0;
}

/** Lowercase alnum tokenizer (drops markdown punctuation, keeps words ≥2 chars). */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

/** Recursively collect `*.md` files under a directory. */
function collectMarkdown(dir: string, acc: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectMarkdown(full, acc);
    } else if (entry.endsWith(".md")) {
      acc.push(full);
    }
  }
}

/**
 * Split a file into paragraph-sized chunks (blank-line delimited), tracking the
 * starting line number of each chunk for precise citations.
 */
function chunkFile(absPath: string, relPath: string): MemoryChunk[] {
  const raw = readFileSync(absPath, "utf8");
  const lines = raw.split("\n");
  const weight = weightFor(relPath);
  const chunks: MemoryChunk[] = [];

  let buf: string[] = [];
  let bufStart = 1;
  const flush = () => {
    const text = buf.join("\n").trim();
    if (text.length > 0) {
      chunks.push({
        file: relPath,
        startLine: bufStart,
        text,
        weight,
        terms: tokenize(text),
      });
    }
    buf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === "") {
      flush();
      bufStart = i + 2; // next non-blank line (1-based)
    } else {
      if (buf.length === 0) bufStart = i + 1;
      buf.push(line);
    }
  }
  flush();
  return chunks;
}

/** A built, queryable BM25 index over the repo corpus. */
export class MemoryIndex {
  private readonly chunks: MemoryChunk[];
  private readonly df = new Map<string, number>(); // document frequency per term
  private readonly avgLen: number;
  private readonly k1 = 1.5;
  private readonly b = 0.75;

  constructor(chunks: MemoryChunk[]) {
    this.chunks = chunks;
    let totalLen = 0;
    for (const c of chunks) {
      totalLen += c.terms.length;
      const seen = new Set(c.terms);
      for (const t of seen) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.avgLen = chunks.length > 0 ? totalLen / chunks.length : 0;
  }

  /** Number of indexed chunks. */
  get size(): number {
    return this.chunks.length;
  }

  /** Number of distinct source files indexed. */
  get fileCount(): number {
    return new Set(this.chunks.map((c) => c.file)).size;
  }

  /** Inverse document frequency (BM25 variant, floored at a small positive). */
  private idf(term: string): number {
    const n = this.chunks.length;
    const dft = this.df.get(term) ?? 0;
    return Math.max(0.01, Math.log(1 + (n - dft + 0.5) / (dft + 0.5)));
  }

  /** Rank corpus chunks against a free-text query. Returns top `limit` hits. */
  search(query: string, limit = 5): MemoryHit[] {
    const qTerms = tokenize(query);
    if (qTerms.length === 0) return [];

    const scored: MemoryHit[] = [];
    for (const c of this.chunks) {
      const len = c.terms.length || 1;
      let score = 0;
      for (const qt of qTerms) {
        let tf = 0;
        for (const t of c.terms) if (t === qt) tf++;
        if (tf === 0) continue;
        const idf = this.idf(qt);
        const denom = tf + this.k1 * (1 - this.b + (this.b * len) / this.avgLen);
        score += idf * ((tf * (this.k1 + 1)) / denom);
      }
      if (score <= 0) continue;
      score *= c.weight; // source-authority multiplier
      scored.push({
        file: c.file,
        startLine: c.startLine,
        score: Math.round(score * 1000) / 1000,
        excerpt: c.text.replace(/\s+/g, " ").slice(0, 240),
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }
}

/** Build a MemoryIndex over the repo corpus (brain/, docs/, memory/, root files). */
export function buildMemoryIndex(root: string = REPO_ROOT): MemoryIndex {
  const files: string[] = [];
  for (const d of CORPUS_DIRS) collectMarkdown(join(root, d), files);
  for (const f of ROOT_FILES) {
    const full = join(root, f);
    if (existsSync(full)) files.push(full);
  }

  const chunks: MemoryChunk[] = [];
  for (const abs of files) {
    const rel = relative(root, abs);
    chunks.push(...chunkFile(abs, rel));
  }
  return new MemoryIndex(chunks);
}
