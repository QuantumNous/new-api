import _sliceInstanceProperty from "core-js-pure/features/instance/slice.js";
export default function _taggedTemplateLiteralLoose(strings, raw) {
  if (!raw) {
    raw = _sliceInstanceProperty(strings).call(strings, 0);
  }
  strings.raw = raw;
  return strings;
}