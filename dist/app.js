import { createEditorState } from "./editor/state.js";
import { bindEditorUI } from "./editor/bindings.js";
import { createSessionController } from "./editor/session.js";
import { createDocumentsController } from "./editor/documents.js";
import { createCanvasController } from "./editor/canvas.js";
import { createSelectionController } from "./editor/selection.js";
import { createInspectorController } from "./editor/inspector.js";
import { createCommandsController } from "./editor/commands.js";
import { createInteractionController } from "./editor/interaction.js";
import { createPanelsController } from "./editor/panels.js";
import { createConstructionController } from "./editor/construction.js";
import { createWorkspaceController } from "./editor/workspace.js";
import { createAppearanceController } from "./editor/appearance.js";

const state = createEditorState();
const editor = {};
Object.assign(editor, createSessionController(state, editor));
Object.assign(editor, createDocumentsController(state, editor));
Object.assign(editor, createCanvasController(state, editor));
Object.assign(editor, createSelectionController(state, editor));
Object.assign(editor, createInspectorController(state, editor));
Object.assign(editor, createCommandsController(state, editor));
Object.assign(editor, createInteractionController(state, editor));
Object.assign(editor, createPanelsController(state, editor));
Object.assign(editor, createConstructionController(state, editor));
Object.assign(editor, createWorkspaceController(state, editor));
Object.assign(editor, createAppearanceController(state, editor));
bindEditorUI(state, editor);

// Preserve the public entry point used by existing integrations.
export const {
  open,
  action,
  setProperty,
  selectId,
  construction,
  duplicate,
  mirror,
  undo,
  redo,
  toolSet,
  addResource,
  pointerDown,
  pointerMove,
  pointerUp,
  keyboard,
  save,
  showStart,
  setModifier,
  addModifier,
  finishPreset,
  alignment,
  freeze,
  mirrorObjects,
  settingsDialog,
  variantDialog,
  contextBar,
  modal,
  changeVariant,
  closeVariants,
  applyFinish,
  setConstructionProperty,
  renderConstructionPalette,
  prepareStack,
  applyStack,
  toggleHistory,
  newDocument,
  createDocument,
  recentAction,
  selectTreeObject,
  selectTreeGroup,
  group,
  ungroup,
  properties,
  beginPanelEdges,
  confirmEdgePanel,
  clearPanelEdges,
  cancelPanelEdges,
  beginPanelPreview,
  confirmPanels,
  setActiveColor,
  applyColor,
  showColorPalette,
  setFabric,
  showFabricPalette,
  setEraserMode,
  panelTargets,
  commandItems,
  runCommand,
  professionalAction,
  buildRegions,
  exportSelectionDialog,
  openPathfinder,
  helpTools,
  dispatchUx,
  syncPaintUI,
  renderAppearancePane,
} = editor;
export const { preview, workspace } = state.services;
export const editorState = () => ({
  project: state.document.project,
  selected: state.selection.selected,
  view: state.document.view,
  tab: state.library.tab,
  panelPreview: state.panels.panelPreview,
  panelEdgeState: state.panels.panelEdgeState,
  tool: state.interaction.tool,
  nodeIndex: state.selection.nodeIndex,
  nodeIndices: state.selection.nodeIndices,
  camera: state.canvas.camera,
  history: state.document.history,
  edgeIds: state.selection.edgeIds,
  editMode: state.interaction.editMode,
  modifierContext: state.selection.modifierContext,
  constructionContexts: state.selection.constructionContexts,
  rangeSelections: state.selection.rangeSelections,
  paletteClosedKey: state.workspace.paletteClosedKey,
  snap: state.canvas.snap,
});
