import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';

export interface SharedDocumentMetadata {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface SharedDocumentsGroup {
  patientId: string;
  patientDisplayName: string;
  documents: SharedDocumentMetadata[];
}

async function fetchSharedDocuments(): Promise<SharedDocumentsGroup[]> {
  const res = await apiClient.documents.sharedWithMe();
  if (res.status !== 200) {
    throw new Error('Failed to load shared documents');
  }
  return res.body;
}

export const sharedDocumentsQueryOptions = {
  queryKey: ['documents', 'shared-with-me'] as const,
  queryFn: fetchSharedDocuments,
  staleTime: 30_000,
} as const;

export function useSharedDocuments() {
  return useQuery(sharedDocumentsQueryOptions);
}
