/* eslint-disable no-await-in-loop */
import path from 'path'
import { promises as fs, existsSync } from 'fs'
import glob from 'fast-glob'
import replaceAll from 'string.prototype.replaceall'

/** template variables context */
export interface TemplateContext {
  projectName: string;
  description: string;
  scope: string;
}

export const getTemplateDir = (mode: string) => path.join(__dirname, '../templates', mode)

/**
 * compile the template text with Handlebars like syntax
 * https://handlebarsjs.com/guide/expressions.html#basic-usage
 */
export const compileTemplateText = (template: string, context: TemplateContext): string => {
  let result = template

  for (const [key, value] of Object.entries(context)) {
    // nodejs < 14 not supported `replaceAll` 
    result = replaceAll(result, `{{${key}}}`, value)
  }

  return result
}

export const appleTemplateProject = async ({
  sourceDir,
  targetDir,
  context,
}: {
  /** absolute path for template project dir */
  sourceDir: string;
  /** path relative from cwd */
  targetDir: string;
  /** template variables context */
  context: TemplateContext;
}) => {
  // path relative from templateProject
  const files = await glob(['**/*', '**/.*'], { cwd: sourceDir })

  for (const file of files) {
    const sourceFilePath = path.join(sourceDir, file)
    const targetFilePath = path.join(targetDir, file)
    console.info('[appleTemplateProject]', sourceFilePath)
    const sourceFile = await fs.readFile(sourceFilePath, { encoding: 'utf-8' })

    const targetFile = compileTemplateText(sourceFile, context)

    const targetFileDir = path.dirname(targetFilePath)
    if (!existsSync(targetFileDir)) {
      await fs.mkdir(targetFileDir, { recursive: true })
    }

    await fs.writeFile(targetFilePath, targetFile, { flag: 'w', encoding: 'utf-8' })
  }
}
