const STORAGE_KEY = "knowledge_sources";

export interface KnowledgeSource {
  id: string;
  title: string;
  sourceType: "pdf" | "text" | "image" | "url";
  fileName?: string;
  description?: string;
  tags: string[];
  chunks: KnowledgeChunk[];
  totalChunks: number;
  status: "processing" | "ready" | "error";
  createdAt: string;
}

export interface KnowledgeChunk {
  id: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
}

function generateId() {
  return "k_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getKnowledgeSources(): KnowledgeSource[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveKnowledgeSources(sources: KnowledgeSource[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
}

export function addKnowledgeSource(input: {
  title: string;
  sourceType: KnowledgeSource["sourceType"];
  fileName?: string;
  description?: string;
  tags: string[];
  content: string;
}): KnowledgeSource {
  const sources = getKnowledgeSources();
  const chunks = splitIntoChunks(input.content);
  const source: KnowledgeSource = {
    id: generateId(),
    title: input.title,
    sourceType: input.sourceType,
    fileName: input.fileName,
    description: input.description,
    tags: input.tags,
    chunks,
    totalChunks: chunks.length,
    status: "ready",
    createdAt: new Date().toISOString(),
  };
  sources.push(source);
  saveKnowledgeSources(sources);
  return source;
}

export function deleteKnowledgeSource(id: string) {
  const sources = getKnowledgeSources().filter((s) => s.id !== id);
  saveKnowledgeSources(sources);
}

function splitIntoChunks(text: string, maxLength = 1500): KnowledgeChunk[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: KnowledgeChunk[] = [];
  let current = "";
  let idx = 0;

  for (const para of paragraphs) {
    if (current.length + para.length > maxLength && current) {
      chunks.push({ id: generateId(), chunkIndex: idx++, content: current.trim() });
      current = "";
    }
    current += para + "\n\n";
  }
  if (current.trim()) {
    chunks.push({ id: generateId(), chunkIndex: idx, content: current.trim() });
  }
  return chunks;
}

export function searchKnowledge(query: string, tags?: string[]): KnowledgeChunk[] {
  const sources = getKnowledgeSources().filter((s) => {
    if (s.status !== "ready") return false;
    if (tags && tags.length > 0) {
      return tags.some((t) => s.tags.includes(t));
    }
    return true;
  });

  const queryLower = query.toLowerCase();
  const results: { chunk: KnowledgeChunk; score: number }[] = [];

  for (const source of sources) {
    for (const chunk of source.chunks) {
      const contentLower = chunk.content.toLowerCase();
      let score = 0;
      const words = queryLower.split(/\s+/);
      for (const word of words) {
        if (contentLower.includes(word)) score++;
      }
      if (score > 0) {
        results.push({ chunk, score });
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((r) => r.chunk);
}
