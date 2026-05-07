import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';

export interface DocumentItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

async function fetchDocuments(): Promise<DocumentItem[]> {
  const res = await apiClient.documents.list();
  if (res.status !== 200) {
    throw new Error('Failed to fetch documents');
  }
  return res.body;
}

export const documentsQueryOptions = {
  queryKey: ['documents'] as const,
  queryFn: fetchDocuments,
  staleTime: 30_000,
} as const;

export function useDocuments() {
  return useQuery(documentsQueryOptions);
}
