import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db/prisma.js';

export interface ChunkData {
  chunkIndex: number;
  content: string;
  section?: string;
  pageNumber?: number;
  embedding?: number[];
}

export interface IngestedDocument {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: 'user' | 'curated';
  tokenCount: number;
  chunksCount: number;
}

/**
 * Creates a deterministic, normalized term-frequency feature vector for semantic similarity.
 * Uses a vocabulary space of relevant CS/Systems concepts + hash bucketing (128 dimensions).
 */
export function generateLocalEmbedding(text: string, dimensions = 128): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const words = text.toLowerCase().match(/\b[a-z0-9_-]+\b/g) || [];
  
  if (words.length === 0) return vector;

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % dimensions;
    vector[bucket] += 1;
  }

  // L2 Normalize the vector
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(5));
    }
  }

  return vector;
}

/**
 * Split text into semantic chunks with overlap, tracking headers/sections.
 */
export function chunkText(fullText: string, maxChunkLength = 600, overlap = 80): ChunkData[] {
  const lines = fullText.split('\n');
  const chunks: ChunkData[] = [];
  
  let currentChunk = '';
  let currentSection = 'General';
  let chunkIndex = 0;
  let pageEstimate = 1;
  let lineCountInPage = 0;

  for (const line of lines) {
    lineCountInPage++;
    if (lineCountInPage > 45) {
      pageEstimate++;
      lineCountInPage = 0;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      currentSection = trimmed.replace(/^#+\s*/, '');
    }

    if ((currentChunk.length + line.length + 1) > maxChunkLength && currentChunk.trim().length > 0) {
      chunks.push({
        chunkIndex,
        content: currentChunk.trim(),
        section: currentSection,
        pageNumber: pageEstimate,
        embedding: generateLocalEmbedding(currentChunk),
      });
      chunkIndex++;

      // Retain overlap from end of current chunk
      const sliceStart = Math.max(0, currentChunk.length - overlap);
      currentChunk = currentChunk.slice(sliceStart) + '\n' + line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      chunkIndex,
      content: currentChunk.trim(),
      section: currentSection,
      pageNumber: pageEstimate,
      embedding: generateLocalEmbedding(currentChunk),
    });
  }

  return chunks;
}

/**
 * Ingests a text or markdown file into the database.
 */
export async function ingestFile(
  filePath: string,
  options: { title?: string; category?: 'user' | 'curated' } = {}
): Promise<IngestedDocument> {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const fileStat = await fs.stat(filePath);
  const rawContent = await fs.readFile(filePath, 'utf-8');

  const title = options.title || fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
  const category = options.category || 'user';
  const fileType = ext === '.md' ? 'markdown' : ext === '.pdf' ? 'pdf' : 'text';

  // Estimate token count (~4 characters per token)
  const tokenCount = Math.round(rawContent.length / 4);

  // Split into chunks
  const chunks = chunkText(rawContent);

  // Upsert KnowledgeSource
  const source = await prisma.knowledgeSource.create({
    data: {
      title,
      fileName,
      fileType,
      fileSize: fileStat.size,
      category,
      content: rawContent,
      tokenCount,
      status: 'INDEXED',
      chunks: {
        create: chunks.map(c => ({
          chunkIndex: c.chunkIndex,
          content: c.content,
          section: c.section,
          pageNumber: c.pageNumber,
          embedding: c.embedding ? JSON.stringify(c.embedding) : null,
        })),
      },
    },
    include: {
      chunks: true,
    },
  });

  return {
    id: source.id,
    title: source.title,
    fileName: source.fileName,
    fileType: source.fileType,
    fileSize: source.fileSize,
    category: source.category as 'user' | 'curated',
    tokenCount: source.tokenCount,
    chunksCount: source.chunks.length,
  };
}
