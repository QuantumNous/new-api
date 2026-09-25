import { defineConfig } from '@twind/core'
import presetAutoprefix from '@twind/preset-autoprefix'
import presetTailwind from '@twind/preset-tailwind/base'

export default defineConfig({
  presets: [presetAutoprefix(), presetTailwind()],
})
