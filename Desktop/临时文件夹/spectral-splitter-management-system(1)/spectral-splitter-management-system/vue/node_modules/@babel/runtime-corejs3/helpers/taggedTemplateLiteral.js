var _sliceInstanceProperty = require("core-js-pure/features/instance/slice.js");
var _Object$freeze = require("core-js-pure/features/object/freeze.js");
var _Object$defineProperties = require("core-js-pure/features/object/define-properties.js");
function _taggedTemplateLiteral(strings, raw) {
  if (!raw) {
    raw = _sliceInstanceProperty(strings).call(strings, 0);
  }
  return _Object$freeze(_Object$defineProperties(strings, {
    raw: {
      value: _Object$freeze(raw)
    }
  }));
}
module.exports = _taggedTemplateLiteral, module.exports.__esModule = true, module.exports["default"] = module.exports;