import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';

function extractErrorMessage(body: unknown): string {
  if (body !== null && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return 'Upload failed';
}

async function uploadDocument(file: File): Promise<void> {
  const res = await apiClient.documents.upload({ body: { file } });
  if (res.status !== 201) {
    throw new Error(extractErrorMessage(res.body));
  }
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
