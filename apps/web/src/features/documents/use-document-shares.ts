import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';

export interface DoctorAccess {
  doctorId: string;
  displayName: string;
  hasAccess: boolean;
}

async function fetchSharingState(documentId: string): Promise<DoctorAccess[]> {
  const res = await apiClient.documents.getSharingState({ params: { id: documentId } });
  if (res.status !== 200) {
    throw new Error('Failed to load sharing state');
  }
  return res.body;
}

export function sharingStateQueryKey(documentId: string) {
  return ['documents', documentId, 'shares'] as const;
}

export function useDocumentShares(documentId: string, enabled = true) {
  return useQuery({
    queryKey: sharingStateQueryKey(documentId),
    queryFn: () => fetchSharingState(documentId),
    enabled,
    staleTime: 0,
  });
}

export function useGrantAccess(documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (doctorId: string) => {
      const res = await apiClient.documents.grantAccess({
        params: { id: documentId, doctorId },
      });
      if (res.status !== 200) {
        throw new Error('Failed to grant access');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sharingStateQueryKey(documentId) });
    },
  });
}

export function useRevokeAccess(documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (doctorId: string) => {
      const res = await apiClient.documents.revokeAccess({
        params: { id: documentId, doctorId },
      });
      if (res.status !== 200) {
        throw new Error('Failed to revoke access');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sharingStateQueryKey(documentId) });
    },
  });
}
