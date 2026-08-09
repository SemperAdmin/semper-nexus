// Flat config migrated from .eslintrc.json / .eslintignore for ESLint 10,
// which dropped legacy eslintrc support entirely. Rules and globals carried
// over unchanged.
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      '**/*.min.js',
      'lib/',
      'proxy-server/node_modules/',
      '.github/',
      'vite.config.js'
    ]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        allMaradmins: 'writable',
        allMcpubs: 'writable',
        allAlnavs: 'writable',
        allAlmars: 'writable',
        allDodForms: 'writable',
        allIgmcChecklists: 'writable',
        allSecnavs: 'writable',
        allJtrs: 'writable',
        allDodFmr: 'writable',
        currentMessages: 'writable',
        currentMessageType: 'writable',
        webVitals: 'readonly',
        SafeHTML: 'readonly',
        NexusIcons: 'readonly',
        DOMPurify: 'readonly',
        sanitizeInPlace: 'readonly',
        allNavmcForms: 'writable'
      }
    },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'warn',
      eqeqeq: ['warn', 'always'],
      curly: ['warn', 'all'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-alert': 'warn',
      'no-debugger': 'warn'
    }
  }
];
