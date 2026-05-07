import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';

export async function fetchDoctorProfile() {
  const res = await apiClient.doctor.getProfile();
  if (res.status !== 200) {
    throw new Error('Failed to load doctor profile');
  }
  return res.body;
}

export function useDoctorProfile() {
  return useQuery({
    queryKey: ['doctor', 'profile'] as const,
    queryFn: fetchDoctorProfile,
    staleTime: 30_000,
  });
}
