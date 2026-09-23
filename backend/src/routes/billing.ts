// Usage metering readout and Stripe subscription endpoints.
// Mounted at /api by server.ts.
//
// IMPORTANT: the webhook route depends on `express.raw` being applied to
// /api/stripe/webhook BEFORE the global express.json() parser. That middleware
// still lives in server.ts and must stay ahead of the body parsers, otherwise
// Stripe signature verification will fail on every event.

import express from 'express';
import Stripe from 'stripe';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';
import { getSessionFromCookie } from '../lib/session.js';
import { FREE_USAGE_LIMIT, METRIFIED_FEATURES } from '../lib/metering.js';
import { stripeClient } from '../lib/clients.js';
import { configuredFrontendUrl } from '../lib/config.js';

const router = express.Router();

// GET /usage - Get usage for current user
router.get('/usage', async (req, res) => {
  let session;
  try {
    session = await getSessionFromCookie(req);
    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
  } catch (error) {
    logger.error('usage auth error:', error);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  const usage: Record<string, { used: number; remaining: number; limit: number }> = {};

  for (const feature of METRIFIED_FEATURES) {
    const count = await prisma.usageEvent.count({
      where: { userId: session.userId, feature }
    });

    usage[feature] = {
      used: count,
      remaining: session.plan === 'pro' ? -1 : Math.max(0, FREE_USAGE_LIMIT - count),
      limit: session.plan === 'pro' ? -1 : FREE_USAGE_LIMIT
    };
  }

  return res.json({ plan: session.plan, usage });
});

// ==================== STRIPE ROUTES ====================

// POST /stripe/checkout - Create Stripe Checkout session
router.post('/stripe/checkout', async (req, res) => {
  let session;
  try {
    session = await getSessionFromCookie(req);
    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
  } catch (error) {
    logger.error('checkout auth error:', error);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  if (!stripeClient || !process.env.STRIPE_PRICE_ID) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  try {
    const checkoutSession = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],
      success_url: `${configuredFrontendUrl}/settings?subscription=success`,
      cancel_url: `${configuredFrontendUrl}/settings?subscription=canceled`,
      customer_email: session.email,
      metadata: { userId: session.userId }
    });

    return res.json({ url: checkoutSession.url });
  } catch (error) {
    logger.error('Stripe checkout error:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /stripe/webhook - Stripe webhook handler
router.post('/stripe/webhook', async (req, res) => {
  if (!stripeClient || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Webhook signature verification failed:', err);
    return res.status(400).send('Webhook signature verification failed');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (userId && session.subscription) {
          const subscription = await stripeClient.subscriptions.retrieve(session.subscription as string) as any;

          await prisma.subscription.upsert({
            where: { userId },
            update: {
              stripeSubscriptionId: subscription.id,
              plan: 'pro',
              status: subscription.status,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000)
            },
            create: {
              userId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscription.id,
              plan: 'pro',
              status: subscription.status,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000)
            }
          });

          await prisma.user.update({
            where: { id: userId },
            data: { plan: 'pro' }
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id }
        });

        if (dbSub) {
          const subData = subscription as any;
          const plan = subscription.status === 'active' ? 'pro' : 'free';
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: {
              plan,
              status: subscription.status,
              currentPeriodEnd: new Date(subData.current_period_end * 1000)
            }
          });

          await prisma.user.update({
            where: { id: dbSub.userId },
            data: { plan }
          });
        }
        break;
      }
    }

    return res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export { router as billingRouter };
