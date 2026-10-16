# Siluetra browser QA

Canonical visual platform: the immutable Ubuntu 24.04 image pinned in .github/workflows/ci.yml, Node 22.20.0, the Chromium bundled in that image and @playwright/test 1.64.0. Windows native Chromium and WSL setup: [development](../docs/development.md). Browser code and cached binaries are development-only and must stay outside dist/.

```sh
npm ci
npm run qa:install
npm run qa:browser
```

`qa:smoke` and `qa:visual` are focused subsets. Eight projects cover 1366×768, 1440×900, 1920×1080 and 1024×768 in light/dark at device scale 1. Each CI project runs on its own runner with one worker; local defaults use two workers. Contexts use fictional documents and per-project downloads, block external requests, and drive mouse/keyboard/file input/download handlers. Read-only state inspection verifies results; tests do not invoke editor commands through evaluation.

`qa/tests/editor.spec.mjs` covers shell, menus, layers, Inspector, resources, drawing, colors, panels, native export/reopen, docking, layout, cursors and focus. `qa/tests/trace.spec.mjs` covers PNG import, Vectorizar cancellation before apply, worker HTTP 200, one History entry and Undo/Redo. Processing retains the guarded-modal behavior.

Active screenshots are in qa/baselines/<viewport>-<theme>/. Compare with `npm run qa:browser` before any intentional `npm run qa:update`. Review actual/diff PNGs, error-context.md and trace.zip in qa/results/playwright/. Use the local stable runner for show-trace. Comparisons allow 1.2% changed pixels at a 0.2 color threshold; interaction assertions remain mandatory. Platform rendering differences do not authorize refreshing baselines. Screenshot helpers wait for toasts/fonts without hiding UI. They capture once (animations disabled, caret hidden, CSS scale) and compare PNG buffers with soft VISUAL assertions. A visual mismatch still fails the job but does not abort remaining interaction assertions or spend their polling budget retrying a different raster. Browser actions and screenshot capture retain hard timeouts; full workflows have a 120-second budget.

The canonical renderer is standard Playwright Chromium from the pinned image, launched with supported Playwright defaults. @sparticuz/chromium supplies only the pinned Open Sans font archive; its serverless binary and Lambda GPU flags are not used. qa/browser.mjs extracts those fonts with tar --no-same-owner. Windows uses its native Playwright installation for functional debugging. No dependency is patched and web security is not disabled. Results and browser caches are ignored.

qa/import-cycles.json is the architectural baseline. qa:validate requires no historical Git checkout.

## Installed agent skills and provenance

- Microsoft `playwright-cli`, Apache-2.0, upstream commit `b85c7a736bb473bf55b584e54a09ffa698d6d871`, source `microsoft/playwright-cli/skills/playwright-cli/`. SKILL.md, complete references and upstream license are in `.agents/skills/playwright-cli/`. CLI package 0.1.22 is development only; permanent repeatable flows use stable `@playwright/test` 1.64.0 rather than CLI's separate alpha transitive runner. Provides browser interaction, screenshot and trace guidance.
- Jakub Krehel `better-ui`, MIT (2026 Jakub Krehel), upstream commit `c0588bb6d654eb725046f0bf9deec338c34891ab`, source `jakubkrehel/skills/skills/better-ui/`. Installed SKILL.md, references, agent metadata and license in `.agents/skills/better-ui/`. Secondary visual review guide: component consistency, boundaries, radii, optical alignment, reduced motion, duplicate hover surfaces. Siluetra's Spectrum density and professional editor target take precedence over generic visual recipes.


Graphite adapter attribution remains in dist/vendor/GRAPHITE-UI-NOTICE.txt and GRAPHITE-UI-LICENSE.txt.

## Reproducing visual checks

CI is canonical; native Windows screenshots must not replace Linux baselines. The container digest pins Ubuntu userspace, fontconfig and Freetype. Chromium comes from the digest-pinned image and matches the lockfile-pinned Playwright release. Open Sans regular/bold/italic come from the lockfile-pinned @sparticuz/chromium font archive. Generated siluetra-fonts.conf points only to those extracted fonts, without system font directories; FONTCONFIG_FILE is explicit. DPR is 1, locale en-US, timezone UTC. qa/environment.mjs records browser/font hashes, library versions and metrics in the job log and qa/results/environment.json.

For local Linux or Docker Desktop (Linux containers), build and run the same userspace and Node binary:

```sh
docker build --platform linux/amd64 -f qa/Dockerfile -t siluetra-visual .
docker run --rm --platform linux/amd64 --ipc=host -v "$PWD:/work" -w /work siluetra-visual sh -lc 'npm ci && npm run qa:install && node qa/environment.mjs && npm run qa:browser'
```

Use a clean disposable checkout for the bind mount; do not share native Windows node_modules with the Linux container. No product CSS, font declarations or geometry is overridden by tests.

## Baseline review

Never update baselines in ordinary CI. Reproduce with the pinned environment, inspect expected/actual/diff images at each changed state and review the corresponding functional errors. Preserve images that still pass at 1.2% / 0.2. Only after review update the affected snapshot(s), rerun the unchanged comparison, and commit the environment provenance with them. Do not normalize away missing controls, clipped content, moved panels or incorrect garment geometry. Native debugging can use the runner's --ignore-snapshots to exercise interactions; that is not a visual pass and CI never uses it.

## Failure diagnostics

qa/collect-failures.mjs includes only actual/diff PNGs, error context, one failed trace per project and a functional-failure screenshot when no actual PNG exists. It omits expected images, HTML reports and document downloads. Upload is capped at eight files / 5 MiB per project (omissions are listed), compressed at level 9 and retained for three days. Quota/upload errors are non-blocking; the browser step remains the authoritative failure. Inspect VISUAL-labelled errors separately from interaction/capture timeouts. No upload is attempted on success.

## Accepted rendering provenance

The accepted environment is recorded in qa/baselines/environment.json and verified before CI browser tests. The standard image renderer is Chrome for Testing 156.0.8078.4. The serverless 153 renderer/launch profile stalled on Color captures after fonts loaded; the standard renderer completed all eight focused Color captures without those stalls. The old fontconfig path did not load the extracted configuration, whose AWS directories were unsuitable for the checkout.

Expected/actual/diff images from Actions run 38833206039 were reviewed: six color-popover images (1024/1366/1440, both themes) and 1024 light new-document were replaced for font metrics/rasterization only. The remaining 97 PNGs were preserved. Layout, garment geometry, gradients and controls remain present; the 1.2%/0.2 comparison limits were not increased. Ordinary CI does not update snapshots.

The wide docking workflow clicks the visible theme label rather than the center of the padded item: the center can coincide with a narrow Dockview sash at 1920px. It remains a real pointer click with theme-state assertions, without force, event dispatch or a product CSS change. This existing hit-target overlap is distinct from visual-baseline differences.
