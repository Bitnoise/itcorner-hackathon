import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const loginBodySchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export const tokenResponseSchema = z.object({
  token: z.string(),
});

export const meResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: z.enum(['doctor', 'patient']),
  firstName: z.string(),
  lastName: z.string(),
});

export const errorResponseSchema = z.object({
  error: z.string(),
});

export const validationErrorSchema = z.object({
  error: z.literal('Validation failed'),
  issues: z.array(
    z.object({
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string(),
    }),
  ),
});

export const authContract = c.router({
  login: {
    method: 'POST',
    path: '/auth/login',
    body: loginBodySchema,
    responses: {
      200: tokenResponseSchema,
      401: errorResponseSchema,
      415: errorResponseSchema,
      422: validationErrorSchema,
      503: errorResponseSchema,
    },
  },
  me: {
    method: 'GET',
    path: '/auth/me',
    responses: {
      200: meResponseSchema,
      401: errorResponseSchema,
    },
  },
});
