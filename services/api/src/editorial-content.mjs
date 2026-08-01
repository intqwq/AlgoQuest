const richTextFormat = "tiptap-json-v1";
const plainTextFormat = "plain";
const maxSerializedBytes = 96 * 1024;
const maxTextLength = 60 * 1024;
const maxNodes = 5_000;
const maxDepth = 24;

const allowedNodeTypes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
  "inlineMath",
  "blockMath",
]);
const allowedMarkTypes = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
  "textStyle",
]);
const fontFamilies = new Set([
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "ui-monospace",
]);
const fontSizes = new Set(["12px", "14px", "16px", "18px", "22px", "28px", "36px"]);
const lineHeights = new Set(["1", "1.25", "1.5", "1.75", "2"]);
const colors = new Set([
  "#151515",
  "#075a38",
  "#b51f36",
  "#835c00",
  "#225ea8",
  "#ffffff",
]);
const backgroundColors = new Set([
  "#fff7d7",
  "#d9f2e5",
  "#e4e0d7",
  "#f4d8dd",
]);

export class EditorialContentError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code = "INVALID_EDITORIAL_DOCUMENT") {
  throw new EditorialContentError(code);
}

function validUrl(value) {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value, "https://algoquest.invalid");
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function validateTextStyle(attrs) {
  if (!attrs || typeof attrs !== "object" || Array.isArray(attrs)) return;
  const allowed = new Set([
    "fontFamily",
    "fontSize",
    "lineHeight",
    "color",
    "backgroundColor",
  ]);
  if (Object.keys(attrs).some((key) => !allowed.has(key))) fail();
  if (attrs.fontFamily != null && !fontFamilies.has(attrs.fontFamily)) fail();
  if (attrs.fontSize != null && !fontSizes.has(attrs.fontSize)) fail();
  if (attrs.lineHeight != null && !lineHeights.has(attrs.lineHeight)) fail();
  if (attrs.color != null && !colors.has(String(attrs.color).toLowerCase())) fail();
  if (
    attrs.backgroundColor != null &&
    !backgroundColors.has(String(attrs.backgroundColor).toLowerCase())
  ) fail();
}

function validateMarks(marks) {
  if (marks == null) return;
  if (!Array.isArray(marks) || marks.length > 16) fail();
  for (const mark of marks) {
    if (!mark || typeof mark !== "object" || !allowedMarkTypes.has(mark.type)) fail();
    if (mark.type === "link") {
      if (!validUrl(mark.attrs?.href)) fail("INVALID_EDITORIAL_LINK");
      const keys = Object.keys(mark.attrs ?? {});
      if (keys.some((key) => !["href", "target", "rel", "class"].includes(key))) fail();
    } else if (mark.type === "textStyle") {
      validateTextStyle(mark.attrs);
    } else if (mark.attrs && Object.keys(mark.attrs).length) {
      fail();
    }
  }
}

function validateAttributes(node, state) {
  const attrs = node.attrs;
  if (attrs == null) return;
  if (typeof attrs !== "object" || Array.isArray(attrs)) fail();
  const keys = Object.keys(attrs);
  if (["paragraph", "heading"].includes(node.type)) {
    if (keys.some((key) => !["level", "textAlign"].includes(key))) fail();
    if (node.type === "heading" && ![1, 2, 3].includes(attrs.level)) fail();
    if (attrs.textAlign != null && !["left", "center", "right"].includes(attrs.textAlign)) fail();
    return;
  }
  if (node.type === "orderedList") {
    if (keys.some((key) => !["start", "type"].includes(key))) fail();
    if (
      attrs.start != null &&
      (!Number.isInteger(attrs.start) || attrs.start < 1 || attrs.start > 100_000)
    ) fail();
    return;
  }
  if (node.type === "bulletList") {
    if (keys.some((key) => key !== "type")) fail();
    return;
  }
  if (node.type === "codeBlock") {
    if (keys.some((key) => key !== "language")) fail();
    if (attrs.language != null && !/^[A-Za-z0-9_+.-]{0,32}$/.test(attrs.language)) fail();
    return;
  }
  if (["inlineMath", "blockMath"].includes(node.type)) {
    if (
      keys.some((key) => key !== "latex") ||
      typeof attrs.latex !== "string" ||
      attrs.latex.length > 4_096
    ) fail();
    state.textLength += attrs.latex.trim().length;
    return;
  }
  if (keys.length) fail();
}

function validateNode(node, state, depth = 0) {
  if (!node || typeof node !== "object" || Array.isArray(node)) fail();
  if (!allowedNodeTypes.has(node.type) || depth > maxDepth) fail();
  state.nodes += 1;
  if (state.nodes > maxNodes) fail("EDITORIAL_DOCUMENT_TOO_LARGE");
  const keys = Object.keys(node);
  if (keys.some((key) => !["type", "attrs", "content", "text", "marks"].includes(key))) fail();
  if (node.type === "text") {
    if (typeof node.text !== "string" || node.content != null || node.attrs != null) fail();
    state.textLength += node.text.length;
    validateMarks(node.marks);
  } else {
    if (node.text != null || node.marks != null) fail();
    validateAttributes(node, state);
    if (node.content != null) {
      if (!Array.isArray(node.content)) fail();
      for (const child of node.content) validateNode(child, state, depth + 1);
    }
  }
  if (state.textLength > maxTextLength) fail("EDITORIAL_DOCUMENT_TOO_LARGE");
}

export function validateEditorialContent(content, requestedFormat) {
  const contentFormat = requestedFormat ?? plainTextFormat;
  if (contentFormat === plainTextFormat) {
    if (typeof content !== "string") fail();
    const normalized = content.replace(/\u0000/g, "").trim();
    if (normalized.length < 10) fail("EDITORIAL_CONTENT_REQUIRED");
    if (normalized.length > maxTextLength) fail("EDITORIAL_DOCUMENT_TOO_LARGE");
    return { content: normalized, contentFormat, textLength: normalized.length };
  }
  if (contentFormat !== richTextFormat || typeof content !== "string") fail();
  if (Buffer.byteLength(content, "utf8") > maxSerializedBytes) {
    fail("EDITORIAL_DOCUMENT_TOO_LARGE");
  }
  let document;
  try {
    document = JSON.parse(content);
  } catch {
    fail();
  }
  if (document?.type !== "doc" || !Array.isArray(document.content)) fail();
  const state = { nodes: 0, textLength: 0 };
  validateNode(document, state);
  if (state.textLength < 10) fail("EDITORIAL_CONTENT_REQUIRED");
  return {
    content: JSON.stringify(document),
    contentFormat,
    textLength: state.textLength,
  };
}

export const editorialContentFormats = Object.freeze({
  plain: plainTextFormat,
  rich: richTextFormat,
});

