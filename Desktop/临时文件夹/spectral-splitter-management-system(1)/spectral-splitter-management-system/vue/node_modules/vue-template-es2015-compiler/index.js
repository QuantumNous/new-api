var buble = require('./buble.js')

// selectively support some handy ES2015 features in templates.
var defaultOptions = {
  transforms: {
    modules: false,
    // this is a custom feature for stripping with from Vue render functions.
    stripWith: true,
    // custom feature ensures with context targets functional render
    stripWithFunctional: false
  },
  // allow spread...
  objectAssign: 'Object.assign'
}

module.exports = function transpile (code, opts) {
  if (opts) {
    opts = Object.assign({}, defaultOptions, opts)
    opts.transforms = Object.assign({}, defaultOptions.transforms, opts.transforms)
  } else {
    opts = defaultOptions
  }
  var code = buble.transform(code, opts).code
  // console.log(code)
  return code
}
