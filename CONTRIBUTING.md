# Contributing

Fork and clone your fork. Install Node 22.20.0, npm ci, then npm start. Create a branch: git switch -c describe-change.

Extend existing commands/domain semantics. Run relevant regressions plus npm test, npm run build, npm run validate and npm run qa:validate. UI/interactions require Playwright real handlers and reviewed screenshot diffs; see [development](docs/development.md).

Submit a PR with scope, why, checks and limitations, UI screenshots and dependency/asset provenance. No customer documents, caches or private hosting configuration.
