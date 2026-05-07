import { initContract } from '@ts-rest/core';
import { healthContract } from './health';
import { authContract } from './auth';
import { patientProfileContract } from './patient-profile';
import { documentsContract } from './documents';
import { doctorContract } from './doctor';
import { appointmentsContract } from './appointments';
import { visitsContract } from './visits';

const c = initContract();

// Composed root contract. Modules import individual sub-contracts directly,
// but a typed `apiContract` aggregator is convenient for ts-rest clients
// and OpenAPI generation.
export const apiContract = c.router({
  health: healthContract,
  auth: authContract,
  patientProfile: patientProfileContract,
  documents: documentsContract,
  doctor: doctorContract,
  appointments: appointmentsContract,
  visits: visitsContract,
});

export type ApiContract = typeof apiContract;
