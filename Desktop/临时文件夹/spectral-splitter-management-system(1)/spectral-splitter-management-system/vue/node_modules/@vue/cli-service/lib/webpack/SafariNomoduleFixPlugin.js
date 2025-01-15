// https://gist.github.com/samthor/64b114e4a4f539915a95b91ffd340acc
const safariFix = `!function(){var e=document,t=e.createElement("script");if(!("noModule"in t)&&"onbeforeload"in t){var n=!1;e.addEventListener("beforeload",function(e){if(e.target===t)n=!0;else if(!e.target.hasAttribute("nomodule")||!n)return;e.preventDefault()},!0),t.type="module",t.src=".",e.head.appendChild(t),t.remove()}}();`

const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { semver } = require('@vue/cli-shared-utils')
const { projectModuleTargets } = require('../util/targets')

const minSafariVersion = projectModuleTargets.safari
const minIOSVersion = projectModuleTargets.ios
const supportsSafari10 =
  (minSafariVersion && semver.lt(semver.coerce(minSafariVersion), '11.0.0')) ||
  (minIOSVersion && semver.lt(semver.coerce(minIOSVersion), '11.0.0'))
const needsSafariFix = supportsSafari10

class SafariNomoduleFixPlugin {
  constructor ({ unsafeInline, jsDirectory }) {
    this.unsafeInline = unsafeInline
    this.jsDirectory = jsDirectory
  }

  apply (compiler) {
    if (!needsSafariFix) {
      return
    }
    const { RawSource } = compiler.webpack
      ? compiler.webpack.sources
      : require('webpack-sources')

    const ID = 'SafariNomoduleFixPlugin'
    compiler.hooks.compilation.tap(ID, compilation => {
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tap(ID, data => {
        let scriptTag

        if (this.unsafeInline) {
          // inject inline Safari 10 nomodule fix
          scriptTag = {
            tagName: 'script',
            closeTag: true,
            innerHTML: safariFix
          }
        } else {
          // inject the fix as an external script
          const safariFixPath = path.join(this.jsDirectory, 'safari-nomodule-fix.js')
          const fullSafariFixPath = path.join(compilation.options.output.publicPath, safariFixPath)
          compilation.assets[safariFixPath] = new RawSource(safariFix)
          scriptTag = {
            tagName: 'script',
            closeTag: true,
            attributes: {
              src: fullSafariFixPath
            }
          }
        }

        let tags = data.bodyTags
        if (data.plugin.options.scriptLoading === 'defer') {
          tags = data.headTags
        }

        // insert just before the first actual script tag,
        // and after all other tags such as `meta`
        const firstScriptIndex = tags.findIndex(tag => tag.tagName === 'script')
        tags.splice(firstScriptIndex, 0, scriptTag)
      })
    })
  }
}

SafariNomoduleFixPlugin.safariFix = safariFix
module.exports = SafariNomoduleFixPlugin
