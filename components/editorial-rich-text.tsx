"use client";

import type { JSONContent } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Mathematics } from "@tiptap/extension-mathematics";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { common, createLowlight } from "lowlight";
import { useEffect, useMemo, useState } from "react";
import type { EditorialContentFormat } from "@/lib/api-client";
import type { Locale } from "@/lib/i18n";

const lowlight = createLowlight(common);
const maximumCharacters = 60 * 1024;
const maximumSerializedBytes = 96 * 1024;

export const emptyEditorialDocument = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});

const copies = {
  en: {
    paragraph: "Paragraph", heading1: "Heading 1", heading2: "Heading 2",
    bold: "Bold", italic: "Italic", underline: "Underline", strike: "Strike",
    bullets: "Bullet list", numbers: "Numbered list", quote: "Quote",
    inlineCode: "Inline code", codeBlock: "Code block", link: "Link",
    undo: "Undo", redo: "Redo", font: "Font", size: "Size", align: "Align",
    color: "Color", normal: "Default", left: "Left", center: "Center", right: "Right",
    formula: "Formula", inlineFormula: "Inline formula", blockFormula: "Display formula",
    insert: "Insert", cancel: "Cancel", linkUrl: "Link URL", apply: "Apply",
    unlink: "Remove link", placeholder: "Explain the idea, proof, complexity, and code…",
    characters: "characters", codeLanguage: "Code language",
  },
  "zh-CN": {
    paragraph: "正文", heading1: "一级标题", heading2: "二级标题",
    bold: "粗体", italic: "斜体", underline: "下划线", strike: "删除线",
    bullets: "项目列表", numbers: "编号列表", quote: "引用",
    inlineCode: "行内代码", codeBlock: "代码块", link: "链接",
    undo: "撤销", redo: "重做", font: "字体", size: "字号", align: "对齐",
    color: "文字颜色", normal: "默认", left: "左对齐", center: "居中", right: "右对齐",
    formula: "数学公式", inlineFormula: "行内公式", blockFormula: "独立公式",
    insert: "插入", cancel: "取消", linkUrl: "链接地址", apply: "应用",
    unlink: "移除链接", placeholder: "写下思路、证明、复杂度分析与清晰的代码……",
    characters: "字符", codeLanguage: "代码语言",
  },
  ja: {
    paragraph: "本文", heading1: "見出し 1", heading2: "見出し 2",
    bold: "太字", italic: "斜体", underline: "下線", strike: "取り消し線",
    bullets: "箇条書き", numbers: "番号付きリスト", quote: "引用",
    inlineCode: "インラインコード", codeBlock: "コードブロック", link: "リンク",
    undo: "元に戻す", redo: "やり直す", font: "フォント", size: "サイズ", align: "配置",
    color: "文字色", normal: "標準", left: "左", center: "中央", right: "右",
    formula: "数式", inlineFormula: "インライン数式", blockFormula: "別行立て数式",
    insert: "挿入", cancel: "キャンセル", linkUrl: "リンク URL", apply: "適用",
    unlink: "リンクを解除", placeholder: "考え方、証明、計算量、読みやすいコードを書きましょう……",
    characters: "文字", codeLanguage: "コード言語",
  },
} as const;

const fonts = [
  ["", "SYSTEM"], ["Arial", "SANS"], ["Georgia", "SERIF"],
  ["Times New Roman", "BOOK"], ["Courier New", "MONO"], ["ui-monospace", "TERMINAL"],
] as const;
const sizes = ["", "12px", "14px", "16px", "18px", "22px", "28px", "36px"] as const;
const colors = [
  ["", "INK"], ["#075a38", "GREEN"], ["#b51f36", "RED"],
  ["#835c00", "GOLD"], ["#225ea8", "BLUE"],
] as const;
const languages = ["cpp", "c", "python", "javascript", "typescript", "bash", "plaintext"] as const;

function extensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3] },
      link: {
        autolink: true,
        defaultProtocol: "https",
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    CodeBlockLowlight.configure({
      lowlight, defaultLanguage: "cpp", enableTabIndentation: true, tabSize: 4,
    }),
    TextStyleKit,
    TextAlign.configure({
      types: ["heading", "paragraph"],
      alignments: ["left", "center", "right"],
    }),
    Mathematics.configure({
      katexOptions: {
        throwOnError: false,
        strict: "warn",
        trust: false,
        macros: { "\\R": "\\mathbb{R}", "\\N": "\\mathbb{N}", "\\Z": "\\mathbb{Z}" },
      },
    }),
  ];
}

function plainDocument(content: string): JSONContent {
  return {
    type: "doc",
    content: content.split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : undefined,
    })),
  };
}

function parseDocument(content: string, format: EditorialContentFormat): JSONContent {
  if (format === "plain") return plainDocument(content);
  try {
    const parsed = JSON.parse(content) as JSONContent;
    return parsed?.type === "doc" ? parsed : plainDocument(content);
  } catch {
    return plainDocument(content);
  }
}

function characterCount(editor: NonNullable<ReturnType<typeof useEditor>>) {
  let count = editor.getText({ blockSeparator: "\n" }).length;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "inlineMath" || node.type.name === "blockMath") {
      count += String(node.attrs.latex ?? "").trim().length;
    }
  });
  return count;
}

function Tool({
  label, active = false, disabled = false, onClick, children,
}: {
  label: string; active?: boolean; disabled?: boolean;
  onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? "is-active" : ""}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function EditorialComposer({
  locale, disabled, onChange,
}: {
  locale: Locale;
  disabled: boolean;
  onChange: (content: string, count: number, tooLarge: boolean) => void;
}) {
  const copy = copies[locale];
  const [mathMode, setMathMode] = useState<"inline" | "block" | null>(null);
  const [latex, setLatex] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    extensions: extensions(),
    content: JSON.parse(emptyEditorialDocument),
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "editorial-prosemirror",
        "aria-label": copy.placeholder,
        "data-placeholder": copy.placeholder,
      },
    },
    onUpdate: ({ editor: current }) => {
      const serialized = JSON.stringify(current.getJSON());
      const count = characterCount(current);
      onChange(
        serialized,
        count,
        new TextEncoder().encode(serialized).byteLength > maximumSerializedBytes ||
          count > maximumCharacters,
      );
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      underline: current?.isActive("underline") ?? false,
      strike: current?.isActive("strike") ?? false,
      code: current?.isActive("code") ?? false,
      codeBlock: current?.isActive("codeBlock") ?? false,
      quote: current?.isActive("blockquote") ?? false,
      bullets: current?.isActive("bulletList") ?? false,
      numbers: current?.isActive("orderedList") ?? false,
      h1: current?.isActive("heading", { level: 1 }) ?? false,
      h2: current?.isActive("heading", { level: 2 }) ?? false,
      font: String(current?.getAttributes("textStyle").fontFamily ?? ""),
      size: String(current?.getAttributes("textStyle").fontSize ?? ""),
      color: String(current?.getAttributes("textStyle").color ?? ""),
      align: String(
        current?.getAttributes("paragraph").textAlign ??
          current?.getAttributes("heading").textAlign ?? "",
      ),
      language: String(current?.getAttributes("codeBlock").language ?? "cpp"),
      canUndo: current?.can().chain().focus().undo().run() ?? false,
      canRedo: current?.can().chain().focus().redo().run() ?? false,
    }),
  });

  if (!editor) return <div className="editorial-rich-editor editorial-rich-editor--loading" />;

  const setFont = (value: string) => value
    ? editor.chain().focus().setFontFamily(value).run()
    : editor.chain().focus().unsetFontFamily().run();
  const setSize = (value: string) => value
    ? editor.chain().focus().setFontSize(value).run()
    : editor.chain().focus().unsetFontSize().run();
  const setColor = (value: string) => value
    ? editor.chain().focus().setColor(value).run()
    : editor.chain().focus().unsetColor().run();

  return (
    <div className={"editorial-rich-editor" + (disabled ? " is-disabled" : "")}>
      <div className="editorial-format-toolbar">
        <div className="editorial-format-group">
          <Tool label={copy.undo} disabled={!state?.canUndo} onClick={() => editor.chain().focus().undo().run()}>↶</Tool>
          <Tool label={copy.redo} disabled={!state?.canRedo} onClick={() => editor.chain().focus().redo().run()}>↷</Tool>
        </div>
        <div className="editorial-format-group">
          <Tool label={copy.bold} active={state?.bold} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></Tool>
          <Tool label={copy.italic} active={state?.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></Tool>
          <Tool label={copy.underline} active={state?.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Tool>
          <Tool label={copy.strike} active={state?.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Tool>
          <Tool label={copy.inlineCode} active={state?.code} onClick={() => editor.chain().focus().toggleCode().run()}>{"<>"}</Tool>
        </div>
        <div className="editorial-format-group">
          <Tool label={copy.paragraph} active={!state?.h1 && !state?.h2} onClick={() => editor.chain().focus().setParagraph().run()}>¶</Tool>
          <Tool label={copy.heading1} active={state?.h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Tool>
          <Tool label={copy.heading2} active={state?.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Tool>
          <Tool label={copy.bullets} active={state?.bullets} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</Tool>
          <Tool label={copy.numbers} active={state?.numbers} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</Tool>
          <Tool label={copy.quote} active={state?.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</Tool>
        </div>
        <label className="editorial-toolbar-select">
          <span>{copy.font}</span>
          <select value={state?.font ?? ""} onChange={(event) => setFont(event.target.value)}>
            {fonts.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="editorial-toolbar-select">
          <span>{copy.size}</span>
          <select value={state?.size ?? ""} onChange={(event) => setSize(event.target.value)}>
            {sizes.map((value) => <option key={value || "default"} value={value}>{value || copy.normal}</option>)}
          </select>
        </label>
        <label className="editorial-toolbar-select">
          <span>{copy.align}</span>
          <select
            value={state?.align ?? ""}
            onChange={(event) => event.target.value
              ? editor.chain().focus().setTextAlign(event.target.value).run()
              : editor.chain().focus().unsetTextAlign().run()}
          >
            <option value="">{copy.normal}</option>
            <option value="left">{copy.left}</option>
            <option value="center">{copy.center}</option>
            <option value="right">{copy.right}</option>
          </select>
        </label>
        <label className="editorial-toolbar-select">
          <span>{copy.color}</span>
          <select value={state?.color ?? ""} onChange={(event) => setColor(event.target.value)}>
            {colors.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="editorial-format-group">
          <Tool
            label={copy.link}
            active={editor.isActive("link")}
            onClick={() => {
              setLinkUrl(String(editor.getAttributes("link").href ?? "https://"));
              setLinkOpen((current) => !current);
            }}
          >↗</Tool>
          <Tool label={copy.inlineFormula} onClick={() => { setMathMode("inline"); setLatex(""); }}>∑</Tool>
          <Tool label={copy.blockFormula} onClick={() => { setMathMode("block"); setLatex(""); }}>∫</Tool>
          <Tool label={copy.codeBlock} active={state?.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock({ language: state?.language || "cpp" }).run()}>{"{ }"}</Tool>
        </div>
        <label className="editorial-toolbar-select">
          <span>{copy.codeLanguage}</span>
          <select
            value={state?.language ?? "cpp"}
            onChange={(event) => {
              const language = event.target.value;
              if (editor.isActive("codeBlock")) {
                editor.chain().focus().updateAttributes("codeBlock", { language }).run();
              } else {
                editor.chain().focus().setCodeBlock({ language }).run();
              }
            }}
          >
            {languages.map((language) => <option key={language} value={language}>{language.toUpperCase()}</option>)}
          </select>
        </label>
      </div>

      {linkOpen && (
        <div className="editorial-inline-dialog">
          <label>{copy.linkUrl}<input value={linkUrl} autoFocus inputMode="url" onChange={(event) => setLinkUrl(event.target.value)} /></label>
          <button type="button" onClick={() => {
            const href = linkUrl.trim();
            if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
            setLinkOpen(false);
          }}>[ {copy.apply} ]</button>
          <button type="button" onClick={() => {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            setLinkOpen(false);
          }}>[ {copy.unlink} ]</button>
        </div>
      )}

      {mathMode && (
        <div className="editorial-inline-dialog editorial-math-dialog">
          <label>
            {mathMode === "inline" ? copy.inlineFormula : copy.blockFormula}
            <input
              value={latex}
              autoFocus
              spellCheck={false}
              placeholder="\\sum_{i=1}^{n} a_i"
              onChange={(event) => setLatex(event.target.value)}
            />
          </label>
          <button type="button" disabled={!latex.trim()} onClick={() => {
            const value = latex.trim();
            if (mathMode === "inline") editor.chain().focus().insertInlineMath({ latex: value }).run();
            else editor.chain().focus().insertBlockMath({ latex: value }).run();
            setMathMode(null);
            setLatex("");
          }}>[ {copy.insert} ]</button>
          <button type="button" onClick={() => setMathMode(null)}>[ {copy.cancel} ]</button>
        </div>
      )}

      <EditorContent editor={editor} />
      <div className="editorial-editor-status">
        <span>{copy.placeholder}</span>
        <span>{characterCount(editor).toLocaleString()} / {maximumCharacters.toLocaleString()} {copy.characters}</span>
      </div>
    </div>
  );
}

export function EditorialRichText({
  content, contentFormat = "plain", className = "",
}: {
  content: string;
  contentFormat?: EditorialContentFormat;
  className?: string;
}) {
  const document = useMemo(() => parseDocument(content, contentFormat), [content, contentFormat]);
  const editor = useEditor({
    extensions: extensions(),
    content: document,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "editorial-prosemirror editorial-prosemirror--readonly" },
    },
  });

  useEffect(() => {
    if (editor) editor.commands.setContent(document);
  }, [document, editor]);

  if (!editor) return <div className="editorial-rich-output" />;
  return (
    <div className={("editorial-rich-output " + className).trim()}>
      <EditorContent editor={editor} />
    </div>
  );
}
