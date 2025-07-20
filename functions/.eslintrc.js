module.exports = {
  env: {
    // This is the line you need to add or modify
    node: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    // your other rules...
  },
};