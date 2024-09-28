import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // srcディレクトリ配下のTypeScriptファイルのみをチェック対象にする
  { files: ["src/**/*.ts"], languageOptions: { sourceType: "module" } },
  {
    ignores: ["dist/*.*"]
  },
  // AWS Lambda環境 (Node.js) のグローバル設定を適用
  { languageOptions: { globals: globals.node } },
  ...tseslint.configs.recommended  // TypeScriptの推奨設定を適用
];