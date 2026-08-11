/** @type {import('lint-staged').Configuration} */
export default {
  '*': 'oxfmt --no-error-on-unmatched-pattern',
  '*.{js,jsx,ts,tsx,mjs,cjs}': 'oxlint --fix',
  // tsc needs the full project graph — run once if any TS file is staged
  '*.{ts,tsx}': () => 'pnpm typecheck',
}
