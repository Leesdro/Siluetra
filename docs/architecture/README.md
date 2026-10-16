# Architecture

index.html → desktop-entry.js → app.js composes editor factories then binds commands. Spectrum bridge adapts controls; Dockview manages docking. dist/ is source AND static runtime; ui/dependencies.js builds vendor UI only.

Domain owns documents, migrations, garment semantics and geometry. Editor controllers receive state and mutable services in composition order. Use session/document commands, preview rollback and History; gestures commit once. Preserve native JSON, stable node/edge IDs, instances and panel ownership. IndexedDB stores projects; localStorage stores preferences.

Clipper, Paper and Turf have distinct geometry roles. Preserve adapters, numeric limits and notices. Graphite is a small UI adaptation, not its engine.

## Technical debt retained

Large interaction.js, commands.js and bindings.js need targeted future work, not a rewrite. Shared services have implicit initialization contracts. Bindings lacks full symmetric teardown; current page initializes once. advanced-vector.js has tests but uncertain supported UI scope; retain pending support decision.

qa/import-cycles.json records four approved simple cycles in three engine groups: core/Bézier, core/appearance and model/panels/edge-panels/hit (with a second route through visual-regions). No editor cycles allowed. Do not expand the baseline to hide regressions.

