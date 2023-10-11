module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  rules: {
    'jest/no-conditional-expect': 'off',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 'latest',
  },
}
