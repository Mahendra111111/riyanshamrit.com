/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
  ],
  rules: {
    // Disallow any usage — prefer explicit types
    "@typescript-eslint/no-explicit-any": "error",
    // Disallow unused variables (prefix with _ to ignore)
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    // Consistent return type annotations
    "@typescript-eslint/explicit-function-return-type": "warn",
    // No console.log in production code (use structured logger)
    "no-console": ["warn", { allow: ["warn", "error"] }],
    // Enforce consistent naming
    "@typescript-eslint/naming-convention": [
      "error",
      { selector: "interface", format: ["PascalCase"] },
      { selector: "typeAlias", format: ["PascalCase"] },
      { selector: "enum", format: ["PascalCase"] },
    ],
  },
  ignorePatterns: [
    "node_modules",
    "dist",
    ".next",
    "*.js",
    "*.cjs",
    "*.mjs",
  ],
};
