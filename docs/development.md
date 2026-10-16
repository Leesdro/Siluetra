# Development

Use Node 22.20.0 (.nvmrc) and npm. npm ci, then npm start; open http://127.0.0.1:4173. Stop with Ctrl+C. Build only regenerates UI vendor dependencies/notices.

Run npm test, npm run build, npm run validate, npm run qa:validate. No Git history or hosting ID needed. Owner-only .openai/ is ignored; validate:owner requires SILUETRA_HOSTING_PROJECT_ID and is not in CI.

Official visual QA uses the digest-pinned Ubuntu container and Node 22.20.0 in .github/workflows/ci.yml. qa/Dockerfile reproduces that userspace and exact Node binary. npm run qa:install then npm run qa:browser. qa:smoke / qa:visual are subsets. Review screenshots/diffs/traces in qa/results before intentional qa:update; never refresh to hide platform differences.

Windows: `node node_modules/@playwright/test/cli.js install chromium`, then scripts use native Chromium. Official visual comparisons use the pinned container or CI, including from WSL/Docker Desktop. A plain host Linux installation may have different font libraries. Never share Windows node_modules with Linux. See [workflow](../qa/WORKFLOW.md).

scripts/profile-* measure domain workloads; verify-* check vendor integration; polygonize-spike is retained experimental tooling.
