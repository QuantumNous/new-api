import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/vue-start/plugin/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import tailwindcss from '@tailwindcss/vite'

const FUNCTIONS_WITH_CONSTANT_ID = [
  'src/routes/submit-post-formdata.tsx/greetUser_createServerFn_handler',
  'src/routes/formdata-redirect/index.tsx/greetUser_createServerFn_handler',
]

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    port: 3000,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      serverFns: {
        generateFunctionId: (opts) => {
          const id = `${opts.filename}/${opts.functionName}`
          if (FUNCTIONS_WITH_CONSTANT_ID.includes(id)) return 'constant_id'
          else return undefined
        },
      },
    }),
    vue(),
    vueJsx(),
  ],
})
