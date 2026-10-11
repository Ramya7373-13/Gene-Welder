# Skill Observation Log

Observations captured during task-oriented work.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = skill
updated/created | DECLINED (YYYY-MM-DD) = user decided not to pursue —
resolved statuses always carry their resolution date

---


## 2026-09-06

### Observation 1: Private GitHub merge needs Playwright fallback when agent-browser has no login

**Status:** OPEN
**Date:** 2026-09-06
**Session context:** Create and merge PR #9 for feat/auth-harden-m0-routes
**Skill:** agent-browser
**Type:** open-source
**Phase/Area:** Authenticated GitHub UI merge

**Issue:** agent-browser opened a private GitHub PR URL without a saved auth profile and landed on GitHub's "Page not found" (no interactive elements). Playwright MCP already had a persisted GitHub login from the prior PR #8 merge, so the merge UI was reachable there.

**Suggested improvement:** In the GitHub UI merge path, treat an unauthenticated 404/login wall as a hard fallback trigger to Playwright (or a named session with saved GitHub state) before retrying clicks. Document that private repos look like 404 when logged out.

**Principle:** For private-site UI automation, verify an authenticated session (page title/URL, not just HTTP open success) before interacting; a 404 on a known-good private URL is usually missing login, not a missing page.

### Observation 2: Do not copy auth test cookie-secret defaults blindly

**Status:** OPEN
**Date:** 2026-09-06
**Session context:** Auth-harden GET /api/analyses/:id tests
**Skill:** test-driven-development
**Type:** internal
**Phase/Area:** Session cookie test helpers

**Issue:** auth.test.ts makeSignedCookie defaults to `dev-secret-change-in-production`, but server.ts signSession/verify uses `SESSION_SECRET || 'dev-only-secret-never-in-production'`. Existing 401 tests still pass with a mismatched HMAC because a bad signature also yields 401. Authenticated (200/404/500) tests would silently fail the session check if the helper were copied as-is.

**Suggested improvement:** When adding signed-cookie helpers, match the production verifier's secret source exactly; treat 401-only tests as insufficient proof that the cookie is valid.

**Principle:** A test that only asserts 401 cannot prove the session cookie was signed with the server's secret — use the same fallback string the verifier uses, or the success path will 401 for the wrong reason.
