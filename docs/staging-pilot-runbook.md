# AI Runtime Staging Pilot Runbook

This runbook is the final operational step after local checks pass. It does not change feature flags automatically.

## Prepare

1. Provide a staging `DATABASE_URL` and run migrations plus verification:

   `npm run db:setup && npm run db:verify`

2. Assemble 12–20 anonymized tender packs and SME labels using the golden benchmark contract:

   `node server/scripts/validateGoldenBenchmark.js <manifest.json>`

3. Run `npm run pilot:readiness` and require a passing result.

## Compare

Run the same packs through legacy and v2, export normalized metric reports, then compare:

`npm run benchmark:runtime-comparison -- <legacy-report.json> <v2-report.json>`

The v2 report must meet the thresholds in `server/ai-runtime/evaluation/runtimeComparison.js`, and SME preference must be at least 80%.

## Pilot and rollback

Enable `ai_runtime_v2_enabled` for internal pilot users through the runtime settings UI. Keep `ai_runtime_v2_shadow_mode` available and leave the legacy runtime selectable. If a critical regression appears, disable the v2 flag and preserve the run reports for diagnosis.

Only after one release window without critical regressions should v2 become the default and obsolete legacy routing be removed.
