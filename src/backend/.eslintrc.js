// ESLint configuration for Test Automation Framework
// Dependencies:
// - eslint@7.32.0
// - @typescript-eslint/eslint-plugin@4.33.0
// - @typescript-eslint/parser@4.33.0

module.exports = {
  // Environment configuration for Node.js, ES2021 features, and Jest testing
  env: {
    node: true,
    es2021: true,
    jest: true
  },

  // Extend recommended configurations for TypeScript and ESLint
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking'
  ],

  // Configure TypeScript parser
  parser: '@typescript-eslint/parser',

  // Parser options for TypeScript and ES2021
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: '.'
  },

  // Enable TypeScript ESLint plugin
  plugins: ['@typescript-eslint'],

  // Custom rule configurations
  rules: {
    // Code formatting rules
    'indent': ['error', 2],  // Enforce 2-space indentation
    'linebreak-style': ['error', 'unix'],  // Enforce Unix line endings
    'quotes': ['error', 'single'],  // Require single quotes
    'semi': ['error', 'always'],  // Require semicolons
    'max-len': ['error', { 'code': 100 }],  // Maximum line length of 100 characters

    // TypeScript-specific rules
    '@typescript-eslint/no-unused-vars': ['warn'],  // Warn about unused variables
    '@typescript-eslint/explicit-function-return-type': ['error'],  // Require explicit return types
    '@typescript-eslint/no-explicit-any': ['error'],  // Disallow 'any' type
    '@typescript-eslint/no-floating-promises': ['error'],  // Require Promise handling
    '@typescript-eslint/await-thenable': ['error'],  // Ensure await is used with Promises
    '@typescript-eslint/no-misused-promises': ['error'],  // Prevent Promise misuse

    // Best practices
    'no-console': ['error', {
      'allow': ['warn', 'error']  // Only allow console.warn and console.error
    }],
    'eqeqeq': ['error', 'always'],  // Require strict equality comparison
    'no-unused-expressions': 'error',  // Disallow unused expressions
    'prefer-const': 'error',  // Prefer const over let when possible
    'no-var': 'error'  // Disallow var keyword
  }
};