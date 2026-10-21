import { prisma } from '../db/prisma.js';
import { generateLocalEmbedding } from './ingestion.js';

export interface RetrievedPassage {
  id: string;
  sourceId: string;
  sourceTitle: string;
  fileName: string;
  section: string;
  pageNumber: number;
  content: string;
  score: number;
  category: string;
}

export interface SearchOptions {
  limit?: number;
  category?: 'user' | 'curated' | 'all';
  threshold?: number;
}

/**
 * Compute cosine similarity between two normalized float vectors.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return Math.max(0, Math.min(1, dotProduct));
}

/**
 * Compute term overlap score between query keywords and text.
 */
function keywordRelevance(query: string, text: string): number {
  const queryTerms = query.toLowerCase().match(/\b[a-z0-9_-]+\b/g) || [];
  if (queryTerms.length === 0) return 0;
  
  const textLower = text.toLowerCase();
  let matches = 0;
  let exactPhraseBonus = 0;

  if (textLower.includes(query.toLowerCase().trim())) {
    exactPhraseBonus = 0.35;
  }

  for (const term of queryTerms) {
    if (term.length > 2 && textLower.includes(term)) {
      matches += 1;
    }
  }

  const fraction = matches / queryTerms.length;
  return Math.min(1.0, fraction * 0.7 + exactPhraseBonus);
}

/**
 * Search the indexed knowledge base using hybrid vector and keyword matching.
 */
export async function searchKnowledgeBase(
  query: string,
  options: SearchOptions = {}
): Promise<RetrievedPassage[]> {
  const limit = options.limit || 5;
  const threshold = options.threshold !== undefined ? options.threshold : 0.35;
  const categoryFilter = options.category && options.category !== 'all' ? options.category : undefined;

  const queryVector = generateLocalEmbedding(query);

  const whereClause: any = {};
  if (categoryFilter) {
    whereClause.source = { category: categoryFilter };
  }

  const chunks = await prisma.documentChunk.findMany({
    where: whereClause,
    include: {
      source: true,
    },
  });

  if (chunks.length === 0) {
    return [];
  }

  const scored: RetrievedPassage[] = [];

  for (const chunk of chunks) {
    let embeddingVector: number[] = [];
    if (chunk.embedding) {
      try {
        embeddingVector = JSON.parse(chunk.embedding);
      } catch {
        embeddingVector = [];
      }
    }

    const vectorScore = embeddingVector.length > 0 ? cosineSimilarity(queryVector, embeddingVector) : 0;
    const termScore = keywordRelevance(query, chunk.content + ' ' + (chunk.section || ''));
    
    // Hybrid weighted score
    const finalScore = Number((0.55 * vectorScore + 0.45 * termScore).toFixed(3));

    if (finalScore >= threshold) {
      scored.push({
        id: chunk.id,
        sourceId: chunk.sourceId,
        sourceTitle: chunk.source.title,
        fileName: chunk.source.fileName,
        section: chunk.section || 'General',
        pageNumber: chunk.pageNumber || 1,
        content: chunk.content,
        score: finalScore,
        category: chunk.source.category,
      });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
