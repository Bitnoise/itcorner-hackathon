import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const doctorProfileSchema = z.object({
  userId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  specialization: z.string().nullable(),
});

export const updateDoctorProfileBodySchema = z
  .object({
    firstName: z.string().min(1).max(255).optional(),
    lastName: z.string().min(1).max(255).optional(),
    specialization: z.string().max(255).nullable().optional(),
  })
  .strict();

export const doctorErrorSchema = z.object({ error: z.string() });

export const doctorContract = c.router({
  getProfile: {
    method: 'GET',
    path: '/doctors/me/profile',
    responses: {
      200: doctorProfileSchema,
      401: doctorErrorSchema,
      403: doctorErrorSchema,
    },
  },
  updateProfile: {
    method: 'PATCH',
    path: '/doctors/me/profile',
    body: updateDoctorProfileBodySchema,
    responses: {
      200: doctorProfileSchema,
      401: doctorErrorSchema,
      403: doctorErrorSchema,
      422: doctorErrorSchema,
    },
  },
});
