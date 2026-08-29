/**
 * System Configuration, Feature Flags & API Health Service
 * Manages runtime execution modes (Live API vs Forced Offline Demo),
 * feature flags, and lightweight non-intrusive service health polling.
 */

export interface ServiceHealth {
  gemini: { status: 'ok' | 'unconfigured' | 'error'; model?: string; latencyMs?: number };
  alphamissense: { status: 'ok' | 'error'; source?: string };
  spliceai: { status: 'ok' | 'error'; source?: string; rateLimit?: string };
  alphafold: { status: 'ok' | 'error'; source?: string };
  database: { status: 'ok' | 'unavailable' };
  overallLatencyMs: number;
  lastChecked: number;
}

export interface FeatureFlags {
  enableAlphaMissense: boolean;
  enableSpliceAI: boolean;
  enableAlphaFold: boolean;
  enableRateLimiting: boolean;
  reduceAnimations: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  enableAlphaMissense: true,
  enableSpliceAI: true,
  enableAlphaFold: true,
  enableRateLimiting: true,
  reduceAnimations: false
};

const STORAGE_KEYS = {
  FORCED_OFFLINE: 'mutationMechanic_forced_offline',
  FEATURE_FLAGS: 'mutationMechanic_feature_flags'
};

class ConfigService {
  private healthCache: ServiceHealth | null = null;
  private lastHealthCheckTime = 0;
  private HEALTH_CACHE_TTL = 45000; // 45 seconds

  /**
   * Check if user explicitly enabled Forced Offline / Demo Mode
   */
  isForcedOffline(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEYS.FORCED_OFFLINE) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Set Forced Offline / Demo Mode
   */
  setForcedOffline(offline: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEYS.FORCED_OFFLINE, offline ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to save offline preference:', e);
    }
  }

  /**
   * Get all active feature flags
   */
  getFeatureFlags(): FeatureFlags {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FEATURE_FLAGS);
      if (saved) return { ...DEFAULT_FLAGS, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Failed to parse feature flags:', e);
    }
    return DEFAULT_FLAGS;
  }

  /**
   * Update a specific feature flag
   */
  setFeatureFlag(flag: keyof FeatureFlags, value: boolean): FeatureFlags {
    const current = this.getFeatureFlags();
    const updated = { ...current, [flag]: value };
    try {
      localStorage.setItem(STORAGE_KEYS.FEATURE_FLAGS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save feature flags:', e);
    }
    return updated;
  }

  /**
   * Lightweight health check against backend /api/health
   * Never calls external scoring APIs directly, preventing rate limit consumption.
   */
  async checkHealth(force = false): Promise<ServiceHealth> {
    const now = Date.now();
    if (!force && this.healthCache && now - this.lastHealthCheckTime < this.HEALTH_CACHE_TTL) {
      return this.healthCache;
    }

    const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:5000';
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const response = await fetch(`${backendUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      if (response.ok) {
        const data = await response.json();
        const health: ServiceHealth = {
          gemini: {
            status: data.services?.gemini?.status === 'ok' ? 'ok' : 'unconfigured',
            model: data.services?.gemini?.model,
            latencyMs
          },
          alphamissense: {
            status: data.services?.alphamissense?.status === 'ok' ? 'ok' : 'error',
            source: data.services?.alphamissense?.source
          },
          spliceai: {
            status: data.services?.spliceai?.status === 'ok' ? 'ok' : 'error',
            source: data.services?.spliceai?.source,
            rateLimit: data.services?.spliceai?.rateLimit
          },
          alphafold: {
            status: data.services?.alphafold?.status === 'ok' ? 'ok' : 'error',
            source: data.services?.alphafold?.source
          },
          database: {
            status: data.db === 'ok' ? 'ok' : 'unavailable'
          },
          overallLatencyMs: latencyMs,
          lastChecked: now
        };

        this.healthCache = health;
        this.lastHealthCheckTime = now;
        return health;
      }
    } catch (err) {
      console.warn('Health check ping failed:', err);
    }

    const fallbackHealth: ServiceHealth = {
      gemini: { status: 'error' },
      alphamissense: { status: 'ok', source: 'Curated Catalog' },
      spliceai: { status: 'ok', source: 'Precomputed Catalog' },
      alphafold: { status: 'ok', source: 'ESMAtlas' },
      database: { status: 'unavailable' },
      overallLatencyMs: 0,
      lastChecked: now
    };
    this.healthCache = fallbackHealth;
    this.lastHealthCheckTime = now;
    return fallbackHealth;
  }
}

export const configService = new ConfigService();
