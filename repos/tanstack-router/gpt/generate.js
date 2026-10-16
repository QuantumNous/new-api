// @ts-check

import fs from 'node:fs'
import { glob } from 'tinyglobby'

const outputPath = './gpt/db.json'
const packages = []
const docs = []
const examples = []

Promise.resolve()
  .then(() => {
    return glob('./packages/*').then((dirs) => {
      return Promise.all(
        dirs.map((dir) => {
          const pkg = {
            name: dir.replace('./packages/', ''),
            files: [],
          }

          packages.push(pkg)

          return glob(`./${dir}/src/**/*`, {
            onlyFiles: true,
          }).then((files) => {
            files.forEach((file) => {
              const content = fs.readFileSync(file, 'utf8')

              pkg.files.push({ file, content })
            })
          })
        }),
      )
    })
  })
  .then(() => {
    return glob('./docs/**/*.md').then((files) => {
      files.forEach((file) => {
        const content = fs.readFileSync(file, 'utf8')
        const title = file.replace('./', '').replace('.md', '')

        docs.push({ page: title, content })
      })
    })
  })
  .then(() => {
    return glob('./examples/react/*').then((dirs) => {
      return Promise.all(
        dirs.map((dir) => {
          if (dir.includes('wip')) {
            return
          }
          const example = {
            name: dir.replace('./examples/react/', ''),
            files: [],
          }

          examples.push(example)

          return glob(`./${dir}/src/**/*`, {
            onlyFiles: true,
          }).then((files) => {
            files.forEach((file) => {
              const content = fs.readFileSync(file, 'utf8')

              example.files.push({ file, content })
            })
          })
        }),
      )
    })
  })
  .then(() => {
    fs.writeFileSync(
      outputPath,
      JSON.stringify({ packages, docs, examples }, null, 2),
    )
  })
  .catch((err) => {
    console.error('Error reading files:', err)
    return
  })
