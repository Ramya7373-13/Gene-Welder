// Third-party SDK clients and in-process response caches.
// Moved verbatim out of server.ts so routers can use them without a cycle.
//
// Every client is null when its API key is absent — callers must fail closed,
// never fall back to fabricated content.

import OpenAI from 'openai';
import Stripe from 'stripe';
import { Resend } from 'resend';

export const geminiCache = new Map<string, { timestamp: number; data: any }>();
export const GEMINI_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// Grok (xAI) consensus-validation layer: an additive parallel intelligence engine
// alongside Gemini. Uses the standard OpenAI SDK architecture against the xAI endpoint.
export const GROK_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
export const grokCache = new Map<string, { timestamp: number; data: any }>();
export const grokClient = process.env.XAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
      timeout: 30_000,
      maxRetries: 1,
    })
  : null;

export const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const resendClient = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
