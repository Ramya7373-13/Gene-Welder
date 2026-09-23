// Frontend origin configuration, shared by the CORS middleware and any route
// that needs to build an absolute URL back to the app (e.g. magic links).

export const configuredFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

export const isAllowedFrontendOrigin = (origin?: string) => {
  if (!origin) return true;
  if (origin === configuredFrontendUrl) return true;
  try {
    const parsed = new URL(origin);
    return parsed.hostname === 'localhost' && parsed.protocol === 'http:';
  } catch {
    return false;
  }
};
