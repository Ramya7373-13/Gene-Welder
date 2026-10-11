MISSION CONTINUATION DIRECTIVE
4
 
5
Current Status
6
- Phase H: COMPLETE
7
- Phase I: COMPLETE
8
- All gates green.
9
- Repository considered stable.
10
 
11
Primary Objective
12
 
13
Identify and execute the highest-value remaining work in MutationMechanic using:
14
1. Repository evidence
15
2. Existing skill library
16
3. Existing tooling
17
4. Existing architectural direction
18
 
19
Do not start implementation until both a repository audit and skill audit are complete.
20
 
21
====================================================================
22
STAGE 1 — SKILL DISCOVERY (MANDATORY)
23
====================================================================
24
 
25
Before planning or coding:
26
 
27
1. Enumerate every available skill.
28
2. Read the description of every relevant skill.
29
3. Categorize skills by:
30
 
31
- Architecture
32
- Refactoring
33
- Testing
34
- Playwright
35
- Backend
36
- API
37
- Prisma
38
- Documentation
39
- Performance
40
- Security
41
- Reliability
42
- Code Quality
43
- UX/UI
44
- Observability
45
- DevOps
46
- Research
47
- Auditing
48
 
49
4. Produce:
50
 
51
SKILL INVENTORY REPORT
52
 
53
For each relevant skill:
54
- Name
55
- Purpose
56
- Strengths
57
- Weaknesses
58
- Recommended uses
59
- Relevant repository targets
60
 
61
5. Determine:
62
 
63
BEST SKILL COMBINATIONS
64
 
65
Examples:
66
- Architecture + Refactoring
67
- API + Testing
68
- Audit + Reliability
69
- Observability + Backend
70
 
71
6. Recommend the strongest skill stack for the next phase.
72
 
73
No implementation before this report.
74
 
75
====================================================================
76
STAGE 2 — REPOSITORY AUDIT
77
====================================================================
78
 
79
Perform a full evidence-based audit.
80
 
81
Find:
82
 
83
- TODO
84
- FIXME
85
- HACK
86
- XXX
87
- PLACEHOLDER
88
- STUB
89
- mock-only flows
90
- unfinished endpoints
91
- dead code
92
- skipped tests
93
- weak assertions
94
- undocumented contracts
95
- missing E2E coverage
96
- performance bottlenecks
97
- security concerns
98
- observability gaps
99
- architecture inconsistencies
100
 
101
Produce:
102
 
103
REPOSITORY AUDIT REPORT
104
 
105
For each finding:
106
 
107
- evidence
108
- severity
109
- files
110
- risk
111
- repair complexity
112
 
113
====================================================================
114
STAGE 3 — NEXT PHASE DISCOVERY
115
====================================================================
116
 
117
Using:
118
 
119
- skill inventory
120
- repository audit
121
- existing architecture
122
 
123
Generate candidate phases.
124
 
125
For each:
126
 
127
- name
128
- objective
129
- acceptance criteria
130
- deliverables
131
- risk
132
- effort
133
- expected value
134
 
135
Rank candidates.
136
 
137
Recommend ONE.
138
 
139
====================================================================
140
STAGE 4 — IMPLEMENTATION
141
====================================================================
142
 
143
Only start after the recommendation.
144
 
145
Requirements:
146
 
147
- use the best matching skill stack
148
- fix root causes
149
- preserve green tests
150
- preserve deterministic behavior
151
- document decisions
152
 
153
====================================================================
154
GATES
155
====================================================================
156
 
157
Minimum:
158
 
159
- backend tsc --noEmit
160
- root tsc --noEmit
161
- backend build
162
- affected Jest tests
163
- affected Playwright tests
164
- lint touched files
165
 
166
Report exact exit codes.
167
 
168
====================================================================
169
COMPLETION REPORT
170
====================================================================
171
 
172
Must contain:
173
 
174
1. Skill inventory
175
2. Repository audit
176
3. Selected phase
177
4. Acceptance criteria mapping
178
5. Files modified
179
6. Files created
180
7. Gate results
181
8. Exit codes
182
9. Remaining risks
183
10. Recommended next phase
184
 
185
====================================================================
186
COMMIT RULES
187
====================================================================
188
 
189
- Explicit git add paths only
190
- No git add -A
191
- No partial staging
192
- Conventional commit message
193
 
194
====================================================================
195
STOP CONDITION
196
====================================================================
197
 
198
If repository evidence does not justify additional implementation:
199
 
200
STOP.
201
 
202
Provide:
203
 
204
- Skill inventory
205
- Audit report
206
- Reasons for stopping
207
- Recommended future work
208
 
209
Do not invent work.