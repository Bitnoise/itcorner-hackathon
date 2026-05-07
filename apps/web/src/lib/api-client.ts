import { initClient } from '@ts-rest/core';
import { apiContract } from '@medbridge/contracts/contract';
import { getToken } from './auth-token';

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001';

export const apiClient = initClient(apiContract, {
  baseUrl,
  baseHeaders: {},
  api: async ({ path, method, headers, body }) => {
    const token = getToken();
    const response = await fetch(path, {
      method,
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ?? undefined,
    });
    const data = (await response.json().catch(() => null)) as unknown;
    return { status: response.status, body: data, headers: response.headers };
  },
});
