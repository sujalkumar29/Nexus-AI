import fs from 'node:fs/promises';
import path from 'node:path';
import { ingestFile, IngestedDocument } from './ingestion.js';

export interface OKFMetadata {
  id: string;
  title: string;
  description: string;
  version: string;
  tags: string[];
  sources: Array<{ title: string; authors?: string[]; year?: number }>;
  license: string;
  author?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ParsedOKFDocument {
  metadata: OKFMetadata;
  body: string;
  isValid: boolean;
  errors: string[];
}

/**
 * Validates and extracts OKF (Open Knowledge Format) frontmatter from Markdown.
 */
export function parseOKFContent(rawText: string): ParsedOKFDocument {
  const errors: string[] = [];
  const frontmatterMatch = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return {
      metadata: {} as any,
      body: rawText,
      isValid: false,
      errors: ['Missing YAML frontmatter delimiters (---) at top of file.'],
    };
  }

  const yamlBlock = frontmatterMatch[1];
  const body = frontmatterMatch[2];
  const metadata: any = {};

  // Simple, robust line-by-line YAML parser for OKF frontmatter
  const lines = yamlBlock.split('\n');
  let currentKey = '';
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ') && inList && currentKey) {
      if (!Array.isArray(metadata[currentKey])) {
        metadata[currentKey] = [];
      }
      metadata[currentKey].push(trimmed.slice(2).replace(/^["']|["']$/g, ''));
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      currentKey = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();
      if (val === '') {
        inList = true;
        metadata[currentKey] = [];
      } else {
        inList = false;
        metadata[currentKey] = val.replace(/^["']|["']$/g, '');
      }
    }
  }

  // Validate required OKF fields according to Open Knowledge Format spec
  const required = ['id', 'title', 'description', 'version', 'tags', 'license'];
  for (const req of required) {
    if (!metadata[req]) {
      errors.push(`Missing required OKF field: "${req}"`);
    }
  }

  if (metadata.tags && !Array.isArray(metadata.tags)) {
    metadata.tags = [metadata.tags];
  }

  return {
    metadata: metadata as OKFMetadata,
    body,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Ingests an OKF file into the curated knowledge collection.
 */
export async function ingestOKFFile(filePath: string): Promise<IngestedDocument | null> {
  const content = await fs.readFile(filePath, 'utf-8');
  const parsed = parseOKFContent(content);

  if (!parsed.isValid) {
    console.warn(`OKF document ${path.basename(filePath)} failed validation:`, parsed.errors);
  }

  return ingestFile(filePath, {
    title: parsed.metadata.title || path.basename(filePath),
    category: 'curated',
  });
}
