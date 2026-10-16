# Siluetra development

Visual garment flats, not manufacturing CAD. Preserve modular commands, garment/native formats, stable geometry IDs and Undo/Redo.

dist/ is source and static runtime; ui/ builds vendor UI only. Domain geometry/document services remain authoritative. See docs/architecture/README.md.

Route work to .agents/skills/: siluetra-architecture for boundaries, siluetra-feature-development for features, siluetra-debugging for defects, siluetra-qa for checks. Browser work reads playwright-cli/SKILL.md and qa/WORKFLOW.md. Better UI is secondary to Spectrum, Dockview and editor density.

Run npm test with real count, build, validate and qa:validate. UI/interactions require qa:browser, real flows and reviewed diffs; qa:update only for reviewed intentional changes. Preserve active baselines and skill/vendor licenses.

Use fictional QA documents and block external requests. Keep caches/results/dev dependencies out of dist/releases. Public checks require neither private hosting nor old Git history.
