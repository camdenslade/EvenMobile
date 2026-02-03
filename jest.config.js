/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  testEnvironment: "node",
  setupFilesAfterEnv: ["@testing-library/react-native/extend-expect"],
  testMatch: ["**/tests/**/*.spec.ts", "**/tests/**/*.spec.tsx"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  verbose: true,
  roots: ["<rootDir>/tests"],
  clearMocks: true,
  collectCoverage: false,
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo(nent)?|@unimodules|unimodules|sentry-expo)",
  ],
};
