// ---------------------------------------------------------------------------
// Graph FSM — state persistence
// ---------------------------------------------------------------------------

import type { NodeId } from "./types.ts";

/** Snapshot of graph execution state that can be saved and restored. */
export interface GraphSnapshot<TState> {
  readonly nodeId: NodeId;
  readonly state: TState;
}

/**
 * Pluggable persistence interface for graph execution state.
 * Implement this to enable resumable graph runs across process restarts.
 */
export interface StatePersistence<TState> {
  /** Persist the current node and state for a graph run. */
  save(graphId: string, nodeId: NodeId, state: TState): Promise<void>;
  /** Load the last saved snapshot, or null if none exists. */
  load(graphId: string): Promise<GraphSnapshot<TState> | null>;
  /** Remove saved state for a graph run (called on successful completion). */
  clear(graphId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// MemoryStatePersistence
// ---------------------------------------------------------------------------

/**
 * In-memory persistence — useful for testing and single-process workflows.
 * State is lost when the process exits.
 */
export class MemoryStatePersistence<TState>
  implements StatePersistence<TState> {
  private readonly store = new Map<string, GraphSnapshot<TState>>();

  save(graphId: string, nodeId: NodeId, state: TState): Promise<void> {
    this.store.set(graphId, { nodeId, state });
    return Promise.resolve();
  }

  load(graphId: string): Promise<GraphSnapshot<TState> | null> {
    return Promise.resolve(this.store.get(graphId) ?? null);
  }

  clear(graphId: string): Promise<void> {
    this.store.delete(graphId);
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// FileStatePersistence
// ---------------------------------------------------------------------------

/**
 * File-backed persistence — survives process restarts.
 * State is JSON-serialized and stored in `{dir}/{graphId}.json`.
 *
 * Requires `--allow-read` and `--allow-write` Deno permissions for the directory.
 */
export class FileStatePersistence<TState> implements StatePersistence<TState> {
  constructor(private readonly dir: string) {}

  private filePath(graphId: string): string {
    // Replace characters that are invalid in filenames
    const safe = graphId.replace(/[/\\:*?"<>|]/g, "_");
    return `${this.dir}/${safe}.json`;
  }

  async save(graphId: string, nodeId: NodeId, state: TState): Promise<void> {
    const snapshot: GraphSnapshot<TState> = { nodeId, state };
    const json = JSON.stringify(snapshot, null, 2);
    await Deno.writeTextFile(this.filePath(graphId), json);
  }

  async load(graphId: string): Promise<GraphSnapshot<TState> | null> {
    try {
      const json = await Deno.readTextFile(this.filePath(graphId));
      const parsed: unknown = JSON.parse(json);
      // Validate structure before returning
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "nodeId" in parsed &&
        "state" in parsed &&
        typeof (parsed as Record<string, unknown>).nodeId === "string"
      ) {
        return parsed as GraphSnapshot<TState>;
      }
      return null;
    } catch {
      // File not found or parse error — treat as no saved state
      return null;
    }
  }

  async clear(graphId: string): Promise<void> {
    try {
      await Deno.remove(this.filePath(graphId));
    } catch {
      // Ignore if file doesn't exist
    }
  }
}
