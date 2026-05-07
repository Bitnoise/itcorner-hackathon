import { describe, expect, it } from 'vitest';
import { createApp } from '../app';

describe('GET /health', () => {
  it('returns HTTP 200 with { status: "ok" } and no auth required', async () => {
    const app = createApp();

    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
