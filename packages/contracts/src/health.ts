import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const healthContract = c.router({
  check: {
    method: 'GET',
    path: '/health',
    summary: 'Liveness probe used by clients and operators. No auth.',
    responses: {
      200: healthResponseSchema,
    },
  },
});
