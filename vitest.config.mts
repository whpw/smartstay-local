import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./backend/src', import.meta.url)) },
  },
  test: {
    include: ['backend/**/*.test.{ts,tsx}', 'frontend/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
