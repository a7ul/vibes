/**
 * SpanTree and SpanNode - lightweight span tree for evaluating OTel trace data.
 *
 * Provides tree traversal, predicate queries, and DFS iteration over span trees
 * captured during task execution.
 */

// ---------------------------------------------------------------------------
// SpanData
// ---------------------------------------------------------------------------

/** Raw data shape for a span, used when constructing a SpanTree. */
export interface SpanData {
  name: string;
  attributes: Record<string, unknown>;
  durationMs: number;
  startTime: Date;
  endTime: Date;
  status: "ok" | "error" | "unset";
  events: Array<{
    name: string;
    attributes: Record<string, unknown>;
    time: Date;
  }>;
  children: SpanData[];
}

// ---------------------------------------------------------------------------
// SpanNode
// ---------------------------------------------------------------------------

/**
 * An immutable node in a span tree. Contains readonly references to its parent
 * and children. Computed properties `ancestors` and `descendants` are lazily
 * evaluated.
 */
export class SpanNode {
  readonly name: string;
  readonly attributes: Record<string, unknown>;
  readonly durationMs: number;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly status: "ok" | "error" | "unset";
  readonly events: Array<{
    name: string;
    attributes: Record<string, unknown>;
    time: Date;
  }>;
  readonly children: SpanNode[];
  readonly parent: SpanNode | undefined;

  constructor(
    data: SpanData,
    parent: SpanNode | undefined,
    children: SpanNode[],
  ) {
    this.name = data.name;
    this.attributes = { ...data.attributes };
    this.durationMs = data.durationMs;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.status = data.status;
    this.events = data.events.map((e) => ({ ...e }));
    this.children = children;
    this.parent = parent;
  }

  /**
   * All ancestor nodes, from immediate parent to root.
   * Computed lazily.
   */
  get ancestors(): SpanNode[] {
    const result: SpanNode[] = [];
    let current: SpanNode | undefined = this.parent;
    while (current !== undefined) {
      result.push(current);
      current = current.parent;
    }
    return result;
  }

  /**
   * All descendant nodes (DFS, all levels).
   * Computed lazily.
   */
  get descendants(): SpanNode[] {
    const result: SpanNode[] = [];
    for (const child of this.children) {
      result.push(child);
      result.push(...child.descendants);
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// SpanTree
// ---------------------------------------------------------------------------

/**
 * A tree of SpanNodes. Supports predicate-based traversal and DFS iteration.
 */
export class SpanTree {
  /** The root-level spans (nodes without parents). */
  readonly root: SpanNode[];

  constructor(root: SpanNode[]) {
    this.root = root;
  }

  // -------------------------------------------------------------------------
  // Factory
  // -------------------------------------------------------------------------

  /**
   * Build a SpanTree from an array of root-level SpanData objects.
   * Children are resolved recursively.
   */
  static fromSpanData(spans: SpanData[]): SpanTree {
    const rootNodes = spans.map((s) => buildNode(s, undefined));
    return new SpanTree(rootNodes);
  }

  // -------------------------------------------------------------------------
  // Traversal
  // -------------------------------------------------------------------------

  /**
   * Collect all nodes matching `predicate` (DFS).
   */
  find(predicate: (node: SpanNode) => boolean): SpanNode[] {
    const results: SpanNode[] = [];
    for (const node of this) {
      if (predicate(node)) results.push(node);
    }
    return results;
  }

  /** Returns true if any node matches `predicate`. */
  any(predicate: (node: SpanNode) => boolean): boolean {
    for (const node of this) {
      if (predicate(node)) return true;
    }
    return false;
  }

  /** Returns true if every node matches `predicate`. */
  all(predicate: (node: SpanNode) => boolean): boolean {
    for (const node of this) {
      if (!predicate(node)) return false;
    }
    return true;
  }

  /** Returns the count of nodes matching `predicate`. */
  count(predicate: (node: SpanNode) => boolean): number {
    let n = 0;
    for (const node of this) {
      if (predicate(node)) n++;
    }
    return n;
  }

  // -------------------------------------------------------------------------
  // Iteration (DFS)
  // -------------------------------------------------------------------------

  [Symbol.iterator](): Iterator<SpanNode> {
    const stack: SpanNode[] = [...this.root].reverse(); // reverse so first root comes first

    return {
      next(): IteratorResult<SpanNode> {
        if (stack.length === 0) {
          return { done: true, value: undefined as unknown as SpanNode };
        }
        const node = stack.pop()!;
        // Push children in reverse so leftmost child is processed first
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
        return { done: false, value: node };
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively build a SpanNode from SpanData, setting parent references.
 */
function buildNode(data: SpanData, parent: SpanNode | undefined): SpanNode {
  // We need to build children first then pass to constructor.
  // Use a two-pass approach: create a placeholder parent, then build children.
  // Since SpanNode is immutable, we build bottom-up.
  const childNodes: SpanNode[] = [];
  const node = new SpanNode(data, parent, childNodes);

  // Build children with this node as their parent
  for (const childData of data.children) {
    childNodes.push(buildNode(childData, node));
  }

  return node;
}
