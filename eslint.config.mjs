import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import node from "eslint-plugin-n";

export default defineConfig([
    globalIgnores(["**/build/", "**/dist/", "eslint.config.mjs"]),

    js.configs.recommended,

    {
        files: ["**/*.ts", "**/*.mjs"],
        plugins: {n: node},
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
        },
    }
]);
