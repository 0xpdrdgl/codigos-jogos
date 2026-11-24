import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Sem typescript-eslint, o ESLint flat config ignora arquivos .ts e o lint
// passa sem olhar o codigo.
export default tseslint.config(
  { ignores: ['dist', '.astro', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    rules: {
      'no-console': 'warn',
      'max-lines': ['warn', 500],
    },
  },
);
