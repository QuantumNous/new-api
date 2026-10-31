import fs from 'fs'
import path from 'node:path'

const packagesDir = path.join(import.meta.dirname, '..', 'packages')

fs.readdir(packagesDir, { withFileTypes: true }, (err, entries) => {
  if (err) {
    console.error('Error reading directory:', err)
    return
  }

  entries.forEach((entry) => {
    if (entry.isDirectory()) {
      const packageJsonPath = path.join(packagesDir, entry.name, 'package.json')
      if (!fs.existsSync(packageJsonPath)) {
        const dirPath = path.join(packagesDir, entry.name)
        fs.rm(dirPath, { recursive: true }, (err) => {
          if (err) {
            console.error(`❌ Error deleting directory ${dirPath}:`, err)
          } else {
            console.log(`✅ Deleted directory: ${dirPath}`)
          }
        })
      }
    }
  })
})
