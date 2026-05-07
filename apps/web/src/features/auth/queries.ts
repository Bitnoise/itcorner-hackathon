import { apiClient } from '../../lib/api-client';

export async function fetchCurrentUser() {
  const res = await apiClient.auth.me();
  if (res.status !== 200) {
    throw new Error('Not authenticated');
  }
  return res.body;
}

export const currentUserQueryOptions = {
  queryKey: ['auth', 'me'] as const,
  queryFn: fetchCurrentUser,
  retry: false,
  staleTime: 30_000,
} as const;
