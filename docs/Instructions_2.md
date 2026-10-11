You are working inside the MutationMechanic repository.
2
 
3
Before coding:
4
 
5
1. Read:
6
docs/The MutationMechanic × RFdiffusion3.md
7
 
8
2. Analyze the entire repository structure.
9
 
10
3. Generate a gap-analysis documenting:
11
 
12
- Existing capabilities
13
- Missing capabilities
14
- Components that can be reused
15
- New modules required
16
- API routes required
17
- Database schema changes required
18
- UI screens required
19
- MCP tools required
20
 
21
4. Then implement the architecture described below.
22
 
23
====================================================
24
OBJECTIVE
25
====================================================
26
 
27
Transform MutationMechanic from:
28
 
29
Variant Interpretation Platform
30
 
31
into:
32
 
33
Variant-to-Intervention Design Platform
34
 
35
using RFdiffusion3 as the molecular design engine.
36
 
37
Do NOT remove existing functionality.
38
 
39
Extend existing architecture cleanly.
40
 
41
====================================================
42
PHASE 1
43
DESIGN STUDIO
44
====================================================
45
 
46
Create a new major tab:
47
 
48
Design Studio
49
 
50
Add to App.tsx navigation.
51
 
52
Purpose:
53
 
54
Generate therapeutic intervention concepts
55
from variants and structural findings.
56
 
57
Support workflows:
58
 
59
1. Binder Design
60
2. Stabilizer Design
61
3. DNA Binder Design
62
4. Enzyme Rescue Design
63
5. Protein Scaffold Design
64
 
65
====================================================
66
FRONTEND
67
====================================================
68
 
69
Create:
70
 
71
components/DesignStudio/
72
 
73
Inside:
74
 
75
DesignStudioTab.tsx
76
 
77
Submodules:
78
 
79
BinderDesigner.tsx
80
StabilizerDesigner.tsx
81
DnaBinderDesigner.tsx
82
EnzymeDesigner.tsx
83
DesignHistory.tsx
84
DesignResultsViewer.tsx
85
DesignMetricsPanel.tsx
86
 
87
Features:
88
 
89
- Variant selector
90
- Gene search
91
- Structure upload
92
- PDB viewer
93
- Design objectives
94
- Constraint editor
95
- RFD3 mode selection
96
- Design history
97
- Run status monitoring
98
 
99
Use existing design system theme.
100
 
101
====================================================
102
DATABASE
103
====================================================
104
 
105
Create Prisma models:
106
 
107
DesignProject
108
DesignRun
109
DesignCandidate
110
DesignConstraint
111
ValidationResult
112
 
113
Store:
114
 
115
input variant
116
target protein
117
design mode
118
parameters
119
metrics
120
candidate structures
121
status
122
audit information
123
 
124
====================================================
125
BACKEND
126
====================================================
127
 
128
Create routes:
129
 
130
/api/design
131
 
132
/api/design/projects
133
/api/design/runs
134
/api/design/candidates
135
/api/design/validate
136
 
137
====================================================
138
RFD3 ORCHESTRATION LAYER
139
====================================================
140
 
141
Create:
142
 
143
backend/src/domain/proteinDesign
144
 
145
Modules:
146
 
147
rfd3
148
mpnn
149
validation
150
ranking
151
provenance
152
 
153
Structure:
154
 
155
proteinDesign/
156
├── rfd3/
157
├── mpnn/
158
├── validation/
159
├── ranking/
160
├── provenance/
161
 
162
====================================================
163
RFDIFFUSION3 INTEGRATION
164
====================================================
165
 
166
Build adapter architecture.
167
 
168
Never call repository code directly from routes.
169
 
170
Create:
171
 
172
RFDiffusion3Adapter
173
 
174
Capabilities:
175
 
176
generateBinder()
177
 
178
generateDnaBinder()
179
 
180
generateScaffold()
181
 
182
generateSymmetricAssembly()
183
 
184
generateMotifScaffold()
185
 
186
All jobs must run asynchronously.
187
 
188
====================================================
189
JOB SYSTEM
190
====================================================
191
 
192
Create queue-based execution.
193
 
194
Design states:
195
 
196
QUEUED
197
RUNNING
198
VALIDATING
199
COMPLETED
200
FAILED
201
 
202
Support future GPU workers.
203
 
204
====================================================
205
VARIANT -> DESIGN TRANSLATION LAYER
206
====================================================
207
 
208
Implement:
209
 
210
VariantConditioningEngine
211
 
212
Input:
213
 
214
HGVS variant
215
protein structure
216
mutation impact data
217
 
218
Output:
219
 
220
RFD3 constraints
221
 
222
Examples:
223
 
224
hotspot residues
225
 
226
burial depth requirements
227
 
228
hydrogen bond constraints
229
 
230
target interface regions
231
 
232
This layer is strategic IP.
233
 
234
Design it as a dedicated service.
235
 
236
====================================================
237
VALIDATION LAYER
238
====================================================
239
 
240
Create:
241
 
242
DesignValidationEngine
243
 
244
Responsibilities:
245
 
246
AF validation
247
 
248
interface scoring
249
 
250
geometry compliance
251
 
252
constraint satisfaction
253
 
254
design diversity
255
 
256
candidate ranking
257
 
258
Provide composite score.
259
 
260
====================================================
261
NEW MCP TOOLS
262
====================================================
263
 
264
Expose MCP servers:
265
 
266
variant_analyze
267
 
268
structure_model
269
 
270
design_binders
271
 
272
design_stabilizer
273
 
274
design_dna_binder
275
 
276
inverse_fold
277
 
278
validate_design
279
 
280
rank_designs
281
 
282
Each MCP tool must support JSON input/output.
283
 
284
====================================================
285
ANALYTICS
286
====================================================
287
 
288
Add Design Analytics dashboard.
289
 
290
Track:
291
 
292
success rates
293
 
294
candidate generation
295
 
296
top genes
297
 
298
common variants
299
 
300
validation metrics
301
 
302
run durations
303
 
304
====================================================
305
DESIGN LEDGER
306
====================================================
307
 
308
Create immutable audit trail.
309
 
310
Store:
311
 
312
model version
313
 
314
weights hash
315
 
316
seed
317
 
318
input constraints
319
 
320
user
321
 
322
timestamp
323
 
324
validation metrics
325
 
326
Every design must be reproducible.
327
 
328
====================================================
329
PHASE 2
330
MOONSHOT CAPABILITIES
331
====================================================
332
 
333
Do NOT fully implement.
334
 
335
Create placeholders and architecture for:
336
 
337
Variant-to-Cure Compiler
338
 
339
Resistance Weather Service
340
 
341
Pharmacological Chaperone Foundry
342
 
343
N-of-1 Design Engine
344
 
345
Evolutionary Trap Simulator
346
 
347
Create feature flags.
348
 
349
====================================================
350
CODE QUALITY
351
====================================================
352
 
353
Requirements:
354
 
355
TypeScript strict mode
356
 
357
Reusable services
358
 
359
Repository pattern where reasonable
360
 
361
Full API typing
362
 
363
Vitest tests
364
 
365
Jest tests
366
 
367
No duplication
368
 
369
Modular design
370
 
371
====================================================
372
DELIVERABLES
373
====================================================
374
 
375
1. Architecture document
376
2. Gap analysis
377
3. Prisma migrations
378
4. Backend endpoints
379
5. Frontend Design Studio
380
6. MCP integration layer
381
7. RFdiffusion3 adapter architecture
382
8. Validation engine
383
9. Analytics integration
384
10. Pull-request-ready implementation
385
 
386
Provide progress log while developing.