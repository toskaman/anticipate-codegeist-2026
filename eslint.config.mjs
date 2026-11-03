// Backend lint (Forge resolvers, engine, adapters, tests). The frontend has its own config in static/hello-world.
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**", "static/**", "packages/**", "coverage/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,js}", "test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
