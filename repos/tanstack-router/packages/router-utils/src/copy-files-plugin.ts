import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'pathe'
import { glob } from 'tinyglobby'
import type { Plugin } from 'vite'

export function copyFilesPlugin({
  fromDir,
  toDir,
  pattern = '**',
}: {
  pattern?: string | Array<string>
  fromDir: string
  toDir: string
}): Plugin {
  return {
    name: 'copy-files',
    async writeBundle() {
      const entries = await glob(pattern, { cwd: fromDir })
      if (entries.length === 0) {
        throw new Error(
          `No files found matching pattern "${pattern}" in directory "${fromDir}"`,
        )
      }

      for (const entry of entries) {
        const srcPath = join(fromDir, entry)
        const destPath = join(toDir, entry)
        // Ensure the destination directory exists
        await mkdir(dirname(destPath), { recursive: true })
        await copyFile(srcPath, destPath)
      }
    },
  }
}
