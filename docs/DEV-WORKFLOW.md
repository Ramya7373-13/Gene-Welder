# Headroom Stack — Operator's Cheat Sheet

> Machine-specific dev workflow for the multi-agent stack on this box.
> Last verified: 2026-08-27 (Docker engine live, all MCP servers Connected).

## Mental model (read once)

Three independent layers. Two of them are **launch-time**, not prompt-time — this is
the key to "not breaking routing."

| Layer            | Address                       | What it is                                   | Backing model      |
| ---------------- | ----------------------------- | -------------------------------------------- | ------------------ |
| **Headroom**     | `127.0.0.1:8787`              | Transparent cache+optimize proxy → `agentrouter.org` | **GLM** (not Claude!) |
| **OpenDesign**   | daemon `:7456`, web `:17573`  | Design workspace + MCP engine                | —                  |
| **Docker / Strix** | —                           | Per-scan pentest sandbox, on demand          | —                  |

> ⚠️ **The one thing to internalize:** a Headroom-routed session is answered by
> **GLM**, not Claude/Opus. The *directory you launch from* decides the backend —
> not how you phrase prompts.
>
> **Auto-routed project roots:** `E:\MutationMechanic`, `E:\CropHealthMonitor`,
> `E:\Sampada-Store`, `E:\Andhbhakt`.

**Which mode, when?** — routing is the default; bypass is the deliberate exception.

| Situation                                  | Launch the terminal from            | Backend                     |
| ------------------------------------------ | ----------------------------------- | --------------------------- |
| **Normal daily development** (default)     | a project root (e.g. `E:\MutationMechanic`) | Headroom proxy → **GLM**    |
| **System troubleshooting** (exception)     | a neutral dir (e.g. `C:\Users\Binod`)       | **native Claude / Opus** (direct) |

So: open the terminal **from the project root** for everyday coding so the Headroom
proxy kicks in — and only drop to a **neutral directory** when you explicitly want to
consult native Claude/Opus about this environment setup or system troubleshooting.

### 🔄 Bypassing the Proxy (Native Claude / Opus Access)

If you need to consult with native Claude or Opus models regarding this environment
setup without routing traffic to GLM:

1. Do NOT launch the terminal from any of the 4 auto-routed project roots.
2. Open a fresh PowerShell window from a neutral directory (e.g., `C:\Users\Binod`).
3. Ensure `$env:ANTHROPIC_BASE_URL` is empty before launching `claude`.

---

## 1 · Daily start-up sequence

### Claude Code / OpenCode in a project root (canonical flow)

```powershell
# 1. Open PowerShell (auto-loads your profile: hr / hr-stop / auto-route functions)
cd E:\MutationMechanic          # ← triggers the prompt hook:
#   [hr-auto] Headroom project detected -> ANTHROPIC_BASE_URL=http://127.0.0.1:8787
#   [hr-auto] proxy warming up on 8787 (first boot ~1 min)
claude                          # routed → GLM.   (or:)   opencode
```

- **Confirm routing:** the `[hr-auto]` line printed, or
  `$env:ANTHROPIC_BASE_URL` = `http://127.0.0.1:8787`.
- **OpenCode must be launched _from inside_ the root** — it ignores the env var and
  routes only via that folder's `opencode.json` (`…:8787/v1`).
- **Route from anywhere (explicit):** `hr` starts the proxy, routes, and launches
  Claude in one shot. Forwards args, e.g. `hr --resume`.
- **Want Claude/Opus directly instead of GLM:** launch from a non-root dir
  (e.g. `C:\Users\Binod`) with no `ANTHROPIC_BASE_URL` set.

### OpenDesign Web UI

```powershell
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT="0"
corepack pnpm@10.33.2 --dir C:\Users\Binod\repos\open-design tools-dev start web --daemon-port 7456 --web-port 17573
corepack pnpm@10.33.2 --dir C:\Users\Binod\repos\open-design tools-dev status   # verify
# → open http://127.0.0.1:17573
```

Never use root `pnpm dev` / `pnpm start` — manage lifecycle **only** via `tools-dev`
(`start` is detached; `run` stays in foreground; subcommands: `start / run / status /
stop / restart / logs / inspect / check`).

---

## 2 · Prompting the agent to use the layers

### OpenDesign MCP

Just reference the live design — the tools default to your **active OD context**, so
you don't need to name the project:

- *"Using the design I have open in OpenDesign, tighten the hero spacing."*
- *"Get the OpenDesign artifact for this project and add a pricing section."*
- *"Search the OpenDesign files for `.pricing-card`."*

Precondition: daemon `:7456` up **and** `claude mcp get open-design` = Connected.
If the agent says the OD tools aren't visible → the daemon is down or the MCP link
dropped; `tools-dev restart daemon` and relaunch the session.

### Headroom

Nothing to phrase. It's transparent request routing, applies to the **whole** session,
and is chosen by cwd/env **at launch**. Don't try to toggle it mid-conversation —
change the launch directory instead.

---

## 3 · Shutdown / cleanup (kill dangling processes)

```powershell
hr-stop                         # stop Headroom proxy — REQUIRED. It's detached and
                                #   survives closing the terminal (only the env var clears).
corepack pnpm@10.33.2 --dir C:\Users\Binod\repos\open-design tools-dev stop   # daemon + web + desktop
```

**Verify clean** (both should return nothing):

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 7456,8787,17573 }
Get-Process headroom -ErrorAction SilentlyContinue
```

Strix: no daemon to stop; per-scan Docker sandboxes clean up with the run. Stray
containers → `docker ps` then `docker stop <id>`.

**Health checks:** `curl http://127.0.0.1:8787/livez` (→ 200) · `tools-dev status` ·
`claude mcp list`

---

## 🚫 Don't-break-it rules

- Don't `headroom wrap claude` — keep Headroom standalone (`hr` / auto-route only).
- Don't "fix" the `…127.0.0.1:8787/v1` in any `opencode.json` — the localhost URL is
  **intentional**, not a leak.
- Don't edit the profile's `# >>> headroom … >>>` blocks (the `zai` / `hr` / `hr-stop`
  and workspace auto-route sections) casually — that's the whole routing brain.

---

## Reference: what runs where

| Service            | Port    | Start                                   | Stop        |
| ------------------ | ------- | --------------------------------------- | ----------- |
| Headroom proxy     | `8787`  | auto on `cd` into a root, or `hr`       | `hr-stop`   |
| OpenDesign daemon  | `7456`  | `tools-dev start web`                   | `tools-dev stop` |
| OpenDesign web UI  | `17573` | `tools-dev start web`                   | `tools-dev stop` |

> Note on Strix: it is a per-target pentest agent (`strix -t <target> …`), **not** a
> standing service. It builds its Docker sandbox on demand per scan, and still needs
> `STRIX_LLM` + `LLM_API_KEY` set plus an authorized target before it will run.
