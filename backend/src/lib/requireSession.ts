// Shared session gate for routers that must reject unauthenticated callers.
// Attaches the resolved DBSession on res.locals.session for handlers that need
// the acting user (never trust body/query userId).

import type { NextFunction, Request, Response } from 'express';
import { getSessionFromCookie, type DBSession } from './session.js';

export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await getSessionFromCookie(req);
    if (!session) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    res.locals.session = session as DBSession;
    next();
  } catch (error) {
    next(error);
  }
}
