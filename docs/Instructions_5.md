Phase I is accepted as COMPLETE based on the reported evidence, green gates, runtime verification, Playwright success, and documentation updates.
2
 
3
Before moving to the next phase, perform the final Phase I close-out checklist:
4
 
5
1. Repository Hygiene
6
- Delete:
7
- backend/probe-db.cjs
8
- backend/probe-run-status.cjs
9
- backend/tsc-errors.txt
10
- Delete backend/backend-restart.log after the running backend is stopped.
11
- Confirm no temporary debugging artifacts remain in the commit.
12
 
13
2. Final Verification
14
Re-run only if needed for confirmation:
15
- backend npx tsc --noEmit
16
- backend npm run build
17
- root npx tsc --noEmit
18
- Playwright suite
19
- backend npm test
20
 
21
Record the exact exit codes in the completion report.
22
 
23
3. Documentation Validation
24
Verify:
25
- docs/phase-i-plan.md
26
- docs/phase-i-rebaseline.md
27
- docs/Phase I Completion Report.md
28
 
29
include:
30
- acceptance criteria mapping
31
- exact commands executed
32
- exact exit codes
33
- files created
34
- files modified
35
- ledger API contract
36
- session-fixture design
37
- rationale for mock worker registration
38
- rationale for eslint gate modernization
39
- known risks
40
 
41
4. Commit Preparation
42
Follow repository rules:
43
- git add explicit file paths only
44
- no git add -A
45
- no partial staging
46
- commit message should be short and conventional
47
 
48
5. Phase H + Phase I Handover
49
Produce a concise handoff containing:
50
- completed work summary
51
- final gate results
52
- all files changed
53
- remaining risks
54
- observations:
55
- 0024 runtime traced healthy; payload mismatch caused false diagnosis
56
- 0026 ledger hash shape parity
57
- 0027 eslint flat-config/version pinning
58
 
59
6. Then Begin Next Phase
60
Read docs/Instructions_4.md and identify the next phase after Phase I.
61
Do not assume the phase name or acceptance criteria.
62
Extract the next phase requirements directly from the source document.
63
Produce:
64
- phase objective
65
- acceptance criteria
66
- implementation plan
67
- risks
68
- files likely to be touched
69
- recommended first concrete task
70
 
71
Important:
72
- Do not rewrite any green Phase I functionality.
73
- Do not introduce additional features.
74
- Use repository evidence only.
75
- The first deliverable after close-out is the next-phase planning report sourced directly from Instructions_4.md.