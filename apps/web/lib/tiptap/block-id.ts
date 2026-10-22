import { Extension } from "@tiptap/core";

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `b-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * Gives every paragraph and heading a stable id.
 *
 * Comments anchor to a block id, and co-writers merge edits per block, so the
 * id must survive edits and be identical on every client.
 */
export const BlockId = Extension.create({
  name: "blockId",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-id"),
            renderHTML: (attributes) =>
              attributes.id ? { "data-id": attributes.id } : {},
          },
        },
      },
    ];
  },

  onCreate() {
    const { state, dispatch } = this.editor.view;
    const tr = state.tr;
    let changed = false;
    state.doc.descendants((node, pos) => {
      if ((node.type.name === "paragraph" || node.type.name === "heading") && !node.attrs.id) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: uuid() });
        changed = true;
      }
    });
    if (changed && dispatch) dispatch(tr);
  },

  onUpdate() {
    const { state, dispatch } = this.editor.view;
    const tr = state.tr;
    let changed = false;
    state.doc.descendants((node, pos) => {
      if ((node.type.name === "paragraph" || node.type.name === "heading") && !node.attrs.id) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: uuid() });
        changed = true;
      }
    });
    if (changed && dispatch) dispatch(tr);
  },
});

export { uuid };
