import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '*.config.js'] },
  // 全域基礎 TypeScript 與 React 規則
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // SPEC §3.2 & AGENTS.md 業務模組邊界依賴檢查（排除測試檔案）
  {
    files: ['src/{app,features,domain,lib,shared}/**/*.{ts,tsx}'],
    plugins: {
      boundaries,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.app.json',
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**' },
        { type: 'features', pattern: 'src/features/**' },
        { type: 'domain', pattern: 'src/domain/**' },
        { type: 'lib', pattern: 'src/lib/**' },
        { type: 'shared', pattern: 'src/shared/**' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ['features', 'domain', 'lib', 'shared'] },
                  },
                },
              },
            },
            {
              from: { element: { type: 'features' } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ['domain', 'lib', 'shared', 'features'] },
                  },
                },
              },
            },
            {
              from: { element: { type: 'domain' } },
              allow: {
                to: {
                  element: { types: { anyOf: ['domain', 'shared'] } },
                },
              },
            },
            {
              from: { element: { type: 'lib' } },
              allow: {
                to: {
                  element: { types: { anyOf: ['domain', 'shared', 'lib'] } },
                },
              },
            },
            {
              from: { element: { type: 'shared' } },
              allow: {
                to: {
                  element: { types: { anyOf: ['domain', 'shared'] } },
                },
              },
            },
          ],
        },
      ],
    },
  },
  // SPEC §3.2 / AGENTS.md 邊界加強限制：domain 禁止引用 React 或網路/儲存程式碼
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'domain/ 為純函式層，禁止 import React。',
            },
            {
              name: 'react-dom',
              message: 'domain/ 為純函式層，禁止 import react-dom。',
            },
          ],
          patterns: [
            {
              group: ['@/lib/llm*', '**/lib/llm*'],
              message: 'domain/ 禁止依賴 lib/llm。',
            },
            {
              group: ['@/lib/db*', '**/lib/db*'],
              message: 'domain/ 禁止依賴 lib/db。',
            },
          ],
        },
      ],
    },
  },
  // SPEC §3.2 / AGENTS.md 紅線：禁止在元件或頁面內直接呼叫 fetch
  {
    files: ['src/features/**/*.tsx', 'src/app/**/*.tsx', 'src/shared/**/*.tsx'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            '禁止在元件內直接呼叫 fetch，所有網路請求只能經 src/lib/llm/*。',
        },
      ],
    },
  }
);
