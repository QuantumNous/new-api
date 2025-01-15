const { EOL } = require('os')
const fs = require('fs')
const { Plugin } = require('release-it')
const conventionalChangelog = require('conventional-changelog')
const concat = require('concat-stream')
const prependFile = require('prepend-file')

class ConventionalChangelog extends Plugin {
  getInitialOptions(options, namespace) {
    options[namespace].tagName = options.git.tagName
    return options[namespace]
  }

  async bump(version) {
    this.setContext({ version })
    const { previousTag, currentTag } = await this.getConventionalConfig()
    this.setContext({ previousTag, currentTag })
    const changelog = await this.generateChangelog()
    this.setContext({ changelog })
  }

  async getConventionalConfig() {
    const version = this.getContext('version')

    const previousTag = this.config.getContext('latestTag')
    const tagTemplate =
      this.options.tagName || ((previousTag || '').match(/^v/) ? 'v${version}' : '${version}')
    const currentTag = tagTemplate.replace('${version}', version)

    return { version, previousTag, currentTag }
  }

  getChangelogStream(options = {}) {
    const { version, previousTag, currentTag } = this.getContext()
    return conventionalChangelog(
      Object.assign(options, this.options),
      { version, previousTag, currentTag },
      {
        debug: this.config.isDebug ? this.debug : null,
      }
    )
  }

  generateChangelog(options) {
    return new Promise((resolve, reject) => {
      const resolver = result => resolve(result.toString().trim())
      const changelogStream = this.getChangelogStream(options)
      changelogStream.pipe(concat(resolver))
      changelogStream.on('error', reject)
    })
  }

  async writeChangelog() {
    const { infile } = this.options
    let { changelog } = this.getContext()

    let hasInfile = false
    try {
      fs.accessSync(infile)
      hasInfile = true
    } catch (err) {
      this.debug(err)
    }

    if (!hasInfile) {
      changelog = await this.generateChangelog({ releaseCount: 0 })
      this.debug({ changelog })
    }

    await prependFile(infile, changelog + EOL + EOL)

    if (!hasInfile) {
      await this.exec(`git add ${infile}`)
    }
  }

  async beforeRelease() {
    const { infile } = this.options
    const { isDryRun } = this.config

    this.log.exec(`Writing changelog to ${infile}`, isDryRun)

    if (infile && !isDryRun) {
      await this.writeChangelog()
    }
  }
}

module.exports = ConventionalChangelog
