export const SLOW_TYPE_PATTERNS: {
  pattern: RegExp;
  message: string;
}[] = [
  {
    message: "exported function is missing an explicit return type (slow type)",
    pattern: /export\s+function\s+\w+\s*\([^)]*\)\s*\{/,
  },
  {
    message:
      "exported variable with complex initializer is missing a type annotation (slow type)",
    pattern:
      /export\s+(?:const|let)\s+\w+\s*=\s*(?:crypto|Math|Date|JSON|Object|Array|Promise|Symbol|Number|String|Boolean)\b/,
  },
  {
    message:
      "export destructuring is a slow type — export each symbol individually",
    pattern: /export\s+const\s+\{[^}]+\}\s*=/,
  },
  {
    message: "CommonJS export syntax is a slow type — use ESM export syntax",
    pattern: /export\s*=\s*(?!module\.exports)/,
  },
  {
    message: "CommonJS import syntax is a slow type — use ESM import syntax",
    pattern: /import\s+\w+\s*=\s*require\s*\(/,
  },
  {
    message: "global augmentation is a slow type",
    pattern: /declare\s+global\s*\{/,
  },
  {
    message: "module augmentation is a slow type",
    pattern: /declare\s+module\s+/,
  },
  {
    message: "export as namespace is a slow type",
    pattern: /export\s+as\s+namespace\s+/,
  },
  {
    message: "exported class property is missing a type annotation (slow type)",
    pattern: /export\s+class\s+\w+[^{]*\b\w+\s*[;=]/,
  },
];
