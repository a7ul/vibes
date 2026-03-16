export interface Memory {
  key: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryStore {
  save(key: string, content: string, tags?: string[]): Promise<Memory>;
  recall(key: string): Promise<Memory | null>;
  search(query: string): Promise<Memory[]>;
  delete(key: string): Promise<boolean>;
  list(): Promise<Array<{ key: string; tags: string[] }>>;
}
