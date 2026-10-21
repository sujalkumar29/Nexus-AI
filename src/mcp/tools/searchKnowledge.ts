import { searchKnowledgeBase } from '../../rag/retriever.js';

export interface SearchKnowledgeInput {
  query: string;
  category?: 'user' | 'curated' | 'all';
  limit?: number;
  threshold?: number;
}

export interface SearchKnowledgeOutput {
  query: string;
  total_matches: number;
  passages: Array<{
    id: string;
    source_id: string;
    source_title: string;
    file_name: string;
    section: string;
    page_number: number;
    content: string;
    similarity_score: number;
    category: string;
  }>;
  retrieval_metadata: {
    engine: string;
    vector_dim: number;
    timestamp: string;
  };
}

export async function executeSearchKnowledge(input: SearchKnowledgeInput): Promise<SearchKnowledgeOutput> {
  if (!input.query || input.query.trim().length === 0) {
    throw new Error('Search query must be a non-empty string');
  }

  const results = await searchKnowledgeBase(input.query, {
    limit: input.limit || 5,
    category: input.category || 'all',
    threshold: input.threshold !== undefined ? input.threshold : 0.35,
  });

  return {
    query: input.query,
    total_matches: results.length,
    passages: results.map(r => ({
      id: r.id,
      source_id: r.sourceId,
      source_title: r.sourceTitle,
      file_name: r.fileName,
      section: r.section,
      page_number: r.pageNumber,
      content: r.content,
      similarity_score: r.score,
      category: r.category,
    })),
    retrieval_metadata: {
      engine: 'Nexus RAG Hybrid Vector-Keyword Engine',
      vector_dim: 128,
      timestamp: new Date().toISOString(),
    },
  };
}
