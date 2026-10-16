import test from "node:test";
import assert from "node:assert/strict";
import { shortcutContext } from "../dist/shortcut-router.js";
import {
  replaceControl,
  spectrumControlTag,
  setSpectrumTheme,
} from "../dist/editor/spectrum-bridge.js";
test("Spectrum adapters preserve captured numeric/preview values and existing command callbacks", () => {
  const originalDocument = globalThis.document;
  let received;
  const next = {
    dataset: {},
    className: "",
    setAttribute() {},
    appendChild() {},
    querySelector() {
      return null;
    },
    focus() {},
    select() {},
  };
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "sp-number-field");
      return next;
    },
  };
  const node = {
    tagName: "INPUT",
    type: "number",
    value: "24",
    checked: false,
    disabled: false,
    attributes: [],
    classList: {
      contains() {
        return false;
      },
    },
    hasAttribute() {
      return false;
    },
    getAttribute() {
      return null;
    },
    replaceWith(n) {
      assert.equal(n, next);
    },
    oninput() {
      received = Number(node.value);
    },
  };
  try {
    assert.equal(spectrumControlTag(node), "sp-number-field");
    replaceControl(node);
    next.value = 42;
    next.oninput({ target: next });
    assert.equal(received, 42);
    node.disabled = true;
    assert.equal(next.disabled, true);
    node.value = 0;
    assert.equal(next.value, 0);
  } finally {
    globalThis.document = originalDocument;
  }
  for (const tagName of ["SP-TEXTFIELD", "SP-NUMBER-FIELD", "SP-PICKER"])
    assert.equal(shortcutContext({ target: { tagName } }), "TEXT_EDITING");
});
test("Spectrum dark/light theme uses the real theme color and token scopes", () => {
  const attrs = {},
    classes = new Set();
  const theme = {
    setAttribute(k, v) {
      attrs[k] = v;
    },
    classList: {
      remove(...xs) {
        xs.forEach((x) => classes.delete(x));
      },
      add(x) {
        classes.add(x);
      },
    },
  };
  setSpectrumTheme(theme, true);
  assert.equal(attrs.color, "dark");
  assert.ok(classes.has("spectrum--dark"));
  setSpectrumTheme(theme, false);
  assert.equal(attrs.color, "light");
  assert.ok(!classes.has("spectrum--dark"));
  assert.ok(classes.has("spectrum--light"));
});
