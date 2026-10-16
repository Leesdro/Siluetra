# Panel boundary contact

`dist/panel-cut.js` provides `resolvePanelCut` for validation, live preview, existing-path conversion, panel creation, derived-region evaluation and the compatibility `splitPanel` entry. Boundary crossings and endpoint contacts must enclose an interior arc. Regions join that arc to actual boundary routes and clip against the filled contours. Editable sources remain Bézier; overshoots are trimmed by subdivision and saved endpoints projected to the boundary.

## Tolerances and interaction

Geometry epsilon is 0.005 document pixels. User snapping is 6 screen pixels divided by zoom. Curves flatten adaptively to an error below one quarter of geometry epsilon; closest points refine actual cubic parameters. Polygon output is quantized to 0.001 document pixels by the existing Clipper implementation.

Line/Pencil/Pen endpoints and attached endpoint drags use the boundary query. Small green markers show connected endpoints; unresolved endpoints show orange markers. Drafts show region tints as soon as the cut resolves. Creation uses the same result rather than a separate UI-only validity check. Existing selected paths get the same geometry rules and feedback. Short interior paths can explicitly use **Extender al contorno**; that operation moves the real semantic endpoints to the contour. Outside and tangent-only cuts remain invalid.

## Ownership and persistence

The native document persists each `BoundaryAnchor` with endpoint, piece ID, stable boundary segment ID, Bézier position and subpath. Base transforms and boundary edits re-evaluate these anchors before region generation; existing region IDs and fills remain stable while topology is unchanged. Endpoint editing updates anchors or marks detached endpoints instead of forcing old coordinates back onto a drag.

Mirror projection remaps anchor piece IDs and, for centered shared owners, resolves the corresponding reflected boundary position. Graph cloning remaps both piece and segment references. Valid legacy panel cuts acquire anchors during migration; invalid old paths are not assigned guessed attachments. Creation and an endpoint drag each use their existing single History transaction.

## Verification

Run `npm test` and `npm run validate`. Coverage includes exact/near contacts, overshoot trimming, corner deduplication, invalid tangent/outside cuts, explicit extension, cubic geometry, read-only preview, anchors, transforms, persistence, mirror/clone references, migration and Undo/Redo.

For browser interaction changes run the real panel workflow in `qa/tests/editor.spec.mjs` and review screenshots using [QA workflow](../../qa/WORKFLOW.md). Unit/vector checks alone do not establish browser correctness.
