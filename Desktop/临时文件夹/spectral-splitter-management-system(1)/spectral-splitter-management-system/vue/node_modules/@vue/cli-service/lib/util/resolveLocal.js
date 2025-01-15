const path = require('path')

module.exports = function resolveLocal (...args) {
  return path.join(__dirname, '../../', ...args)
}
