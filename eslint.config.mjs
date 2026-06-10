import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import node from "eslint-plugin-n"

export default defineConfig([
    globalIgnores(["**/build/", "**/dist/", "eslint.config.mjs"]),

    js.configs.recommended,

    {
        plugins: {n: node},
        languageOptions: {
            globals: {
                ...globals.commonjs,
                ...globals.node,
                ...globals.mocha,
            },

            ecmaVersion: 12,
            sourceType: "commonjs",
        },

        rules: {
            "no-prototype-builtins": "off",
            "n/no-process-exit": "off",
        },
    }
]);
