import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const documentMetadataSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  uploadedAt: z.string().datetime(),
});

export const documentErrorSchema = z.object({
  error: z.string(),
});

export const documentsContract = c.router({
  upload: {
    method: 'POST',
    path: '/documents',
    contentType: 'multipart/form-data',
    body: c.type<{ file: File }>(),
    responses: {
      201: documentMetadataSchema,
      413: documentErrorSchema,
      415: documentErrorSchema,
      422: documentErrorSchema,
      500: documentErrorSchema,
    },
  },
  list: {
    method: 'GET',
    path: '/documents',
    responses: {
      200: z.array(documentMetadataSchema),
    },
  },
});
