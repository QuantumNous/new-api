const fs = require('fs-extra')
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
class ModernModePlugin {
  constructor ({ targetDir, isModuleBuild }) {
    this.targetDir = targetDir
    this.isModuleBuild = isModuleBuild
  }

  apply (compiler) {
    if (!this.isModuleBuild) {
      this.applyLegacy(compiler)
    } else {
      this.applyModule(compiler)
    }
  }

  applyLegacy (compiler) {
    const ID = `vue-cli-legacy-bundle`
    compiler.hooks.compilation.tap(ID, compilation => {
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tapAsync(ID, async (data, cb) => {
        // get stats, write to disk
        await fs.ensureDir(this.targetDir)
        const htmlName = path.basename(data.plugin.options.filename)
        // Watch out for output files in sub directories
        const htmlPath = path.dirname(data.plugin.options.filename)
        const tempFilename = path.join(this.targetDir, htmlPath, `legacy-assets-${htmlName}.json`)
        await fs.mkdirp(path.dirname(tempFilename))

        let tags = data.bodyTags
        if (data.plugin.options.scriptLoading === 'defer') {
          tags = data.headTags
        }
        await fs.writeFile(tempFilename, JSON.stringify(tags))
        cb()
      })
    })
  }

  applyModule (compiler) {
    const ID = `vue-cli-modern-bundle`
    compiler.hooks.compilation.tap(ID, compilation => {
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tapAsync(ID, async (data, cb) => {
        let tags = data.bodyTags
        if (data.plugin.options.scriptLoading === 'defer') {
          tags = data.headTags
        }
        // use <script type="module"> for modern assets
        tags.forEach(tag => {
          if (tag.tagName === 'script' && tag.attributes) {
            tag.attributes.type = 'module'
          }
        })

        // use <link rel="modulepreload"> instead of <link rel="preload">
        // for modern assets
        data.headTags.forEach(tag => {
          if (tag.tagName === 'link' &&
              tag.attributes.rel === 'preload' &&
              tag.attributes.as === 'script') {
            tag.attributes.rel = 'modulepreload'
          }
        })

        // inject links for legacy assets as <script nomodule>
        const htmlName = path.basename(data.plugin.options.filename)
        // Watch out for output files in sub directories
        const htmlPath = path.dirname(data.plugin.options.filename)
        const tempFilename = path.join(this.targetDir, htmlPath, `legacy-assets-${htmlName}.json`)
        const legacyAssets = JSON.parse(await fs.readFile(tempFilename, 'utf-8'))
          .filter(a => a.tagName === 'script' && a.attributes)
        legacyAssets.forEach(a => { a.attributes.nomodule = '' })

        tags.push(...legacyAssets)
        await fs.remove(tempFilename)
        cb()
      })

      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tap(ID, data => {
        data.html = data.html.replace(/\snomodule="">/g, ' nomodule>')
      })
    })
  }
}

module.exports = ModernModePlugin
