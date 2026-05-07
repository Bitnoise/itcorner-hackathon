import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const probeOkSchema = z.object({ ok: z.literal(true) });
const errorResponseSchema = z.object({ error: z.string() });

export const probeContract = c.router({
  doctorOnly: {
    method: 'GET',
    path: '/api/_probe/doctor-only',
    responses: {
      200: probeOkSchema,
      401: errorResponseSchema,
      403: errorResponseSchema,
    },
  },
  patientOnly: {
    method: 'GET',
    path: '/api/_probe/patient-only',
    responses: {
      200: probeOkSchema,
      401: errorResponseSchema,
      403: errorResponseSchema,
    },
  },
});
