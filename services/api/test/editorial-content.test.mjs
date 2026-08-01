import assert from "node:assert/strict";
import test from "node:test";
import {
  EditorialContentError,
  validateEditorialContent,
} from "../src/editorial-content.mjs";

function rich(document) {
  return validateEditorialContent(
    JSON.stringify(document),
    "tiptap-json-v1",
  );
}

test("rich editorials preserve formatted text, code and mathematics", () => {
  const result = rich({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2, textAlign: "center" },
        content: [
          {
            type: "text",
            text: "Shortest paths",
            marks: [
              { type: "bold" },
              {
                type: "textStyle",
                attrs: {
                  fontFamily: "Georgia",
                  fontSize: "22px",
                  lineHeight: null,
                  color: "#075a38",
                  backgroundColor: null,
                },
              },
            ],
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { textAlign: null },
        content: [
          { type: "text", text: "For every edge " },
          { type: "inlineMath", attrs: { latex: "d_v \\le d_u + w" } },
        ],
      },
      {
        type: "codeBlock",
        attrs: { language: "cpp" },
        content: [{ type: "text", text: "priority_queue<int> pq;" }],
      },
    ],
  });

  assert.equal(result.contentFormat, "tiptap-json-v1");
  assert.ok(result.textLength > 20);
  assert.equal(JSON.parse(result.content).content[2].attrs.language, "cpp");
});

test("legacy plain editorial content remains supported", () => {
  assert.deepEqual(validateEditorialContent("  old discussion body  "), {
    content: "old discussion body",
    contentFormat: "plain",
    textLength: 19,
  });
});

test("rich editorial validation rejects executable nodes and unsafe links", () => {
  assert.throws(
    () => rich({
      type: "doc",
      content: [{ type: "script", content: [{ type: "text", text: "alert(1)" }] }],
    }),
    EditorialContentError,
  );

  assert.throws(
    () => rich({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{
          type: "text",
          text: "unsafe destination",
          marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
        }],
      }],
    }),
    (error) => error.code === "INVALID_EDITORIAL_LINK",
  );

  assert.throws(
    () => rich({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{
          type: "text",
          text: "unsafe style",
          marks: [{
            type: "textStyle",
            attrs: { fontFamily: "Arial; background:url(https://attacker.invalid)" },
          }],
        }],
      }],
    }),
    EditorialContentError,
  );
});

test("rich editorial validation enforces content and serialized size limits", () => {
  assert.throws(
    () => rich({ type: "doc", content: [{ type: "paragraph" }] }),
    (error) => error.code === "EDITORIAL_CONTENT_REQUIRED",
  );
  assert.throws(
    () => rich({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "x".repeat(97 * 1024) }],
      }],
    }),
    (error) => error.code === "EDITORIAL_DOCUMENT_TOO_LARGE",
  );
});

