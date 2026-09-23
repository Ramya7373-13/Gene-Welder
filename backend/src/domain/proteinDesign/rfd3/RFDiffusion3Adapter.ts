// RFDiffusion3Adapter — compatibility facade.
//
// Phase 1 shipped a mock-only adapter under this name (imported by
// DesignService and re-exported from the domain index). The mock logic now
// lives in ./mockGeneration.js and the real engine in
// ./RFDiffusion3ExecutionAdapter.js. This module keeps the historical symbol
// working as a thin alias so existing imports and consumers keep functioning
// unchanged — but constructing it now yields the environment-driven engine
// (mock by default), not a mock-only class.

export { RFDiffusion3ExecutionAdapter as RFDiffusion3Adapter } from './RFDiffusion3ExecutionAdapter.js';
export { RFDiffusion3ExecutionAdapter } from './RFDiffusion3ExecutionAdapter.js';
export type { ExecutionConfig, ExecutionMode } from './executionModes.js';