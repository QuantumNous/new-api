const fs = require('fs-extra')

module.exports = class MovePlugin {
  constructor (from, to) {
    this.from = from
    this.to = to
  }

  apply (compiler) {
    compiler.hooks.done.tap('move-plugin', () => {
      if (fs.existsSync(this.from)) {
        fs.moveSync(this.from, this.to, { overwrite: true })
      }
    })
  }
}
