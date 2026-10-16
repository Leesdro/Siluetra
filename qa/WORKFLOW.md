# Siluetra browser QA

Official platform: Linux x64, Ubuntu 24.04 and Node 22.20.0. Windows native Chromium and WSL setup: [development](../docs/development.md). Browser code and cached binaries are development-only and must stay outside dist/.

```sh
npm ci
npm run qa:install
npm run qa:browser
```

`qa:smoke` and `qa:visual` are focused subsets. Eight projects cover 1366×768, 1440×900, 1920×1080 and 1024×768 in light/dark at device scale 1. Two isolated workers use fictional documents and per-project downloads, block external requests, and drive mouse/keyboard/file input/download handlers. Read-only state inspection verifies results; tests do not invoke editor commands through evaluation.

`qa/tests/editor.spec.mjs` covers shell, menus, layers, Inspector, resources, drawing, colors, panels, native export/reopen, docking, layout, cursors and focus. `qa/tests/trace.spec.mjs` covers PNG import, Vectorizar cancellation before apply, worker HTTP 200, one History entry and Undo/Redo. Processing retains the guarded-modal behavior.

Active screenshots are in qa/baselines/<viewport>-<theme>/. Compare with `npm run qa:browser` before any intentional `npm run qa:update`. Review actual/diff PNGs, error-context.md and trace.zip in qa/results/playwright/. Use the local stable runner for show-trace. Comparisons allow 1.2% changed pixels at a 0.2 color threshold; interaction assertions remain mandatory. Platform rendering differences do not authorize refreshing baselines. Screenshot helpers wait for toasts without hiding UI.

The pinned MIT @sparticuz/chromium package supplies Linux Chromium and libraries. qa/browser.mjs extracts Brotli archives with tar --no-same-owner and retains scrollbars; native Windows uses Playwright Chromium instead. It does not patch dependencies or disable web security. Results and browser caches are ignored.

qa/import-cycles.json is the architectural baseline. qa:validate requires no historical Git checkout.

## Installed agent skills and provenance

- Microsoft `playwright-cli`, Apache-2.0, upstream commit `b85c7a736bb473bf55b584e54a09ffa698d6d871`, source `microsoft/playwright-cli/skills/playwright-cli/`. SKILL.md, complete references and upstream license are in `.agents/skills/playwright-cli/`. CLI package 0.1.22 is development only; permanent repeatable flows use stable `@playwright/test` 1.64.0 rather than CLI's separate alpha transitive runner. Provides browser interaction, screenshot and trace guidance.
- Jakub Krehel `better-ui`, MIT (2026 Jakub Krehel), upstream commit `c0588bb6d654eb725046f0bf9deec338c34891ab`, source `jakubkrehel/skills/skills/better-ui/`. Installed SKILL.md, references, agent metadata and license in `.agents/skills/better-ui/`. Secondary visual review guide: component consistency, boundaries, radii, optical alignment, reduced motion, duplicate hover surfaces. Siluetra's Spectrum density and professional editor target take precedence over generic visual recipes.


Graphite adapter attribution remains in dist/vendor/GRAPHITE-UI-NOTICE.txt and GRAPHITE-UI-LICENSE.txt.
