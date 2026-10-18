import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['backend/**/*.test.{ts,tsx}', 'frontend/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
