import { buildMemoryIndex } from "../lib/memory-index.js";
import { heading, info, success } from "../lib/ui.js";

/**
 * `agentdial memory-search "<query>"` — query the repo's own knowledge corpus.
 *
 * Builds a BM25 index over brain/, docs/, memory/ + the root knowledge files
 * (MEMORY.md, PROTOCOL.md, ...) and returns the top-ranked chunks with a
 * file:line citation. This is the agent's recall surface over its durable memory.
 */
export async function cmdMemorySearch(
  query: string,
  opts: { limit?: string; json?: boolean },
): Promise<void> {
  const limit = opts.limit ? parseInt(opts.limit, 10) : 5;
  const index = buildMemoryIndex();
  const hits = index.search(query, isNaN(limit) ? 5 : limit);

  if (opts.json) {
    console.log(
      JSON.stringify(
        { query, indexed: { chunks: index.size, files: index.fileCount }, hits },
        null,
        2,
      ),
    );
    return;
  }

  heading(`Memory search: "${query}"`);
  info(`indexed ${String(index.size)} chunks across ${String(index.fileCount)} files`);
  console.log("");

  if (hits.length === 0) {
    info("No matching memory found.");
    return;
  }

  hits.forEach((hit, i) => {
    success(`[${String(i + 1)}] ${hit.file}:${String(hit.startLine)}  (score ${String(hit.score)})`);
    console.log(`    ${hit.excerpt}`);
    console.log("");
  });
}
