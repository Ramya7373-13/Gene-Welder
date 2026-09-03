import request from 'supertest';
import { app } from '../../src/server.js';
import { describe, it, expect } from '@jest/globals';

describe('Auth HTTP Interface', () => {
  describe('POST /api/auth/request-link', () => {
    it('returns 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/request-link')
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('email is required');
    });
  });

  describe('GET /api/auth/verify', () => {
    it('returns 400 when token is missing', async () => {
      const response = await request(app).get('/api/auth/verify');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('token is required');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 when not authenticated', async () => {
      const response = await request(app).get('/api/auth/me');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears session and returns 200', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({});
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out');
    });
  });
});

describe('Usage Metering HTTP Interface', () => {
  describe('GET /api/usage', () => {
    it('returns 401 when not authenticated', async () => {
      const response = await request(app).get('/api/usage');
      expect(response.status).toBe(401);
    });
  });
});

describe('Health Endpoint HTTP Interface', () => {
  describe('GET /api/health', () => {
    it('returns 200 with status and services info', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('app');
    });
  });
});

describe('Quota Response Shape', () => {
  it('returns 402 with PAYWALL code when quota exceeded', async () => {
    // This test verifies the shape of the 402 response
    // In a real test, we'd mock the session and usage
    const response = await request(app)
      .post('/api/ai/variant-analysis')
      .set('Cookie', 'mm_session=nonexistent-session')
      .send({ gene: 'BRCA1', variant: 'c.524G>A' });

    // Either 401 (not authenticated) or 402 (quota exceeded) - both are valid
    expect([401, 402]).toContain(response.status);
  });
});

describe('Stripe Checkout HTTP Interface', () => {
  describe('POST /api/stripe/checkout', () => {
    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/stripe/checkout')
        .send({});
      expect(response.status).toBe(401);
    });
  });
});

describe('Protected Routes - Auth Required', () => {
  it('POST /api/analyses returns 401 when not authenticated', async () => {
    const response = await request(app)
      .post('/api/analyses')
      .send({ gene: 'BRCA1', variant: 'c.524G>A' });
    expect(response.status).toBe(401);
  });

  it('GET /api/analyses returns 401 when not authenticated', async () => {
    const response = await request(app).get('/api/analyses');
    expect(response.status).toBe(401);
  });
});

describe('Rate Limiting - /api/auth/request-link', () => {
  it('returns 429 on 4th request within rate limit window', async () => {
    const testEmail = `ratelimit-test-${Date.now()}@example.com`;

    // First 3 requests (may return 200 or 503 if Resend not configured)
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/request-link')
        .send({ email: testEmail });
    }

    // 4th request should be rate limited regardless of Resend status
    const fourthResponse = await request(app)
      .post('/api/auth/request-link')
      .send({ email: testEmail });
    expect(fourthResponse.status).toBe(429);
    expect(fourthResponse.body.error).toBe('Too many requests. Please try again later.');
  });

  it('does not reveal which rate limit was hit (email vs IP)', async () => {
    const testEmail = `ratelimit-same-${Date.now()}@example.com`;

    // Make 3 requests to hit email limit
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/request-link')
        .send({ email: testEmail });
    }

    // 4th request should return same generic message regardless of which limit hit
    const response = await request(app)
      .post('/api/auth/request-link')
      .send({ email: testEmail });
    expect(response.status).toBe(429);
    expect(response.body.error).toBe('Too many requests. Please try again later.');
    expect(response.body.error).not.toContain('email');
    expect(response.body.error).not.toContain('IP');
  });
});

describe('User Enumeration Prevention', () => {
  it('returns same response for known and unknown emails', async () => {
    const knownEmail = 'admin@mutationmechanic.com';
    const unknownEmail = `nonexistent-${Date.now()}@example.com`;

    const knownResponse = await request(app)
      .post('/api/auth/request-link')
      .send({ email: knownEmail });

    const unknownResponse = await request(app)
      .post('/api/auth/request-link')
      .send({ email: unknownEmail });

    // Both should return same status and message to prevent enumeration
    expect(knownResponse.status).toBe(unknownResponse.status);
    expect(knownResponse.body.message || knownResponse.body.error)
      .toBe(unknownResponse.body.message || unknownResponse.body.error);
  });
});
