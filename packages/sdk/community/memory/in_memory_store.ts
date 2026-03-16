import type { Memory, MemoryStore } from "./types.ts";

/**
 * In-memory MemoryStore implementation. State is lost when the process exits.
 * Pass a custom `MemoryStore` to `MemoryToolset` for persistent storage.
 */
export class InMemoryStore implements MemoryStore {
  private readonly memories: Map<string, Memory> = new Map();

  save(key: string, content: string, tags: string[] = []): Promise<Memory> {
    const existing = this.memories.get(key);
    const now = new Date();
    const memory: Memory = {
      key,
      content,
      tags,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.memories.set(key, memory);
    return Promise.resolve(memory);
  }

  recall(key: string): Promise<Memory | null> {
    return Promise.resolve(this.memories.get(key) ?? null);
  }

  search(query: string): Promise<Memory[]> {
    const lower = query.toLowerCase();
    const results = Array.from(this.memories.values()).filter((m) =>
      m.key.toLowerCase().includes(lower) ||
      m.content.toLowerCase().includes(lower) ||
      m.tags.some((t) => t.toLowerCase().includes(lower))
    );
    return Promise.resolve(results);
  }

  delete(key: string): Promise<boolean> {
    return Promise.resolve(this.memories.delete(key));
  }

  list(): Promise<Array<{ key: string; tags: string[] }>> {
    const entries = Array.from(this.memories.values()).map(({ key, tags }) => ({ key, tags }));
    return Promise.resolve(entries);
  }
}
