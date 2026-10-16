// Adapted from Graphite 1f1cab1b21ec1333f5df1ce4e9db6af80e1930da:
// frontend/src/components/window/PanelSubdivision.svelte (document split shares)
// frontend/src/components/widgets/buttons/IconButton.svelte (conditional classes)
// MIT; full attribution and license: vendor/GRAPHITE-UI-NOTICE.txt.
export const MIN_PANEL_SIZE = 100;
export const DOCUMENT_PANEL_SHARE = 0.8;
export const EQUAL_PANEL_SHARE = 0.5;
export function panelShare(previousHasDocument, nextHasDocument) {
  if (previousHasDocument && !nextHasDocument) return DOCUMENT_PANEL_SHARE;
  if (!previousHasDocument && nextHasDocument) return 1 - DOCUMENT_PANEL_SHARE;
  return EQUAL_PANEL_SHARE;
}
export function activeClassNames(classes) {
  return Object.entries(classes)
    .flatMap(([className, stateName]) => (stateName ? [className] : []))
    .join(" ");
}
