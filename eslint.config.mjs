import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import node from "eslint-plugin-n";

export default defineConfig([
    globalIgnores(["**/build/", "**/dist/", "**/node_modules/", "eslint.config.mjs"]),

    js.configs.recommended,
    tseslint.configs.recommended,

    {
        files: ["**/*.ts", "**/*.mjs"],
        plugins: { n: node },
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.mocha,
            },
            ecmaVersion: "latest",
            sourceType: "module",
        },

        rules: {
            "no-prototype-builtins": "off",
            "n/no-process-exit": "off",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-import-type-side-effects": "error",
            "prefer-const": "error",
        },
    },

    {
        files: ["test/**/*.ts"],
        rules: {
            "@typescript-eslint/ban-ts-comment": "off",
        },
    },
]);
