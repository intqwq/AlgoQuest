declare module "monaco-editor/editor/editor.worker?worker" {
  const EditorWorker: {
    new (): Worker;
  };
  export default EditorWorker;
}
