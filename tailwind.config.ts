import daisyui from 'daisyui'
import { type Config } from 'tailwindcss'

export default {
  content: [
    '{routes,islands,components}/**/*.{ts,tsx}',
  ],
  plugins: [
    // deno-lint-ignore ban-ts-comment
    // @ts-ignore
    daisyui,
  ],
} satisfies Config
