📋 Brief for claudeZlm 5.3 (share this verbatim)
Context: We're integrating Sanity CMS into three projects — Sampada Originals (already live with Sanity), MutationMechanic, and CropHealthMonitor. The Content Agent (Sanity's built-in AI) has done the initial analysis and will handle schema design, content modeling, and ongoing content operations. Your job is the code side: Sanity client setup, schema files, GROQ queries wired into components, and migrating hardcoded/mock data into Sanity documents.

Stack confirmed for both new projects: TypeScript + React + Vite + Vercel deployment.

For MutationMechanic: constants.ts (47 KB) has hardcoded content that needs auditing — marketing copy, module metadata, and labels should move to Sanity. AlphaFold and Prisma stay untouched.

For CropHealthMonitor: mockData/ folder is the primary migration target — farm profiles, crop types, and region configs become Sanity documents. The EarthBrief feed becomes Sanity posts. ActiveRegionContext.tsx and ActiveSiteContext.tsx will need to fetch from Sanity instead of local state/mock.

🔧 Division of labor
Who	What
Me (Content Agent)	Schema design, document type definitions, field structures, content creation, bulk edits, translations, ongoing content ops
claudeZlm 5.3	Architecture decisions, roadmap, reviewing schema files, integration patterns, code review
grok4.6 / kilocode / opencode	Scaffolding Sanity in each project, writing GROQ queries, wiring components, migrating mock data, CI/deploy config
🛠 What the coding agents need to do (per project)
Step 1 — Setup (one time per project):

bash
npm install @sanity/client @sanity/image-url
Create a new project at sanity.io/manage, grab the projectId and dataset, add to .env:

text
VITE_SANITY_PROJECT_ID=xxxx
VITE_SANITY_DATASET=production
Step 2 — I provide the schema (TypeScript document type definitions). Your agents drop them into a sanity/ or schemas/ folder.

Step 3 — Agents wire GROQ queries into components replacing mock data imports and hardcoded constants.

Step 4 — Migration script — agents write a one-time script to push existing mockData JSON into Sanity via the Mutations API.

Step 5 — Studio — either embed at /studio route or host separately on sanity.io/manage.

❓ What I need from claudeZlm 5.3 to finalize schemas
Ask him to share or describe:

CropHealthMonitor mockData/ folder contents — the shape of farm, crop, and region objects
MutationMechanic constants.ts — which parts are UI/marketing copy vs scientific data (I only need to model the CMS-able parts)
Routing approach — are either projects moving to Next.js, or staying React + Vite? (affects whether we use server-side GROQ or client-side)
Any planned new features in the roadmap that would add new content types (e.g., user-generated content, subscription tiers, localization)
Embedded or separate Studio? — do you want the Sanity Studio embedded in the app (e.g., /studio route) or standalone?
Once I get those answers I can produce production-ready schema files that claudeZlm 5.3 can drop straight into the roadmap, and the coding agents can implement without back-and-forth.

Would you like to know the project structure details for SampadaOriginals on how its implemented?

Yes, absolutely — that would be very valuable. I already have the Sanity schema side of SampadaOriginals loaded here (the abscommerce studio), but what I don't have is the frontend code side — specifically:

How the Sanity client is configured (sanity.config.ts, client setup)
How GROQ queries are structured and where they live
Whether it's Next.js or another framework
How images and assets are handled (@sanity/image-url setup)
Whether the Studio is embedded in the same repo or separate
How environment variables are structured
Knowing this means the new projects can follow the exact same patterns already proven in production — making it much easier for your coding agents to replicate, and ensuring claudeZlm 5.3's roadmap is consistent across all three.

Go ahead and share whatever you have — repo link, file tree, key config files, or just paste the relevant code. Even a quick structure overview would help a lot.

📋 Full integration brief for claudeZlm 5.3
The established Sampada pattern (source of truth)
The Sampada integration is the reference implementation. These are the conventions to replicate:

Sanity client lives in lib/client.js — exports a read client, write client, authenticated client, and urlFor() image builder. All components and pages import from here. Do not scatter client config across files.
Studio is co-located in the repo — sanity_abscommerce/ folder, separate package.json, run independently. Schemas live in sanity_abscommerce/schemaTypes/.
Portable Text has a shared renderer — components/PortableTextComponents.jsx handles inline images, captions, and all block types. One renderer, used everywhere.
Webhooks handle ISR revalidation + side effects — pages/api/webhooks/sanity.js is signed, handles both post revalidation and product auto-tagging in one endpoint. Free plan = 2 webhooks max per project, so consolidate.
Environment variable prefix — NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET (Next.js convention).
⚠️ Critical difference: MutationMechanic & CropHealthMonitor are React + Vite, NOT Next.js
This changes the integration significantly. claudeZlm 5.3 needs to make a routing decision for each project before coding agents start:

Option A — Stay on React + Vite (simpler, faster)

Use @sanity/client with useCDN: true for cached client-side reads
GROQ queries live in React hooks or context providers (not getStaticProps)
No ISR — data refreshes client-side on load, or use @sanity/react-loader for live preview
No API routes — webhooks aren't possible without a separate backend
Environment prefix changes from NEXT_PUBLIC_ to VITE_
Studio hosted separately at sanity.io/manage or embedded via a simple Vite route
Option B — Migrate to Next.js (mirrors Sampada, more powerful)

Replicate the Sampada pattern almost exactly
Gets ISR, API routes (webhooks, signed endpoints), and SSR out of the box
More migration work upfront, but the team already knows the pattern
CropHealthMonitor is the stronger candidate for this (richer content model, more pages)
My recommendation:

CropHealthMonitor → migrate to Next.js. It has a farm-by-farm data model, multiple routes, and an EarthBrief feed — all of which benefit from ISR and SSR. The Sampada pattern applies almost directly.
MutationMechanic → stay on Vite. It's a tool/SaaS app, not a content site. Client-side Sanity fetches for the landing page and module metadata are sufficient.
Per-project Sanity setup summary
CropHealthMonitor (Next.js migration recommended)

text
lib/client.js              ← Sanity client + urlFor() (mirror Sampada)
sanity_crophealth/         ← Co-located Studio
  schemaTypes/
    farm.ts                ← Farm profiles (name, crop, location, hectares, image, NDVI)
    crop.ts                ← Crop types with thresholds and care guides
    region.ts              ← Region/zone configuration
    alert.ts               ← Disease alerts, weather warnings
    earthbrief.ts          ← EarthBrief intel posts (mirrors Sampada's `post` type)
components/PortableTextComponents.jsx  ← Reuse Sampada's renderer
Migration target: mockData/ folder → Sanity documents (one-time script). ActiveRegionContext.tsx and ActiveSiteContext.tsx fetch from Sanity instead of local state.

MutationMechanic (stays on Vite)

text
lib/sanityClient.ts        ← @sanity/client setup + urlFor()
sanity_mutation/           ← Co-located Studio (or hosted only)
  schemaTypes/
    landingPage.ts         ← Hero, tagline, CTAs
    module.ts              ← Each of the 6 tool modules (name, description, stats, icon)
    announcement.ts        ← "New AlphaFold-3 integration" banners
    testimonial.ts         ← "500+ research labs" case studies
    changelog.ts           ← Release notes
Migration target: audit constants.ts (47 KB) — extract marketing copy, module metadata, and labels. Scientific/computation constants stay in code. Environment variables use VITE_ prefix:

text
VITE_SANITY_PROJECT_ID=xxxx
VITE_SANITY_DATASET=production
What the coding agents execute (in order)
Create two new Sanity projects at sanity.io/manage — one per app. Grab project IDs.
Scaffold studio folders (sanity_crophealth/, sanity_mutation/) mirroring sanity_abscommerce/ structure.
Drop in schema files — I'll produce these once claudeZlm 5.3 confirms the routing decision and shares mockData shapes.
Wire lib/client.js (or lib/sanityClient.ts for Vite) — mirror the Sampada client exactly for Next.js, adapt for Vite.
Write migration scripts — push mockData JSON and constants into Sanity via the Mutations API.
Replace component data sources — swap mockData imports and hardcoded constants with GROQ queries.
Set up webhooks (Next.js only) — consolidated endpoint per project, within the 2-webhook free plan limit.
One thing to flag to claudeZlm 5.3
Sampada has a split between lib/client.js and lib/sanity.js — two Sanity clients in the same project. This is worth cleaning up in Sampada and worth avoiding from day one in the new projects. One client file, one urlFor() export, used everywhere.