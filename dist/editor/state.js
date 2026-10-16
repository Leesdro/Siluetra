import { readToolMemory } from "../ux-tools.js";
import { documentSpec } from "../document.js";

export function createEditorState() {
  return {
    document: {
      project: null,
      history: null,
      view: "front",
      dirty: false,
      saveTimer: undefined,
      saveChain: Promise.resolve(),
    },
    selection: {
      selected: [],
      clipboard: [],
      nodeIndex: -1,
      nodeIndices: [],
      editingGroup: null,
      isolation: [],
      edgeIds: [],
      hoverEdge: null,
      modifierContext: null,
      constructionContexts: [],
      rangeSelections: {},
      treeAnchor: null,
      clipboardGroups: [],
      selectedGroup: null,
    },
    interaction: {
      tool: "select",
      drag: null,
      space: false,
      pen: null,
      editMode: "nodes",
      pendingFinish: null,
      temporarySelect: false,
      shapeBuilderState: null,
      eraserMode: "construction",
      eraserRadius: 10,
      eraserHover: null,
      pendingStack: null,
    },
    panels: { panelEdgeState: null, panelPreview: null },
    canvas: {
      snap: true,
      grid: false,
      camera: { x: 0, y: 0, z: 1 },
      zoomInitialized: false,
      toolMemory: readToolMemory(globalThis.localStorage),
    },
    library: {
      tab: "resources",
      resourceSearch: "",
      resourceSections: new Set(),
    },
    launcher: {
      newDocumentKind: "tee",
      recentProjects: [],
      recentMenuId: null,
      newDocumentOptions: documentSpec(),
    },
    appearance: {
      colorHover: null,
      appearanceGesture: false,
      fabricScope: "this",
    },
    workspace: {
      variantRename: null,
      pathfinderOpen: false,
      paletteKey: "",
      paletteClosedKey: null,
      sectionFold: new Map(),
    },
    services: {},
  };
}
