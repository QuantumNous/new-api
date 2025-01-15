import _sliceInstanceProperty from "core-js-pure/features/instance/slice.js";
import _Object$freeze from "core-js-pure/features/object/freeze.js";
import _Object$defineProperties from "core-js-pure/features/object/define-properties.js";
export default function _taggedTemplateLiteral(strings, raw) {
  if (!raw) {
    raw = _sliceInstanceProperty(strings).call(strings, 0);
  }
  return _Object$freeze(_Object$defineProperties(strings, {
    raw: {
      value: _Object$freeze(raw)
    }
  }));
}