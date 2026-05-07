import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';

function extractErrorMessage(body: unknown): string {
  if (
    body !== null &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
  ) {
    return (body as { error: string }).error;
  }
  return 'Delete failed';
}

async function deleteDocument(id: string): Promise<void> {
  const res = await apiClient.documents.delete({ params: { id } });
  if (res.status !== 204) {
    throw new Error(extractErrorMessage(res.body));
  }
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
