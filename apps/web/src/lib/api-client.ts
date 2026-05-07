import { initClient } from '@ts-rest/core';
import { apiContract } from '@medbridge/contracts/contract';

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001';

export const apiClient = initClient(apiContract, {
  baseUrl,
  baseHeaders: {},
});
