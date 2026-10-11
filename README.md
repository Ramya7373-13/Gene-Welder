# MutationMechanic

Genomics analysis workbench (frontend + Express/Prisma backend). Product notes: [backend/README.md](backend/README.md), [docs/README.md](docs/README.md).

## Agent knowledge graph (Graphify + Memory)

Global skills: `/graphify`, `/memory`, `/archify`.

- **Graphify** builds a code knowledge graph into `graphify-out/` (`graph.html`, `GRAPH_REPORT.md`, `graph.json`).
- **Archify** draws architecture diagrams as standalone HTML/SVG. It does **not** write `graphify-out/`.
- **Memory** stores a redacted, compact snapshot of that graph (not the raw JSON blob) plus optional `codebase-memory-mcp` index.

```powershell
# from this repo root
graphify update .
python C:\Users\Binod\.claude\skills\memory\scripts\memory.py save --label "MutationMechanic graph" --project-root .
python C:\Users\Binod\.claude\skills\memory\scripts\memory.py query --question "Which routes are auth-hardened?" --project-root .
python C:\Users\Binod\.claude\skills\memory\scripts\memory.py clear --project-root .
```

After a successful `/graphify .`, agents should auto-run `/memory save` with a project-named label. Secrets (`sk-`, Bearer, `.env` values) are redacted. SQLite: `%USERPROFILE%\.cache\agent-graph-memory\memory.db`.
