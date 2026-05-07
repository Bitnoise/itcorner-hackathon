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

export const doctorAccessSchema = z.object({
  doctorId: z.string().uuid(),
  displayName: z.string(),
  hasAccess: z.boolean(),
});

export const sharingMutationSuccessSchema = z.object({
  ok: z.literal(true),
});

export const sharedDocumentsGroupSchema = z.object({
  patientId: z.string().uuid(),
  patientDisplayName: z.string(),
  documents: z.array(documentMetadataSchema),
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
  getSharingState: {
    method: 'GET',
    path: '/documents/:id/shares',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: {
      200: z.array(doctorAccessSchema),
      403: documentErrorSchema,
      404: documentErrorSchema,
    },
  },
  grantAccess: {
    method: 'PUT',
    path: '/documents/:id/shares/:doctorId',
    pathParams: z.object({ id: z.string().uuid(), doctorId: z.string().uuid() }),
    body: c.type<undefined>(),
    responses: {
      200: sharingMutationSuccessSchema,
      403: documentErrorSchema,
      404: documentErrorSchema,
    },
  },
  revokeAccess: {
    method: 'DELETE',
    path: '/documents/:id/shares/:doctorId',
    pathParams: z.object({ id: z.string().uuid(), doctorId: z.string().uuid() }),
    responses: {
      200: sharingMutationSuccessSchema,
      403: documentErrorSchema,
      404: documentErrorSchema,
    },
  },
  sharedWithMe: {
    method: 'GET',
    path: '/documents/shared-with-me',
    responses: {
      200: z.array(sharedDocumentsGroupSchema),
    },
  },
  download: {
    method: 'GET',
    path: '/documents/:id/file',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: {
      200: c.type<Blob>(),
      403: documentErrorSchema,
      404: documentErrorSchema,
    },
  },
});
