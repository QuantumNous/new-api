import _Object$keys from "core-js-pure/features/object/keys.js";
import _indexOfInstanceProperty from "core-js-pure/features/instance/index-of.js";
export default function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = _Object$keys(source);
  var key, i;
  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (_indexOfInstanceProperty(excluded).call(excluded, key) >= 0) continue;
    target[key] = source[key];
  }
  return target;
}