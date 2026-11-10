# Static pages and protected live search

## Boundary

The public app is not an all-static search demo. People can still submit arbitrary queries.
The search engines, model adapters and training commands remain the same local application.

| Work | Where it runs |
| --- | --- |
| Page layout, chapter lessons and source views | Build time |
| Source-file navigation | Static JSON files |
| Scorecards, bias lesson and training report | Offline results served as static files |
| Checkpoint and cross-chapter query scores | Browser, from the static scorecard |
| Search, selected-query grading and comparison | Protected POST API |
| Catalog import, embeddings, training and full evaluation | Local machine |

`output: "static"` is the default. Each live API must explicitly opt out of prerendering.
The build rejects missing or stale evaluation results. It does not hide that problem by
starting a full evaluation inside a serverless request.

The report fingerprint uses the levels measured in the report, excluding the introduction,
which has no ranker. A host without neural artifacts can still show an authentic offline
report. That does **not** make neural search available: live search still checks its actual
model and vector prerequisites. The current repository does not ship the ignored embeddings
and model cache to Vercel. Do not mark those chapters ready without shipping their artifacts.

## Development and release

Use the existing commands:

```sh
npm run dev
npm run typecheck
npm test
```

UI and content changes do not require model training or scorecard regeneration. After changing
domain code or input data, finish the local experiment first. Before release:

```sh
# With the local dev server running:
npm run data:precompute
npm run build
```

Commit the generated report with the source/data change. Full-catalog evaluation takes several
minutes; it is not required for each local edit. The precompute endpoint remains available only
in development. The local evaluation tools can still use their existing GET APIs.

`npm run build` runs `tools/finalize-hosting.ts` automatically. On Vercel, the script checks the
static artifacts and finalizes the documented Build Output API routes. It removes Astro's
default catch-all to the function, which would otherwise run Node even for unknown bot probes.
Only `/api/search.json`, `/api/grade.json` and `/api/compare.json` route POST requests to `_render`.
The pinned BotID client's challenge and detection paths proxy directly to Vercel's BotID service
before the static fallback. They do not invoke the search function. The finalizer owns these
Build Output API routes, so protection does not depend on framework rewrite merging.
The unused Astro Actions registry was removed so it cannot provide another, unprotected entry.
Other methods receive a static 405. Unknown paths, unused framework endpoints, local tools and
direct requests to `_render` receive a static 404. A new server-rendered page fails the build
until the hosting boundary is reviewed. Do not deploy raw `astro build` output without this
post-build step; use `npm run build` or the repository's deployment workflow.

## Bot controls

1. Vercel Bot Protection in **Challenge** mode rejects suspicious non-browser traffic at the edge.
   Verified crawlers are still allowed to read static pages. This setting is external to Git.
2. Only POST can reach a live API at the CDN. `robots.txt` also asks cooperative crawlers to
   avoid API paths and query-parameter search pages; it is not a security control.
3. BotID Basic validates every hosted POST, including cache hits. The check runs before dynamic
   imports of the search application. Failed verification returns 403; an unavailable verifier
   returns 503. Neither condition starts search. There is no production bypass or paid Deep
   Analysis setting. Local Node development and standalone Node builds skip verification.
   The browser also skips Vercel's challenge script for local builds, so production-build
   smoke tests remain usable without a hosted identity service.
4. At most 64 responses are retained per warm instance, for 60 seconds, with a 100 KB payload
   limit per entry. Concurrent equal requests share work. Errors are not retained. HTTP responses
   remain `private, no-store` so shared CDN caches cannot bypass identity checks.

A POST rejected by BotID still invokes a small function. Edge protection is the layer that
can prevent that invocation. A sophisticated browser bot can pass these checks; this is not a
hard spend cap. If live POST abuse continues, add an explicit per-IP API rate limit in Vercel
after approval. An in-memory limiter is not a reliable limit across serverless instances.

Before production release, test a real browser on a Vercel preview: shared search link,
comparison, one-query grading, source deep link, Back/Forward and BotID verification. Local
tests cover the allow/deny behavior but cannot validate Vercel's hosted identity service.
The real-client integration test also loads the installed BotID SDK with a fixture challenge
and checks that it sends protected requests only after the challenge path resolves. This tests
the transport contract, not real human/bot classification.

## Investigation evidence

Read-only checks on 2026-11-09 found:

- Production logs repeatedly rejected `data/precomputed/results.json` as stale and reported
  live computation. `/api/checkpoint.json` hit the 60-second function timeout repeatedly.
- The introduction requested grades for all ready chapters at once, plus a duplicate request
  for the selected chapter. It now grades only the selected chapter and reads the comparison
  scores from the static report.
- The firewall's roughly one-day window recorded 107 `/search` requests for the search app.
  Named crawlers included Googlebot, Bytespider, Applebot, Bingbot and an SEO crawler.
- The personal website had more requests and 85 requests to `/_vercel/image` in the same window.
  Its image optimization is a separate cost source, not proof that search caused all usage.
- Bot Protection was off for both projects. It was enabled in Challenge mode on 2026-11-10
  after explicit approval, and its live configuration was read back to verify the change.

The team is on Hobby. Billing cost data was unavailable and the requested resource metrics
were gated by Observability Plus. These checks prove avoidable work, not an exact share of
the account's usage increase. No subscription upgrade was made.

## Rollback and measurement

Keep the firewall change independent from a code deployment. It can be turned off in
Vercel's Firewall → Rules → Bot Protection if it blocks legitimate traffic.

To roll back code, deploy the previous approved revision. This restores its previous runtime
cost behavior too. Do not only remove the hosting finalizer: that would restore the function
catch-all while leaving the rest of the deployment in a different configuration.

After deployment, compare function invocations, active CPU, duration, timeouts and transfer for
the same time windows in Vercel Usage, grouped by project. Compare image transformations for
the personal website separately. Verify ordinary page GETs and unknown-path requests do not
appear as function invocations, and confirm live human searches still work.
