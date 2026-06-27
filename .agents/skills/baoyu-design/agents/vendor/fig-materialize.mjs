// fig-materialize.mjs — offline Figma .fig decoder + materializer.
// Pipeline: .fig bytes (raw kiwi container or ZIP with canvas.fig + images/)
// → zstd(WASM, inlined)/deflate decompression → kiwi binary-schema decode →
// node tree → FigVfs virtual filesystem → React JSX, design-token CSS,
// typography CSS, and asset emission (emitFigSelection / renderToHtml).
// Node-compatible: WASM and base64 fall back to Buffer, and only fflate's
// sync APIs are used.
import { unzipSync, inflateSync } from "./fflate.mjs";
var int32Scratch = new Int32Array(1),
  float32Scratch = new Float32Array(int32Scratch.buffer),
  ByteBuffer = class {
    constructor(data) {
      if (data && !(data instanceof Uint8Array)) throw new Error("Must initialize a ByteBuffer with a Uint8Array");
      this._data = data || new Uint8Array(256), this._index = 0, this.length = data ? data.length : 0;
    }
    toUint8Array() {
      return this._data.subarray(0, this.length);
    }
    readByte() {
      if (this._index + 1 > this._data.length) throw new Error("Index out of bounds");
      return this._data[this._index++];
    }
    readByteArray() {
      let length = this.readVarUint(),
        start = this._index,
        end = start + length;
      if (end > this._data.length) throw new Error("Read array out of bounds");
      this._index = end;
      let bytes = new Uint8Array(length);
      return bytes.set(this._data.subarray(start, end)), bytes;
    }
    readVarFloat() {
      let index = this._index,
        data = this._data,
        size = data.length;
      if (index + 1 > size) throw new Error("Index out of bounds");
      let firstByte = data[index];
      if (firstByte === 0) return this._index = index + 1, 0;
      if (index + 4 > size) throw new Error("Index out of bounds");
      let bits = firstByte | data[index + 1] << 8 | data[index + 2] << 16 | data[index + 3] << 24;
      return this._index = index + 4, bits = bits << 23 | bits >>> 9, int32Scratch[0] = bits, float32Scratch[0];
    }
    readVarUint() {
      let value = 0,
        shift = 0;
      do {
        var byte = this.readByte();
        value |= (byte & 127) << shift, shift += 7;
      } while (byte & 128 && shift < 35);
      return value >>> 0;
    }
    readVarInt() {
      let value = this.readVarUint() | 0;
      return value & 1 ? ~(value >>> 1) : value >>> 1;
    }
    readVarUint64() {
      let value = BigInt(0),
        shift = BigInt(0),
        seven = BigInt(7),
        byte;
      for (; (byte = this.readByte()) & 128 && shift < 56;) value |= BigInt(byte & 127) << shift, shift += seven;
      return value |= BigInt(byte) << shift, value;
    }
    readVarInt64() {
      let value = this.readVarUint64(),
        one = BigInt(1),
        sign = value & one;
      return value >>= one, sign ? ~value : value;
    }
    readString() {
      let result = "";
      for (;;) {
        let codePoint,
          byte1 = this.readByte();
        if (byte1 < 192) codePoint = byte1;else {
          let byte2 = this.readByte();
          if (byte1 < 224) codePoint = (byte1 & 31) << 6 | byte2 & 63;else {
            let byte3 = this.readByte();
            if (byte1 < 240) codePoint = (byte1 & 15) << 12 | (byte2 & 63) << 6 | byte3 & 63;else {
              let byte4 = this.readByte();
              codePoint = (byte1 & 7) << 18 | (byte2 & 63) << 12 | (byte3 & 63) << 6 | byte4 & 63;
            }
          }
        }
        if (codePoint === 0) break;
        codePoint < 65536 ? result += String.fromCharCode(codePoint) : (codePoint -= 65536, result += String.fromCharCode((codePoint >> 10) + 55296, (codePoint & 1023) + 56320));
      }
      return result;
    }
    _growBy(amount) {
      if (this.length + amount > this._data.length) {
        let grown = new Uint8Array(this.length + amount << 1);
        grown.set(this._data), this._data = grown;
      }
      this.length += amount;
    }
    writeByte(value) {
      let index = this.length;
      this._growBy(1), this._data[index] = value;
    }
    writeByteArray(bytes) {
      this.writeVarUint(bytes.length);
      let index = this.length;
      this._growBy(bytes.length), this._data.set(bytes, index);
    }
    writeVarFloat(value) {
      let index = this.length;
      float32Scratch[0] = value;
      let bits = int32Scratch[0];
      if (bits = bits >>> 23 | bits << 9, (bits & 255) === 0) {
        this.writeByte(0);
        return;
      }
      this._growBy(4);
      let data = this._data;
      data[index] = bits, data[index + 1] = bits >> 8, data[index + 2] = bits >> 16, data[index + 3] = bits >> 24;
    }
    writeVarUint(value) {
      if (value < 0 || value > 4294967295) throw new Error("Outside uint range: " + value);
      do {
        let sevenBits = value & 127;
        value >>>= 7, this.writeByte(value ? sevenBits | 128 : sevenBits);
      } while (value);
    }
    writeVarInt(value) {
      if (value < -2147483648 || value > 2147483647) throw new Error("Outside int range: " + value);
      this.writeVarUint((value << 1 ^ value >> 31) >>> 0);
    }
    writeVarUint64(value) {
      if (typeof value == "string") value = BigInt(value);else if (typeof value != "bigint") throw new Error("Expected bigint but got " + typeof value + ": " + value);
      if (value < 0 || value > BigInt("0xFFFFFFFFFFFFFFFF")) throw new Error("Outside uint64 range: " + value);
      let mask = BigInt(127),
        seven = BigInt(7);
      for (let byteIdx = 0; value > mask && byteIdx < 8; byteIdx++) this.writeByte(Number(value & mask) | 128), value >>= seven;
      this.writeByte(Number(value));
    }
    writeVarInt64(value) {
      if (typeof value == "string") value = BigInt(value);else if (typeof value != "bigint") throw new Error("Expected bigint but got " + typeof value + ": " + value);
      if (value < -BigInt("0x8000000000000000") || value > BigInt("0x7FFFFFFFFFFFFFFF")) throw new Error("Outside int64 range: " + value);
      let one = BigInt(1);
      this.writeVarUint64(value < 0 ? ~(value << one) : value << one);
    }
    writeString(value) {
      let codePoint;
      for (let charIdx = 0; charIdx < value.length; charIdx++) {
        let code = value.charCodeAt(charIdx);
        if (charIdx + 1 === value.length || code < 55296 || code >= 56320) codePoint = code;else {
          let lowSurrogate = value.charCodeAt(++charIdx);
          codePoint = (code << 10) + lowSurrogate + -56613888;
        }
        if (codePoint === 0) throw new Error("Cannot encode a string containing the null character");
        codePoint < 128 ? this.writeByte(codePoint) : (codePoint < 2048 ? this.writeByte(codePoint >> 6 & 31 | 192) : (codePoint < 65536 ? this.writeByte(codePoint >> 12 & 15 | 224) : (this.writeByte(codePoint >> 18 & 7 | 240), this.writeByte(codePoint >> 12 & 63 | 128)), this.writeByte(codePoint >> 6 & 63 | 128)), this.writeByte(codePoint & 63 | 128));
      }
      this.writeByte(0);
    }
  };
function quote(value) {
  return JSON.stringify(value);
}
function throwAt(message, line, column) {
  var err = new Error(message);
  throw err.line = line, err.column = column, err;
}
function compileDecode(definition, definitions) {
  let lines = [],
    indent = "  ";
  lines.push("function (bb) {"), lines.push("  var result = {};"), lines.push("  if (!(bb instanceof this.ByteBuffer)) {"), lines.push("    bb = new this.ByteBuffer(bb);"), lines.push("  }"), lines.push(""), definition.kind === "MESSAGE" && (lines.push("  while (true) {"), lines.push("    switch (bb.readVarUint()) {"), lines.push("      case 0:"), lines.push("        return result;"), lines.push(""), indent = "        ");
  for (let fieldIdx = 0; fieldIdx < definition.fields.length; fieldIdx++) {
    let field = definition.fields[fieldIdx],
      readExpr;
    switch (field.type) {
      case "bool":
        {
          readExpr = "!!bb.readByte()";
          break;
        }
      case "byte":
        {
          readExpr = "bb.readByte()";
          break;
        }
      case "int":
        {
          readExpr = "bb.readVarInt()";
          break;
        }
      case "uint":
        {
          readExpr = "bb.readVarUint()";
          break;
        }
      case "float":
        {
          readExpr = "bb.readVarFloat()";
          break;
        }
      case "string":
        {
          readExpr = "bb.readString()";
          break;
        }
      case "int64":
        {
          readExpr = "bb.readVarInt64()";
          break;
        }
      case "uint64":
        {
          readExpr = "bb.readVarUint64()";
          break;
        }
      default:
        {
          let fieldDef = definitions[field.type];
          fieldDef ? fieldDef.kind === "ENUM" ? readExpr = "this[" + quote(fieldDef.name) + "][bb.readVarUint()]" : readExpr = "this[" + quote("decode" + fieldDef.name) + "](bb)" : throwAt("Invalid type " + quote(field.type) + " for field " + quote(field.name), field.line, field.column);
        }
    }
    definition.kind === "MESSAGE" && lines.push("      case " + field.value + ":"), field.isArray ? field.isDeprecated ? field.type === "byte" ? lines.push(indent + "bb.readByteArray();") : (lines.push(indent + "var length = bb.readVarUint();"), lines.push(indent + "while (length-- > 0) " + readExpr + ";")) : field.type === "byte" ? lines.push(indent + "result[" + quote(field.name) + "] = bb.readByteArray();") : (lines.push(indent + "var length = bb.readVarUint();"), lines.push(indent + "var values = result[" + quote(field.name) + "] = Array(length);"), lines.push(indent + "for (var i = 0; i < length; i++) values[i] = " + readExpr + ";")) : field.isDeprecated ? lines.push(indent + readExpr + ";") : lines.push(indent + "result[" + quote(field.name) + "] = " + readExpr + ";"), definition.kind === "MESSAGE" && (lines.push("        break;"), lines.push(""));
  }
  return definition.kind === "MESSAGE" ? (lines.push("      default:"), lines.push('        throw new Error("Attempted to parse invalid message");'), lines.push("    }"), lines.push("  }")) : lines.push("  return result;"), lines.push("}"), lines.join(`
`);
}
function compileEncode(definition, definitions) {
  let lines = [];
  lines.push("function (message, bb) {"), lines.push("  var isTopLevel = !bb;"), lines.push("  if (isTopLevel) bb = new this.ByteBuffer();");
  for (let fieldIdx = 0; fieldIdx < definition.fields.length; fieldIdx++) {
    let field = definition.fields[fieldIdx],
      writeCode;
    if (!field.isDeprecated) {
      switch (field.type) {
        case "bool":
          {
            writeCode = "bb.writeByte(value);";
            break;
          }
        case "byte":
          {
            writeCode = "bb.writeByte(value);";
            break;
          }
        case "int":
          {
            writeCode = "bb.writeVarInt(value);";
            break;
          }
        case "uint":
          {
            writeCode = "bb.writeVarUint(value);";
            break;
          }
        case "float":
          {
            writeCode = "bb.writeVarFloat(value);";
            break;
          }
        case "string":
          {
            writeCode = "bb.writeString(value);";
            break;
          }
        case "int64":
          {
            writeCode = "bb.writeVarInt64(value);";
            break;
          }
        case "uint64":
          {
            writeCode = "bb.writeVarUint64(value);";
            break;
          }
        default:
          {
            let fieldDef = definitions[field.type];
            if (fieldDef) fieldDef.kind === "ENUM" ? writeCode = "var encoded = this[" + quote(fieldDef.name) + '][value]; if (encoded === void 0) throw new Error("Invalid value " + JSON.stringify(value) + ' + quote(" for enum " + quote(fieldDef.name)) + "); bb.writeVarUint(encoded);" : writeCode = "this[" + quote("encode" + fieldDef.name) + "](value, bb);";else throw new Error("Invalid type " + quote(field.type) + " for field " + quote(field.name));
          }
      }
      lines.push(""), lines.push("  var value = message[" + quote(field.name) + "];"), lines.push("  if (value != null) {"), definition.kind === "MESSAGE" && lines.push("    bb.writeVarUint(" + field.value + ");"), field.isArray ? field.type === "byte" ? lines.push("    bb.writeByteArray(value);") : (lines.push("    var values = value, n = values.length;"), lines.push("    bb.writeVarUint(n);"), lines.push("    for (var i = 0; i < n; i++) {"), lines.push("      value = values[i];"), lines.push("      " + writeCode), lines.push("    }")) : lines.push("    " + writeCode), definition.kind === "STRUCT" && (lines.push("  } else {"), lines.push("    throw new Error(" + quote("Missing required field " + quote(field.name)) + ");")), lines.push("  }");
    }
  }
  return definition.kind === "MESSAGE" && lines.push("  bb.writeVarUint(0);"), lines.push(""), lines.push("  if (isTopLevel) return bb.toUint8Array();"), lines.push("}"), lines.join(`
`);
}
function compileSchemaJs(schema) {
  let defsByName = {},
    packageName = schema.package,
    lines = [];
  packageName !== null ? lines.push("var " + packageName + " = exports || " + packageName + " || {}, exports;") : (lines.push("var exports = exports || {};"), packageName = "exports"), lines.push(packageName + ".ByteBuffer = " + packageName + '.ByteBuffer || require("kiwi-schema").ByteBuffer;');
  for (let defIdx = 0; defIdx < schema.definitions.length; defIdx++) {
    let definition = schema.definitions[defIdx];
    defsByName[definition.name] = definition;
  }
  for (let defIdx = 0; defIdx < schema.definitions.length; defIdx++) {
    let definition = schema.definitions[defIdx];
    switch (definition.kind) {
      case "ENUM":
        {
          let enumMap = {};
          for (let enumFieldIdx = 0; enumFieldIdx < definition.fields.length; enumFieldIdx++) {
            let enumField = definition.fields[enumFieldIdx];
            enumMap[enumField.name] = enumField.value, enumMap[enumField.value] = enumField.name;
          }
          lines.push(packageName + "[" + quote(definition.name) + "] = " + JSON.stringify(enumMap, null, 2) + ";");
          break;
        }
      case "STRUCT":
      case "MESSAGE":
        {
          lines.push(""), lines.push(packageName + "[" + quote("decode" + definition.name) + "] = " + compileDecode(definition, defsByName) + ";"), lines.push(""), lines.push(packageName + "[" + quote("encode" + definition.name) + "] = " + compileEncode(definition, defsByName) + ";");
          break;
        }
      default:
        {
          throwAt("Invalid definition kind " + quote(definition.kind), definition.line, definition.column);
          break;
        }
    }
  }
  return lines.push(""), lines.join(`
`);
}
function compileSchema(schema) {
  let exportsObj = {
    ByteBuffer: ByteBuffer
  };
  return new Function("exports", compileSchemaJs(schema))(exportsObj), exportsObj;
}
var NATIVE_TYPES = ["bool", "byte", "int", "uint", "float", "string", "int64", "uint64"],
  DEFINITION_KINDS = ["ENUM", "STRUCT", "MESSAGE"];
function decodeBinarySchema(input) {
  let buffer = input instanceof ByteBuffer ? input : new ByteBuffer(input),
    definitionCount = buffer.readVarUint(),
    definitions = [];
  for (let defIdx = 0; defIdx < definitionCount; defIdx++) {
    let name = buffer.readString(),
      kindByte = buffer.readByte(),
      fieldCount = buffer.readVarUint(),
      fields = [];
    for (let fieldIdx = 0; fieldIdx < fieldCount; fieldIdx++) {
      let fieldName = buffer.readString(),
        typeCode = buffer.readVarInt(),
        isArray = !!(buffer.readByte() & 1),
        value = buffer.readVarUint();
      fields.push({
        name: fieldName,
        line: 0,
        column: 0,
        type: DEFINITION_KINDS[kindByte] === "ENUM" ? null : typeCode,
        isArray: isArray,
        isDeprecated: !1,
        value: value
      });
    }
    definitions.push({
      name: name,
      line: 0,
      column: 0,
      kind: DEFINITION_KINDS[kindByte],
      fields: fields
    });
  }
  for (let defIdx = 0; defIdx < definitionCount; defIdx++) {
    let defFields = definitions[defIdx].fields;
    for (let fieldIdx = 0; fieldIdx < defFields.length; fieldIdx++) {
      let field = defFields[fieldIdx],
        fieldType = field.type;
      if (fieldType !== null && fieldType < 0) {
        if (~fieldType >= NATIVE_TYPES.length) throw new Error("Invalid type " + fieldType);
        field.type = NATIVE_TYPES[~fieldType];
      } else {
        if (fieldType !== null && fieldType >= definitions.length) throw new Error("Invalid type " + fieldType);
        field.type = fieldType === null ? null : definitions[fieldType].name;
      }
    }
  }
  return {
    package: null,
    definitions: definitions
  };
}
let zstdModule, zstdInstance, zstdHeap;
const zstdImports = {
  env: {
    emscripten_notify_memory_growth: memoryIndex => {
      zstdHeap = new Uint8Array(zstdInstance.exports.memory.buffer);
    }
  }
};
class ZstdDecoder {
  init() {
    return zstdModule || (typeof fetch < "u" ? zstdModule = fetch(`data:application/wasm;base64,${ZSTD_WASM_BASE64}`).then(response => response.arrayBuffer()).then(wasmBytes => WebAssembly.instantiate(wasmBytes, zstdImports)).then(this._init) : zstdModule = WebAssembly.instantiate(Buffer.from(ZSTD_WASM_BASE64, "base64"), zstdImports).then(this._init), zstdModule);
  }
  _init(source) {
    zstdInstance = source.instance, zstdImports.env.emscripten_notify_memory_growth(0);
  }
  decode(compressed, uncompressedSize = 0) {
    if (!zstdInstance) throw new Error("ZSTDDecoder: Await .init() before decoding.");
    const inputSize = compressed.byteLength,
      inputPtr = zstdInstance.exports.malloc(inputSize);
    zstdHeap.set(compressed, inputPtr), uncompressedSize = uncompressedSize || Number(zstdInstance.exports.ZSTD_findDecompressedSize(inputPtr, inputSize));
    const outputPtr = zstdInstance.exports.malloc(uncompressedSize),
      resultSize = zstdInstance.exports.ZSTD_decompress(outputPtr, uncompressedSize, inputPtr, inputSize),
      result = zstdHeap.slice(outputPtr, outputPtr + resultSize);
    return zstdInstance.exports.free(inputPtr), zstdInstance.exports.free(outputPtr), result;
  }
}
const ZSTD_WASM_BASE64 = "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AikACDcACCAHIDo3AAAgEUEZSA0BIARBGGohBANAIAIpABAhOiAEIAIpABg3AAggBCA6NwAAIAIpACAhOiAEIAIpACg3ABggBCA6NwAQIAJBIGohAiAEQSBqIgQgCkkNAAsMAQsCQAJAIAUoAswCIhEgBUHgAWogJUEHcUEMbGoiDygCACICaiIHIBxLDQAgCSAPKAIEIgogAmoiBmogG0sNACAGQSBqIBQgCWtNDQELIAUgDygCCDYCoAEgBSAPKQIANwOYASAJIBQgBUGYAWogBUHMAmogHCALIBcgIhAgIQYMAQsgAiAJaiEEIA8oAgghFSARKQAAITogCSARKQAINwAIIAkgOjcAAAJAIAJBEUkNACARKQAQITogCSARKQAYNwAYIAkgOjcAECACQRBrQRFIDQAgEUEQaiECIAlBIGohEgNAIAIpABAhOiASIAIpABg3AAggEiA6NwAAIAIpACAhOiASIAIpACg3ABggEiA6NwAQIAJBIGohAiASQSBqIhIgBEkNAAsLIAQgFWshAiAFIAc2AswCIAQgC2sgFUkEQCAVIAQgF2tLDQwgIiAiIAIgC2siD2oiByAKak8EQCAKRQ0CIAQgByAK/AoAAAwCC0EAIA9rIgIEQCAEIAcgAvwKAAALIAogD2ohCiAEIA9rIQQgCyECCyAVQRBPBEAgAikAACE6IAQgAikACDcACCAEIDo3AAAgCkERSA0BIAQgCmohByAEQRBqIQQDQCACKQAQITogBCACKQAYNwAIIAQgOjcAACACKQAgITogBCACKQAoNwAYIAQgOjcAECACQSBqIQIgBEEgaiIEIAdJDQALDAELAkAgFUEHTQRAIAQgAi0AADoAACAEIAItAAE6AAEgBCACLQACOgACIAQgAi0AAzoAAyAEIAIgFUECdCIHQeAaaigCAGoiAigAADYABCACIAdBgBtqKAIAayECDAELIAQgAikAADcAAAsgCkEJSQ0AIAQgCmohDyAEQQhqIgcgAkEIaiICa0EPTARAA0AgByACKQAANwAAIAJBCGohAiAHQQhqIgcgD0kNAAwCCwALIAIpAAAhOiAHIAIpAAg3AAggByA6NwAAIApBGUgNACAEQRhqIQQDQCACKQAQITogBCACKQAYNwAIIAQgOjcAACACKQAgITogBCACKQAoNwAYIAQgOjcAECACQSBqIQIgBEEgaiIEIA9JDQALCyAGQYh/SwRAIAYhAwwLCyAFQeABaiAlQQdxQQxsaiICIA02AgggAiAMNgIEIAIgEDYCAAsgBiAJaiEJICVBAWohJSAQIC1qIAxqIS0MAQsLIAUoArABIAUoArQBRw0HIAUoAqwBQSBHDQcgDiAoayEQA0ACQCAOIBBMBEBBACECA0AgAkEDRg0CIDIgAkECdCIDaiADICZqKAIANgIAIAJBAWohAgwACwALIAVB4AFqIBBBB3FBDGxqIQoCfwJAIAgoAoTsAUECRgRAIAUoAswCIg8gCigCACIEaiIHIAgoAoDsASICSwRAIAIgD0cEQCACIA9rIgIgFCAJa0sNCyAJIA8gAhAfIAogBCACayIENgIAIAIgCWohCQsgBSAWNgLMAiAIQQA2AoTsAQJAAkACQCAEQYCABEoNACAJIAooAgQiDSAEaiIGaiAbSw0AIAZBIGogFCAJa00NAQsgBSAKKAIINgJQIAUgCikCADcDSCAJIBQgBUHIAGogBUHMAmogGSALIBcgIhAgIQYMAQsgBCAWaiEHIAQgCWohDCAKKAIIIQogFikAACE6IAkgFikACDcACCAJIDo3AAACQCAEQRFJDQAgHikAACE6IAkgHikACDcAGCAJIDo3ABAgBEEQa0ERSA0AIAlBIGohAiAeIQQDQCAEKQAQITogAiAEKQAYNwAIIAIgOjcAACAEKQAgITogAiAEKQAoNwAYIAIgOjcAECAEQSBqIQQgAkEgaiICIAxJDQALCyAMIAprIQIgBSAHNgLMAiAMIAtrIApJBEAgCiAMIBdrSw0PICIgIiACIAtrIgdqIgQgDWpPBEAgDUUNAiAMIAQgDfwKAAAMAgtBACAHayICBEAgDCAEIAL8CgAACyAHIA1qIQ0gDCAHayEMIAshAgsgCkEQTwRAIAIpAAAhOiAMIAIpAAg3AAggDCA6NwAAIA1BEUgNASAMIA1qIQcgDEEQaiEEA0AgAikAECE6IAQgAikAGDcACCAEIDo3AAAgAikAICE6IAQgAikAKDcAGCAEIDo3ABAgAkEgaiECIARBIGoiBCAHSQ0ACwwBCwJAIApBB00EQCAMIAItAAA6AAAgDCACLQABOgABIAwgAi0AAjoAAiAMIAItAAM6AAMgDCACIApBAnQiBEHgGmooAgBqIgIoAAA2AAQgAiAEQYAbaigCAGshAgwBCyAMIAIpAAA3AAALIA1BCUkNACAMIA1qIQcgDEEIaiIEIAJBCGoiAmtBD0wEQANAIAQgAikAADcAACACQQhqIQIgBEEIaiIEIAdJDQAMAgsACyACKQAAITogBCACKQAINwAIIAQgOjcAACANQRlIDQAgDEEYaiEEA0AgAikAECE6IAQgAikAGDcACCAEIDo3AAAgAikAICE6IAQgAikAKDcAGCAEIDo3ABAgAkEgaiECIARBIGoiBCAHSQ0ACwsgBkGJf08EQCAGIQMMDgsgGSEcIAYgCWoMAwsgB0EgayECAkACQCAHIBxLDQAgCSAKKAIEIhIgBGoiDGogAksNACAMQSBqIBQgCWtNDQELIAUgCigCCDYCYCAFIAopAgA3A1ggCSAUIAIgBUHYAGogBUHMAmogHCALIBcgIhAhIQwMAgsgBCAJaiEGIAooAgghCiAPKQAAITogCSAPKQAINwAIIAkgOjcAAAJAIARBEUkNACAPKQAQITogCSAPKQAYNwAYIAkgOjcAECAEQRBrQRFIDQAgD0EQaiECIAlBIGohBANAIAIpABAhOiAEIAIpABg3AAggBCA6NwAAIAIpACAhOiAEIAIpACg3ABggBCA6NwAQIAJBIGohAiAEQSBqIgQgBkkNAAsLIAYgCmshAiAFIAc2AswCIAYgC2sgCkkEQCAKIAYgF2tLDQ0gIiAiIAIgC2siB2oiBCASak8EQCASRQ0DIAYgBCAS/AoAAAwDC0EAIAdrIgIEQCAGIAQgAvwKAAALIAcgEmohEiAGIAdrIQYgCyECCyAKQRBPBEAgAikAACE6IAYgAikACDcACCAGIDo3AAAgEkERSA0CIAYgEmohByAGQRBqIQQDQCACKQAQITogBCACKQAYNwAIIAQgOjcAACACKQAgITogBCACKQAoNwAYIAQgOjcAECACQSBqIQIgBEEgaiIEIAdJDQALDAILAkAgCkEHTQRAIAYgAi0AADoAACAGIAItAAE6AAEgBiACLQACOgACIAYgAi0AAzoAAyAGIAIgCkECdCIEQeAaaigCAGoiAigAADYABCACIARBgBtqKAIAayECDAELIAYgAikAADcAAAsgEkEJSQ0BIAYgEmohByAGQQhqIgQgAkEIaiICa0EPTARAA0AgBCACKQAANwAAIAJBCGohAiAE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";
function guidStr(guid) {
  if (!guid) return "";
  const sessionId = guid.sessionID,
    localId = guid.localID;
  return typeof sessionId == "number" && Number.isFinite(sessionId) && typeof localId == "number" && Number.isFinite(localId) ? `${sessionId}:${localId}` : "";
}
let zstdReady = null;
function getZstd() {
  if (!zstdReady) {
    const decoder = new ZstdDecoder();
    zstdReady = decoder.init().then(() => decoder);
  }
  return zstdReady;
}
async function decompressChunk(bytes) {
  return bytes.length >= 4 && bytes[0] === 40 && bytes[1] === 181 && bytes[2] === 47 && bytes[3] === 253 ? (await getZstd()).decode(bytes) : inflateSync(bytes);
}
function detectMime(bytes) {
  const head = Array.from(bytes.slice(0, 8));
  if (head[0] === 137 && head[1] === 80 && head[2] === 78 && head[3] === 71) return "image/png";
  if (head[0] === 255 && head[1] === 216) return "image/jpeg";
  if (bytes.length >= 6) {
    const magic = String.fromCharCode(...bytes.slice(0, 6));
    if (magic === "GIF87a" || magic === "GIF89a") return "image/gif";
  }
  if (bytes.length >= 12) {
    const magic = String.fromCharCode(...bytes.slice(0, 4)),
      webpTag = String.fromCharCode(...bytes.slice(8, 12));
    if (magic === "RIFF" && webpTag === "WEBP") return "image/webp";
  }
  return "application/octet-stream";
}
const FIG_HEADERS = new Set(["fig-kiwi", "fig-jam.", "fig-deck", "fig-make", "fig-site", "fig-buzz"]);
async function decodeCanvasFig(bytes) {
  const header = String.fromCharCode(...bytes.slice(0, 8));
  if (!FIG_HEADERS.has(header)) throw new Error(`Unexpected canvas header: ${JSON.stringify(header)}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    version = view.getUint32(8, !0),
    chunks = [];
  let offset = 12;
  for (; offset + 4 <= bytes.length;) {
    const chunkLen = view.getUint32(offset, !0);
    offset += 4, chunks.push(bytes.subarray(offset, offset + chunkLen)), offset += chunkLen;
  }
  if (chunks.length < 2) throw new Error("Not enough chunks in canvas.fig");
  const [schemaChunk, dataChunk] = await Promise.all([decompressChunk(chunks[0]), decompressChunk(chunks[1])]),
    schema = decodeBinarySchema(schemaChunk),
    compiled = compileSchema(schema),
    message = compiled.decodeMessage(dataChunk),
    nodeChanges = message.nodeChanges ?? [],
    blobs = message.blobs ?? [],
    nodesById = new Map();
  for (const node of nodeChanges) {
    const guidKey = guidStr(node.guid);
    guidKey && nodesById.set(guidKey, node);
  }
  for (const node of nodeChanges) {
    const parentIndex = node.parentIndex;
    if (!parentIndex) continue;
    const parent = nodesById.get(guidStr(parentIndex.guid));
    parent && (parent.children ||= []).push(node);
  }
  for (const node of nodeChanges) node.children && node.children.length > 1 && node.children.sort((childA, childB) => {
    const posA = childA.parentIndex.position,
      posB = childB.parentIndex.position;
    return posA < posB ? -1 : posA > posB ? 1 : 0;
  });
  const rootNode = nodesById.get("0:0");
  if (!rootNode) throw new Error("No root node 0:0");
  return {
    version: version,
    schema: schema,
    compiled: compiled,
    message: message,
    nodes: nodesById,
    root: rootNode,
    blobs: blobs
  };
}
async function decodeFig(bytes) {
  const isZip = bytes[0] === 80 && bytes[1] === 75,
    images = new Map();
  let meta;
  if (isZip) {
    const zipEntries = unzipSync(bytes);
    let canvasBytes;
    for (const [entryName, entryBytes] of Object.entries(zipEntries)) if (entryName.endsWith(".fig")) canvasBytes = entryBytes;else if (entryName.endsWith(".json")) try {
      meta = JSON.parse(new TextDecoder().decode(entryBytes));
    } catch {} else if (entryName.startsWith("images/")) {
      const hash = entryName.slice(7);
      images.set(hash, {
        hash: hash,
        bytes: entryBytes,
        mime: detectMime(entryBytes)
      });
    }
    if (!canvasBytes) throw new Error("No canvas.fig in archive");
    return {
      ...(await decodeCanvasFig(canvasBytes)),
      images: images,
      meta: meta
    };
  } else return {
    ...(await decodeCanvasFig(bytes)),
    images: images,
    meta: meta
  };
}
const PATH_CMD_BYTES = [0, 8, 8, 16, 24];
function parseCommandsBlob(blob) {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength),
    commands = [];
  let offset = 0;
  for (; offset < blob.length;) {
    const cmdByte = blob[offset++];
    if (offset + (PATH_CMD_BYTES[cmdByte] ?? 0) > blob.length) break;
    if (cmdByte === 0) commands.push(["Z"]);else if (cmdByte === 1) commands.push(["M", view.getFloat32(offset, !0), view.getFloat32(offset + 4, !0)]), offset += 8;else if (cmdByte === 2) commands.push(["L", view.getFloat32(offset, !0), view.getFloat32(offset + 4, !0)]), offset += 8;else if (cmdByte === 3) commands.push(["Q", view.getFloat32(offset, !0), view.getFloat32(offset + 4, !0), view.getFloat32(offset + 8, !0), view.getFloat32(offset + 12, !0)]), offset += 16;else if (cmdByte === 4) commands.push(["C", view.getFloat32(offset, !0), view.getFloat32(offset + 4, !0), view.getFloat32(offset + 8, !0), view.getFloat32(offset + 12, !0), view.getFloat32(offset + 16, !0), view.getFloat32(offset + 20, !0)]), offset += 24;else break;
  }
  return commands;
}
function pathToD(commands) {
  const parts = [];
  let inSubpath = !1;
  for (const cmd of commands) {
    if (cmd[0] === "Z") {
      inSubpath && parts.push("Z");
      continue;
    }
    cmd[0] === "M" && (inSubpath = !0), parts.push(cmd[0] + " " + cmd.slice(1).map(coord => +coord.toFixed(3)).join(" "));
  }
  return parts.join(" ");
}
function nodeSummary(node) {
  return {
    id: guidStr(node.guid),
    name: node.name,
    type: node.type,
    size: node.size ? {
      w: node.size.x,
      h: node.size.y
    } : void 0,
    childCount: node.children?.length ?? 0,
    childIds: (node.children ?? []).map(child => guidStr(child.guid))
  };
}
class FigDocument {
  constructor(decoded) {
    this.decoded = decoded;
  }
  decoded;
  static async load(bytes) {
    return new FigDocument(await decodeFig(bytes));
  }
  get root() {
    return this.decoded.root;
  }
  pages() {
    return (this.root.children ?? []).filter(child => child.type === "CANVAS" && !child.internalOnly).map(nodeSummary);
  }
  frames(guid) {
    return (this.getNode(guid)?.children ?? []).map(nodeSummary);
  }
  getNode(guid) {
    return this.decoded.nodes.get(guid);
  }
  summary(guid) {
    const node = this.getNode(guid);
    return node && nodeSummary(node);
  }
  nodeProps(guid) {
    const node = this.getNode(guid);
    if (!node) return;
    const props = {};
    for (const [key, value] of Object.entries(node)) key === "children" || key === "parentIndex" || (props[key] = value);
    return props;
  }
  find(query, options = {}) {
    const matches = [],
      walk = node => {
        node.name && (options.exact ? node.name === query : node.name.toLowerCase().includes(query.toLowerCase())) && matches.push(nodeSummary(node));
        for (const child of node.children ?? []) walk(child);
      };
    return walk(this.root), matches;
  }
  tree(guid, maxDepth = 3) {
    const startNode = this.getNode(guid);
    if (!startNode) return `(missing ${guid})`;
    const lines = [],
      walk = (node, depth) => {
        const sizeText = node.size ? ` ${Math.round(node.size.x)}×${Math.round(node.size.y)}` : "";
        if (lines.push(`${"  ".repeat(depth)}[${node.type ?? "?"}] ${node.name ?? ""} (${guidStr(node.guid)})${sizeText}`), depth < maxDepth) for (const child of node.children ?? []) walk(child, depth + 1);
      };
    return walk(startNode, 0), lines.join(`
`);
  }
}
function pushWarning(ctx, node, kind, message) {
  ctx.warnings.push({
    nodeId: node ? guidStr(node.guid) : "-",
    nodeType: node?.type,
    nodeName: node?.name,
    kind: kind,
    message: message
  });
}
function nextUid(ctx, prefix) {
  return `${prefix}${ctx.uid.n++}`;
}
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}
function fmtNum(value) {
  return Math.abs(value - Math.round(value)) < 1e-4 ? String(Math.round(value)) : value.toFixed(3);
}
function cssColor(color, opacity = 1) {
  const alpha = color.a * opacity,
    red = Math.round(color.r * 255),
    green = Math.round(color.g * 255),
    blue = Math.round(color.b * 255);
  return alpha >= 0.999 ? `rgb(${red},${green},${blue})` : `rgba(${red},${green},${blue},${+alpha.toFixed(4)})`;
}
function bytesToHex(bytes) {
  let hex = "";
  for (let byteIdx = 0; byteIdx < bytes.length; byteIdx++) hex += bytes[byteIdx].toString(16).padStart(2, "0");
  return hex;
}
function bytesToBase64(bytes) {
  if (typeof Buffer < "u") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (let byteIdx = 0; byteIdx < bytes.length; byteIdx++) binary += String.fromCharCode(bytes[byteIdx]);
  return btoa(binary);
}
function invertMatrix(matrix) {
  const {
      m00: m00,
      m01: m01,
      m02: m02,
      m10: m10,
      m11: m11,
      m12: m12
    } = matrix,
    det = m00 * m11 - m01 * m10;
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;
  return {
    m00: m11 * invDet,
    m01: -m01 * invDet,
    m02: (m01 * m12 - m11 * m02) * invDet,
    m10: -m10 * invDet,
    m11: m00 * invDet,
    m12: (m10 * m02 - m00 * m12) * invDet
  };
}
function transformPoint(matrix, pointX, pointY) {
  return [matrix.m00 * pointX + matrix.m01 * pointY + matrix.m02, matrix.m10 * pointX + matrix.m11 * pointY + matrix.m12];
}
function linearGradientCss(paint, width, height) {
  const opacity = paint.opacity ?? 1,
    stops = (paint.stops ?? []).map(stop => ({
      color: cssColor(stop.color, opacity),
      position: stop.position
    })),
    transform = paint.transform,
    inverse = transform && invertMatrix(transform);
  if (inverse && width > 0 && height > 0) {
    const [startNx, startNy] = transformPoint(inverse, 0, 0.5),
      [endNx, endNy] = transformPoint(inverse, 1, 0.5),
      startX = startNx * width,
      startY = startNy * height,
      endX = endNx * width,
      endY = endNy * height,
      deltaX = endX - startX,
      deltaY = endY - startY,
      angleDeg = 90 + Math.atan2(deltaY, deltaX) * (180 / Math.PI),
      angleRad = angleDeg * (Math.PI / 180),
      lineLength = Math.abs(width * Math.sin(angleRad)) + Math.abs(height * Math.cos(angleRad)),
      centerX = width / 2,
      centerY = height / 2,
      projectOnLine = (pointX, pointY) => (pointX - centerX) * Math.sin(angleRad) - (pointY - centerY) * Math.cos(angleRad),
      lineStart = -lineLength / 2,
      startOffset = (projectOnLine(startX, startY) - lineStart) / lineLength,
      offsetSpan = (projectOnLine(endX, endY) - lineStart) / lineLength - startOffset,
      stopsCss = stops.map(stopEntry => `${stopEntry.color} ${((startOffset + stopEntry.position * offsetSpan) * 100).toFixed(2)}%`).join(", ");
    return `linear-gradient(${fmtNum(angleDeg)}deg, ${stopsCss})`;
  }
  return `linear-gradient(180deg, ${stops.map(stop => `${stop.color} ${(stop.position * 100).toFixed(2)}%`).join(", ")})`;
}
function radialGradientCss(paint, width, height, warn) {
  const opacity = paint.opacity ?? 1,
    stopsCss = (paint.stops ?? []).map(stop => `${cssColor(stop.color, opacity)} ${(stop.position * 100).toFixed(2)}%`).join(", "),
    transform = paint.transform,
    inverse = transform && invertMatrix(transform);
  if (inverse && width > 0 && height > 0) {
    const [centerNx, centerNy] = transformPoint(inverse, 0.5, 0.5),
      rxDx = inverse.m00 * 0.5 * width,
      ryDx = inverse.m10 * 0.5 * height,
      rxDy = inverse.m01 * 0.5 * width,
      ryDy = inverse.m11 * 0.5 * height,
      radiusX = Math.hypot(rxDx, rxDy),
      radiusY = Math.hypot(ryDx, ryDy);
    return Math.abs(rxDx * ryDx + rxDy * ryDy) > 1 && warn?.("paint-radial-skew", "Rotated radial gradient approximated as axis-aligned"), `radial-gradient(${fmtNum(radiusX)}px ${fmtNum(radiusY)}px at ${(centerNx * 100).toFixed(2)}% ${(centerNy * 100).toFixed(2)}%, ${stopsCss})`;
  }
  return `radial-gradient(50% 50% at 50% 50%, ${stopsCss})`;
}
function conicGradientCss(paint, width, height) {
  const opacity = paint.opacity ?? 1,
    stopsCss = (paint.stops ?? []).map(stop => `${cssColor(stop.color, opacity)} ${(stop.position * 360).toFixed(2)}deg`).join(", "),
    transform = paint.transform,
    inverse = transform && invertMatrix(transform);
  let angleDeg = 0,
    centerXPct = 50,
    centerYPct = 50;
  if (inverse) {
    const [centerNx, centerNy] = transformPoint(inverse, 0.5, 0.5),
      [edgeNx, edgeNy] = transformPoint(inverse, 1, 0.5);
    angleDeg = Math.atan2((edgeNy - centerNy) * height, (edgeNx - centerNx) * width) * (180 / Math.PI) + 90, centerXPct = centerNx * 100, centerYPct = centerNy * 100;
  }
  return `conic-gradient(from ${fmtNum(angleDeg)}deg at ${fmtNum(centerXPct)}% ${fmtNum(centerYPct)}%, ${stopsCss})`;
}
function paintToCssLayer(paint, ctx) {
  if (paint.visible === !1) return;
  const {
      w: width,
      h: height,
      warn: warn
    } = ctx,
    opacity = paint.opacity ?? 1;
  switch (paint.type) {
    case "SOLID":
      {
        if (!paint.color) return;
        const solidCss = cssColor(paint.color, opacity);
        return `linear-gradient(${solidCss},${solidCss})`;
      }
    case "GRADIENT_LINEAR":
      return linearGradientCss(paint, width, height);
    case "GRADIENT_RADIAL":
      return radialGradientCss(paint, width, height, warn);
    case "GRADIENT_DIAMOND":
      return warn?.("paint-diamond", "Diamond gradient approximated as radial"), radialGradientCss(paint, width, height, warn);
    case "GRADIENT_ANGULAR":
      return conicGradientCss(paint, width, height);
    case "IMAGE":
      {
        const imageHash = paint.image?.hash;
        if (!imageHash) return;
        const imageUrl = ctx.imageRef?.(imageHash);
        if (!imageUrl) return;
        opacity < 1 && warn?.("paint-image-opacity", "Image fill opacity not supported in CSS");
        const scaleMode = paint.imageScaleMode ?? "FILL";
        if (scaleMode === "STRETCH" || scaleMode === "CROP") {
          const imgTransform = paint.transform;
          if (imgTransform && Math.abs(imgTransform.m01) < 1e-6 && Math.abs(imgTransform.m10) < 1e-6) {
            const bgWidthPct = 100 / imgTransform.m00,
              bgHeightPct = 100 / imgTransform.m11,
              bgPosX = Math.abs(1 - imgTransform.m00) > 1e-6 ? imgTransform.m02 / (1 - imgTransform.m00) * 100 : 50,
              bgPosY = Math.abs(1 - imgTransform.m11) > 1e-6 ? imgTransform.m12 / (1 - imgTransform.m11) * 100 : 50;
            return `${imageUrl} ${fmtNum(bgPosX)}% ${fmtNum(bgPosY)}% / ${fmtNum(bgWidthPct)}% ${fmtNum(bgHeightPct)}% no-repeat`;
          }
          return imgTransform && (Math.abs(imgTransform.m01) > 1e-6 || Math.abs(imgTransform.m10) > 1e-6) && warn?.("paint-image-rotate", `imageScaleMode=${scaleMode} with rotation not supported`), `${imageUrl} center / cover no-repeat`;
        }
        if (scaleMode === "TILE") {
          const tileScale = paint.scale ?? 1,
            imgWidth = paint.originalImageWidth,
            imgHeight = paint.originalImageHeight,
            tileSize = imgWidth != null && imgHeight != null ? `${fmtNum(imgWidth * tileScale)}px ${fmtNum(imgHeight * tileScale)}px` : "auto";
          return `${imageUrl} top left / ${tileSize} repeat`;
        }
        return `${imageUrl} center / ${scaleMode === "FIT" ? "contain" : "cover"} no-repeat`;
      }
    case "VIDEO":
    case "EMOJI":
      warn?.("paint-unsupported", `Paint type ${paint.type} skipped`);
      return;
    default:
      warn?.("paint-unknown", `Unknown paint type ${paint.type}`);
      return;
  }
}
function lastSolidPaint(paints) {
  if (paints) for (let paintIdx = paints.length - 1; paintIdx >= 0; paintIdx--) {
    const paint = paints[paintIdx];
    if (paint.type === "SOLID" && paint.visible !== !1) return paint;
  }
}
function borderStyleProps(node, _unused) {
  const result = {
      shadows: [],
      entries: {}
    },
    weight = node.strokeWeight ?? 0,
    stroke = lastSolidPaint(node.strokePaints),
    strokeCss = stroke?.color ? cssColor(stroke.color, stroke.opacity ?? 1) : void 0;
  if (!strokeCss) return result;
  result.color = strokeCss;
  const independent = node.borderStrokeWeightsIndependent;
  if (node.bordersTakeSpace, independent) {
    const topW = node.borderTopWeight ?? weight,
      rightW = node.borderRightWeight ?? weight,
      bottomW = node.borderBottomWeight ?? weight,
      leftW = node.borderLeftWeight ?? weight,
      lineStyle = node.dashPattern?.length ? "dashed" : "solid";
    return topW && (result.entries.borderTop = `${fmtNum(topW)}px ${lineStyle} ${strokeCss}`), rightW && (result.entries.borderRight = `${fmtNum(rightW)}px ${lineStyle} ${strokeCss}`), bottomW && (result.entries.borderBottom = `${fmtNum(bottomW)}px ${lineStyle} ${strokeCss}`), leftW && (result.entries.borderLeft = `${fmtNum(leftW)}px ${lineStyle} ${strokeCss}`), result;
  }
  if (weight > 0) {
    const align = node.strokeAlign ?? "INSIDE";
    if (node.dashPattern?.length) {
      const offset = align === "INSIDE" ? -weight : align === "CENTER" ? -weight / 2 : 0;
      result.entries.outline = `${fmtNum(weight)}px dashed ${strokeCss}`, result.entries.outlineOffset = `${fmtNum(offset)}px`;
    } else align === "INSIDE" ? result.shadows.push(`inset 0 0 0 ${fmtNum(weight)}px ${strokeCss}`) : align === "OUTSIDE" ? result.shadows.push(`0 0 0 ${fmtNum(weight)}px ${strokeCss}`) : result.shadows.push(`inset 0 0 0 ${fmtNum(weight / 2)}px ${strokeCss}`, `0 0 0 ${fmtNum(weight / 2)}px ${strokeCss}`);
  }
  return result;
}
function effectShadows(node) {
  const shadows = [];
  for (const effect of node.effects ?? []) effect.visible !== !1 && (effect.type === "DROP_SHADOW" && effect.color && effect.offset ? shadows.unshift(`${fmtNum(effect.offset.x)}px ${fmtNum(effect.offset.y)}px ${fmtNum(effect.radius ?? 0)}px ${fmtNum(effect.spread ?? 0)}px ${cssColor(effect.color)}`) : effect.type === "INNER_SHADOW" && effect.color && effect.offset && shadows.unshift(`inset ${fmtNum(effect.offset.x)}px ${fmtNum(effect.offset.y)}px ${fmtNum(effect.radius ?? 0)}px ${fmtNum(effect.spread ?? 0)}px ${cssColor(effect.color)}`));
  return shadows;
}
const BLEND_MODES = {
  MULTIPLY: "multiply",
  SCREEN: "screen",
  OVERLAY: "overlay",
  DARKEN: "darken",
  LIGHTEN: "lighten",
  COLOR_DODGE: "color-dodge",
  COLOR_BURN: "color-burn",
  HARD_LIGHT: "hard-light",
  SOFT_LIGHT: "soft-light",
  DIFFERENCE: "difference",
  EXCLUSION: "exclusion",
  HUE: "hue",
  SATURATION: "saturation",
  COLOR: "color",
  LUMINOSITY: "luminosity"
};
function gridTrackIndex(tracks) {
  const sorted = [...(tracks?.entries ?? [])];
  sorted.sort((trackA, trackB) => (trackA.position ?? "") < (trackB.position ?? "") ? -1 : (trackA.position ?? "") > (trackB.position ?? "") ? 1 : 0);
  const indexByGuid = new Map();
  return sorted.forEach((track, trackIdx) => indexByGuid.set(guidStr(track.id), trackIdx)), indexByGuid;
}
function gridTrackSize(track) {
  const sizeCss = sizing => sizing?.type === "FLEX" ? `${sizing.value ?? 1}fr` : sizing?.value ? `${sizing.value}px` : "auto",
    minCss = sizeCss(track?.minSizing),
    maxCss = sizeCss(track?.maxSizing);
  return minCss === maxCss ? minCss : `minmax(${minCss}, ${maxCss})`;
}
function gridTemplate(tracks, sizing) {
  const indexByGuid = gridTrackIndex(tracks);
  if (indexByGuid.size === 0) return;
  const sizeByGuid = new Map((sizing?.entries ?? []).map(entry => [guidStr(entry.id), entry.trackSize])),
    template = new Array(indexByGuid.size).fill("auto");
  for (const [trackGuid, trackIdx] of indexByGuid) template[trackIdx] = gridTrackSize(sizeByGuid.get(trackGuid));
  return template.join(" ");
}
function firstSolidColor(paints) {
  const solid = paints?.find(paint => paint.visible !== !1 && paint.type === "SOLID" && paint.color);
  return solid?.color ? cssColor(solid.color, solid.opacity ?? 1) : void 0;
}
function solidGradient(colorCss) {
  return `linear-gradient(${colorCss},${colorCss})`;
}
function computeNodeStyle(node, opts = {}) {
  const style = {},
    width = node.size?.x ?? 0,
    height = node.size?.y ?? 0;
  if (style.position = opts.isRoot ? "relative" : "absolute", !opts.isRoot && node.transform) {
    const matrix = node.transform;
    Math.abs(matrix.m00 - 1) < 1e-5 && Math.abs(matrix.m11 - 1) < 1e-5 && Math.abs(matrix.m01) < 1e-5 && Math.abs(matrix.m10) < 1e-5 ? (style.left = +fmtNum(matrix.m02), style.top = +fmtNum(matrix.m12)) : (style.left = 0, style.top = 0, style.transform = `matrix(${fmtNum(matrix.m00)},${fmtNum(matrix.m10)},${fmtNum(matrix.m01)},${fmtNum(matrix.m11)},${fmtNum(matrix.m02)},${fmtNum(matrix.m12)})`, style.transformOrigin = "0 0");
  }
  style.width = +fmtNum(width), style.height = +fmtNum(height);
  const minSize = node.minSize?.value,
    maxSize = node.maxSize?.value;
  if (minSize?.x && (style.minWidth = +fmtNum(minSize.x)), minSize?.y && (style.minHeight = +fmtNum(minSize.y)), maxSize?.x && (style.maxWidth = +fmtNum(maxSize.x)), maxSize?.y && (style.maxHeight = +fmtNum(maxSize.y)), node.opacity != null && node.opacity < 1 && (style.opacity = +node.opacity.toFixed(3)), (node.clipsContent || node.frameMaskDisabled === !1) && (style.overflow = "hidden"), node.blendMode && node.blendMode !== "NORMAL" && node.blendMode !== "PASS_THROUGH") {
    const blend = BLEND_MODES[node.blendMode];
    blend && (style.mixBlendMode = blend);
  }
  const radiusTL = node.rectangleTopLeftCornerRadius ?? node.cornerRadius ?? 0,
    radiusTR = node.rectangleTopRightCornerRadius ?? node.cornerRadius ?? 0,
    radiusBR = node.rectangleBottomRightCornerRadius ?? node.cornerRadius ?? 0,
    radiusBL = node.rectangleBottomLeftCornerRadius ?? node.cornerRadius ?? 0;
  node.type === "ELLIPSE" ? style.borderRadius = "50%" : (radiusTL || radiusTR || radiusBR || radiusBL) && (style.borderRadius = radiusTL === radiusTR && radiusTR === radiusBR && radiusBR === radiusBL ? radiusTL : `${fmtNum(radiusTL)}px ${fmtNum(radiusTR)}px ${fmtNum(radiusBR)}px ${fmtNum(radiusBL)}px`);
  const paints = node.fillPaints ?? node.backgroundPaints;
  if (paints?.length) {
    const visiblePaints = paints.filter(paint => paint.visible !== !1),
      cssForPaint = paint => opts.tokenFor?.(paint) ?? (paint.color ? cssColor(paint.color, paint.opacity ?? 1) : void 0);
    if (visiblePaints.length === 1 && visiblePaints[0].type === "SOLID") {
      const soloCss = cssForPaint(visiblePaints[0]);
      soloCss && (style.backgroundColor = soloCss);
    } else if (visiblePaints.length) {
      const layers = [];
      for (let paintIdx = visiblePaints.length - 1; paintIdx >= 0; paintIdx--) {
        const layerPaint = visiblePaints[paintIdx];
        if (layerPaint.type === "SOLID") {
          const solidCss = cssForPaint(layerPaint);
          solidCss && layers.push(solidGradient(solidCss));
        } else {
          const layerCss = paintToCssLayer(layerPaint, {
            w: width,
            h: height,
            imageRef: hash => {
              const imageUrl = opts.imageRef?.(hash);
              return imageUrl ? `url(${imageUrl})` : void 0;
            }
          });
          layerCss && layers.push(layerCss);
        }
      }
      layers.length && (style.background = layers.join(", "));
    }
  }
  const border = borderStyleProps(node);
  Object.assign(style, border.entries);
  for (const effect of node.effects ?? []) effect.visible !== !1 && (effect.type === "LAYER_BLUR" ? style.filter = `blur(${fmtNum(effect.radius ?? 0)}px)` : effect.type === "BACKGROUND_BLUR" && (style.backdropFilter = `blur(${fmtNum(effect.radius ?? 0)}px)`));
  const shadows = [...border.shadows, ...effectShadows(node)];
  if (shadows.length && (style.boxShadow = shadows.join(", ")), !opts.fixed) {
    if (node.stackMode === "HORIZONTAL" || node.stackMode === "VERTICAL") {
      style.display = "flex", style.flexDirection = node.stackMode === "HORIZONTAL" ? "row" : "column", !(node.stackPrimaryAlignItems === "SPACE_EVENLY" || node.stackPrimaryAlignItems === "SPACE_BETWEEN") && node.stackSpacing && (style.gap = node.stackSpacing);
      const paddings = [node.stackPaddingTop ?? node.stackVerticalPadding, node.stackPaddingRight ?? node.stackHorizontalPadding, node.stackPaddingBottom ?? node.stackVerticalPadding, node.stackPaddingLeft ?? node.stackHorizontalPadding];
      paddings.some(pad => pad) && (style.padding = paddings.map(pad => `${fmtNum(pad ?? 0)}px`).join(" "));
      const alignMap = {
        MIN: "flex-start",
        MAX: "flex-end",
        CENTER: "center",
        SPACE_BETWEEN: "space-between",
        SPACE_EVENLY: "space-between",
        BASELINE: "baseline"
      };
      if (node.stackPrimaryAlignItems && (style.justifyContent = alignMap[node.stackPrimaryAlignItems] ?? node.stackPrimaryAlignItems.toLowerCase()), style.alignItems = node.stackCounterAlignItems ? alignMap[node.stackCounterAlignItems] ?? node.stackCounterAlignItems.toLowerCase() : "flex-start", node.stackWrap === "WRAP") {
        style.flexWrap = "wrap";
        const counterSpacing = node.stackCounterSpacing;
        counterSpacing != null && Number.isFinite(counterSpacing) ? counterSpacing !== (node.stackSpacing ?? 0) && (style.gap = `${fmtNum(counterSpacing)}px ${fmtNum(node.stackSpacing ?? 0)}px`) : counterSpacing != null && (style.alignContent = "space-between");
      }
    } else if (node.stackMode === "GRID") {
      style.display = "grid";
      const rowsTemplate = gridTemplate(node.gridRows, node.gridRowsSizing),
        colsTemplate = gridTemplate(node.gridColumns, node.gridColumnsSizing);
      rowsTemplate && (style.gridTemplateRows = rowsTemplate), colsTemplate && (style.gridTemplateColumns = colsTemplate), (node.gridRowGap || node.gridColumnGap) && (style.gap = `${fmtNum(node.gridRowGap ?? 0)}px ${fmtNum(node.gridColumnGap ?? 0)}px`);
      const gridPads = [node.stackPaddingTop ?? node.stackVerticalPadding, node.stackPaddingRight ?? node.stackHorizontalPadding, node.stackPaddingBottom ?? node.stackVerticalPadding, node.stackPaddingLeft ?? node.stackHorizontalPadding];
      gridPads.some(pad => pad) && (style.padding = gridPads.map(pad => `${fmtNum(pad ?? 0)}px`).join(" "));
    }
  }
  return (style.padding != null || style.border != null) && (style.boxSizing = "border-box"), style;
}
function fmtObject(obj, indent = "") {
  const entries = Object.entries(obj);
  return entries.length === 0 ? "{}" : entries.length <= 3 ? `{ ${entries.map(([key, val]) => `${key}: ${JSON.stringify(val)}`).join(", ")} }` : `{
${entries.map(([entryKey, entryVal]) => `${indent}  ${entryKey}: ${JSON.stringify(entryVal)},`).join(`
`)}
${indent}}`;
}
const MONO_FONT_RE = /mono|code|courier|consolas|menlo|jetbrains|inconsolata|source code|pt mono|hack\b/i,
  SERIF_FONT_RE = /serif|tiempos|copernicus|georgia|garamond|times|playfair|lora|merriweather|charter|baskerville|caslon|didot|freight|publico|canela|chronicle|sabon|minion|cambria|palatino|bookman/i;
function fontStack(family) {
  const cleaned = family.replace(/[^A-Za-z0-9 _.-]/g, "").replace(/\s+/g, " ").trim() || "sans-serif",
    quoted = /^[A-Za-z-]+$/.test(cleaned) ? cleaned : `"${cleaned}"`;
  return MONO_FONT_RE.test(family) ? `${quoted}, ui-monospace, "SF Mono", Menlo, Consolas, monospace` : !/sans/i.test(family) && SERIF_FONT_RE.test(family) ? `${quoted}, ui-serif, Georgia, "Times New Roman", serif` : `${quoted}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
}
function textStyleProps(node) {
  const style = {};
  if (node.fontName) {
    style.fontFamily = fontStack(node.fontName.family);
    const fontStyle = node.fontName.style;
    for (const [pattern, weight] of FONT_WEIGHT_PATTERNS) if (pattern.test(fontStyle)) {
      style.fontWeight = weight;
      break;
    }
    /italic/i.test(fontStyle) && (style.fontStyle = "italic");
  }
  if (node.fontSize && (style.fontSize = node.fontSize), node.textAlignHorizontal) {
    const alignMap = {
      LEFT: "left",
      RIGHT: "right",
      CENTER: "center",
      JUSTIFIED: "justify"
    };
    style.textAlign = alignMap[node.textAlignHorizontal] ?? "left";
  }
  node.textTruncation === "ENDING" && (node.maxLines ?? 0) > 0 && (node.maxLines === 1 ? (style.whiteSpace = "nowrap", style.overflow = "hidden", style.textOverflow = "ellipsis") : (style.display = "-webkit-box", style.WebkitBoxOrient = "vertical", style.WebkitLineClamp = node.maxLines, style.overflow = "hidden"));
  const lineHeight = node.lineHeight;
  if (lineHeight?.value && (lineHeight.units === "PIXELS" ? style.lineHeight = `${fmtNum(lineHeight.value)}px` : lineHeight.units === "PERCENT" ? style.lineHeight = `${lineHeight.value}%` : style.lineHeight = lineHeight.value), node.leadingTrim === "CAP_HEIGHT") {
    const fontSize = node.fontSize ?? 14,
      lineHeightPx = lineHeight?.units === "PIXELS" ? lineHeight.value : lineHeight?.units === "PERCENT" ? fontSize * lineHeight.value / 100 : lineHeight?.value ? fontSize * lineHeight.value : fontSize * 1.2,
      boxHeight = node.size?.y ?? 0,
      lineCount = Math.max(1, Math.round(boxHeight / lineHeightPx));
    boxHeight > 0 && lineCount * lineHeightPx - boxHeight > 3 && (style.textBox = "trim-both cap alphabetic");
  }
  const letterSpacing = node.letterSpacing;
  letterSpacing?.value && (style.letterSpacing = letterSpacing.units === "PERCENT" ? `${fmtNum(letterSpacing.value / 100)}em` : `${fmtNum(letterSpacing.value)}px`);
  const textColor = firstSolidColor(node.fillPaints);
  return textColor && (style.color = textColor), node.textDecoration === "UNDERLINE" ? style.textDecoration = "underline" : node.textDecoration === "STRIKETHROUGH" && (style.textDecoration = "line-through"), style;
}
const NON_LAYOUT_TYPES = new Set(["VARIABLE", "VARIABLE_SET", "STYLE", "VARIABLE_OVERRIDE", "STICKY", "WIDGET", "SLICE"]);
function layoutChildren(node) {
  return (node.children ?? []).filter(child => !NON_LAYOUT_TYPES.has(child.type ?? "") && !child.internalOnly && child.visible !== !1 && child.stackPositioning !== "ABSOLUTE");
}
const FILL_TOLERANCE = 2.5;
function isRotated(node) {
  const matrix = node.transform;
  return matrix ? Math.abs(matrix.m01) > 1e-5 || Math.abs(matrix.m10) > 1e-5 : !1;
}
function fillsCounterAxis(child, parent) {
  if (child.stackPositioning === "ABSOLUTE") return !1;
  const isHorizontal = parent.stackMode === "HORIZONTAL",
    childSize = (isHorizontal ? child.size?.y : child.size?.x) ?? 0,
    parentSize = (isHorizontal ? parent.size?.y : parent.size?.x) ?? 0,
    padStart = isHorizontal ? parent.stackPaddingTop ?? parent.stackVerticalPadding ?? 0 : parent.stackPaddingLeft ?? parent.stackHorizontalPadding ?? 0,
    padEnd = isHorizontal ? parent.stackPaddingBottom ?? parent.stackVerticalPadding ?? 0 : parent.stackPaddingRight ?? parent.stackHorizontalPadding ?? 0;
  return parentSize <= 0 || childSize <= 0 ? !1 : Math.abs(parentSize - padStart - padEnd - childSize) <= FILL_TOLERANCE;
}
function axisHugsContent(node, axis) {
  if (node.stackWrap === "WRAP" || layoutChildren(node).some(isRotated)) return !1;
  const isHorizontal = node.stackMode === "HORIZONTAL",
    alongX = axis === "primary" ? isHorizontal : !isHorizontal,
    children = layoutChildren(node);
  if (children.length === 0 || axis === "primary" && children.some(child => (child.stackChildPrimaryGrow ?? 0) > 0)) return !1;
  const huggable = axis === "primary" ? children : children.filter(child => child.stackChildAlignSelf !== "STRETCH" && !fillsCounterAxis(child, node));
  if (huggable.length === 0) return !1;
  const sizeOf = child => (alongX ? child.size?.x : child.size?.y) ?? 0,
    padStart = alongX ? node.stackPaddingLeft ?? node.stackHorizontalPadding ?? 0 : node.stackPaddingTop ?? node.stackVerticalPadding ?? 0,
    padEnd = alongX ? node.stackPaddingRight ?? node.stackHorizontalPadding ?? 0 : node.stackPaddingBottom ?? node.stackVerticalPadding ?? 0,
    axisSize = alongX ? node.size?.x : node.size?.y;
  if (axisSize == null) return !1;
  const contentSize = axis === "primary" ? children.reduce((sum, curChild) => sum + sizeOf(curChild), 0) + (node.stackSpacing ?? 0) * (children.length - 1) + padStart + padEnd : Math.max(...huggable.map(sizeOf)) + padStart + padEnd;
  return Math.abs(axisSize - contentSize) <= FILL_TOLERANCE;
}
function stretchesCounterAxis(child, parent, parentStretches) {
  if (child.stackChildAlignSelf === "STRETCH") return !0;
  if (child.stackChildAlignSelf !== void 0) return !1;
  const counterSizing = parent.stackCounterSizing;
  return (counterSizing !== void 0 ? counterSizing !== "FIXED" : axisHugsContent(parent, "counter")) && !parentStretches ? !1 : fillsCounterAxis(child, parent);
}
function sameStackMode(node, other) {
  return (node.stackMode === "HORIZONTAL" || node.stackMode === "VERTICAL") && node.stackMode === other.stackMode;
}
const GRID_ALIGN = {
  MIN: "start",
  CENTER: "center",
  MAX: "end",
  STRETCH: "stretch"
};
function gridChildCss(child, parent) {
  const result = {
      stretchW: !1,
      stretchH: !1
    },
    rowIndex = gridTrackIndex(parent.gridRows),
    colIndex = gridTrackIndex(parent.gridColumns),
    rowAnchor = child.gridRowAnchor ? rowIndex.get(guidStr(child.gridRowAnchor)) : void 0,
    colAnchor = child.gridColumnAnchor ? colIndex.get(guidStr(child.gridColumnAnchor)) : void 0;
  if (rowAnchor !== void 0) {
    const rowSpan = child.gridRowSpan ?? 1;
    result.gridRow = rowSpan > 1 ? `${rowAnchor + 1} / span ${rowSpan}` : `${rowAnchor + 1}`;
  }
  if (colAnchor !== void 0) {
    const colSpan = child.gridColumnSpan ?? 1;
    result.gridColumn = colSpan > 1 ? `${colAnchor + 1} / span ${colSpan}` : `${colAnchor + 1}`;
  }
  const justify = GRID_ALIGN[child.gridChildHorizontalAlign ?? ""],
    align = GRID_ALIGN[child.gridChildVerticalAlign ?? ""];
  return justify && (result.justifySelf = justify, justify === "stretch" && (result.stretchW = !0)), align && (result.alignSelf = align, align === "stretch" && (result.stretchH = !0)), result;
}
const OVERRIDE_FIELDS = new Set(["textData", "fillPaints", "strokePaints", "visible", "opacity", "size", "overriddenSymbolID", "componentPropAssignments"]),
  MAX_INSTANCE_DEPTH = 4;
function overrideKeyStr(node) {
  const key = node.overrideKey;
  return guidStr(key || node.guid) || "?";
}
function hasComplexOverrides(node, fillGuids) {
  for (const override of node.symbolData?.symbolOverrides ?? []) {
    const guidPath = override.guidPath?.guids ?? [],
      fields = Object.keys(override).filter(fieldKey => fieldKey !== "guidPath" && OVERRIDE_FIELDS.has(fieldKey));
    if (fields.length !== 0 && (guidPath.length >= 2 || guidPath.length === 1 && (fields.includes("componentPropAssignments") || fields.includes("fillPaints") && !fillGuids.has(guidStr(guidPath[0]))))) return !0;
  }
  return !1;
}
function overridesForPath(stack, path) {
  let merged = {};
  for (let stackIdx = stack.length - 1; stackIdx >= 0; stackIdx--) {
    const entry = stack[stackIdx],
      fullPath = [...entry.prefix, ...path];
    if (fullPath.length === 0) {
      const rootOverride = entry.map.get("");
      rootOverride && (merged = {
        ...merged,
        ...rootOverride
      });
      continue;
    }
    for (let sliceIdx = 0; sliceIdx < fullPath.length; sliceIdx++) {
      const match = entry.map.get(fullPath.slice(sliceIdx).join("/"));
      if (match) {
        merged = {
          ...merged,
          ...match
        };
        break;
      }
    }
  }
  return merged;
}
function applyPropRefs(node, stack) {
  const propRefs = node.componentPropRefs;
  if (!propRefs?.length) return node;
  let result = node;
  for (let stackIdx = stack.length - 1; stackIdx >= 0; stackIdx--) {
    const propMap = stack[stackIdx].propMap;
    for (const propRef of propRefs) {
      const assigned = propMap.get(guidStr(propRef.defID));
      if (assigned === void 0) continue;
      const field = propRef.componentPropNodeField;
      field === "VISIBLE" && assigned.boolValue !== void 0 ? result = {
        ...result,
        visible: assigned.boolValue
      } : field === "TEXT_DATA" && assigned.textValue ? result = {
        ...result,
        textData: assigned.textValue
      } : field === "OVERRIDDEN_SYMBOL_ID" && assigned.guidValue && (result = {
        ...result,
        overriddenSymbolID: assigned.guidValue
      });
    }
  }
  return result;
}
function overridesByPath(overrides, derived) {
  const byPath = new Map(),
    addAll = list => {
      for (const override of list ?? []) {
        const pathKey = (override.guidPath?.guids ?? []).map(guidStr).join("/"),
          existing = byPath.get(pathKey) ?? {},
          {
            guidPath: _guidPath,
            ...rest
          } = override;
        byPath.set(pathKey, {
          ...existing,
          ...rest
        });
      }
    };
  return addAll(overrides), addAll(derived), byPath;
}
function propAssignmentMap(assignments) {
  const byDef = new Map();
  for (const assignment of assignments ?? []) byDef.set(guidStr(assignment.defID), assignment.value);
  return byDef;
}
const isNullGuid = guid => !guid || guid.sessionID === 4294967295 && guid.localID === 4294967295,
  INHERIT_ON_SWAP = ["opacity", "blendMode"];
function resolveInstance(node, stack, doc, depth, opts = {}) {
  const symbolData = node.symbolData;
  if (!symbolData) return;
  const symbolGuid = isNullGuid(node.overriddenSymbolID) ? symbolData.symbolID : node.overriddenSymbolID,
    symbol = doc.nodes.get(guidStr(symbolGuid));
  if (!symbol) return;
  const stackEntry = {
      map: overridesByPath(symbolData.symbolOverrides, node.derivedSymbolData),
      prefix: [],
      propMap: propAssignmentMap(node.componentPropAssignments)
    },
    newStack = [...stack, stackEntry],
    hasDeepOverrides = pathPrefix => newStack.some(entry => {
      for (const mapKey of entry.map.keys()) if (mapKey.startsWith(pathPrefix + "/")) return !0;
      return !1;
    }),
    resolveChild = (child, path) => {
      const childKey = overrideKeyStr(child),
        childPath = [...path, childKey],
        overrides = overridesForPath(newStack, childPath);
      let resolved = Object.keys(overrides).length ? {
        ...child,
        ...overrides,
        children: child.children
      } : child;
      if (resolved = applyPropRefs(resolved, newStack), resolved.type === "INSTANCE" && depth < MAX_INSTANCE_DEPTH) {
        const hasPropAssign = overrides.componentPropAssignments !== void 0,
          hasPaintOverride = overrides.fillPaints !== void 0 || overrides.strokePaints !== void 0;
        if (opts.expandAll || hasDeepOverrides(childPath.join("/")) || hasPropAssign || hasPaintOverride) {
          if (resolved.overriddenSymbolID && !isNullGuid(resolved.overriddenSymbolID)) {
            const swapSymbol = doc.nodes.get(guidStr(resolved.overriddenSymbolID));
            if (swapSymbol) for (const inheritField of INHERIT_ON_SWAP) resolved[inheritField] === void 0 && swapSymbol[inheritField] !== void 0 && (resolved = {
              ...resolved,
              [inheritField]: swapSymbol[inheritField]
            });
          }
          const expanded = resolveInstance(resolved, newStack.map(stackItem => ({
            ...stackItem,
            prefix: [...stackItem.prefix, ...childPath]
          })), doc, depth + 1, opts);
          if (expanded) return expanded;
        }
      }
      return resolved.children?.length && (resolved = {
        ...resolved,
        children: resolved.children.map(grandchild => resolveChild(grandchild, childPath))
      }), resolved;
    },
    children = (symbol.children ?? []).map(child => resolveChild(child, [])),
    instanceFields = ["fillPaints", "strokePaints", "strokeWeight", "strokeAlign", "effects", "cornerRadius", "rectangleTopLeftCornerRadius", "rectangleTopRightCornerRadius", "rectangleBottomLeftCornerRadius", "rectangleBottomRightCornerRadius", "opacity", "blendMode"],
    instanceProps = {};
  for (const field of instanceFields) {
    const fieldVal = node[field];
    fieldVal !== void 0 && (instanceProps[field] = fieldVal);
  }
  const rootOverrides = {
    ...overridesForPath(newStack, []),
    ...overridesForPath(newStack, [overrideKeyStr(symbol)])
  };
  return {
    ...symbol,
    ...rootOverrides,
    ...instanceProps,
    guid: node.guid,
    type: "FRAME",
    transform: node.transform,
    size: node.size ?? symbol.size,
    stackPositioning: node.stackPositioning,
    stackChildAlignSelf: node.stackChildAlignSelf,
    stackChildPrimaryGrow: node.stackChildPrimaryGrow,
    visible: void 0,
    componentPropRefs: void 0,
    children: children
  };
}
function lastVisibleSolid(paints) {
  if (paints) for (let paintIdx = paints.length - 1; paintIdx >= 0; paintIdx--) {
    const paint = paints[paintIdx];
    if (paint.type === "SOLID" && paint.visible !== !1) return paint;
  }
}
const CSS_BLEND_MODES = {
  MULTIPLY: "multiply",
  SCREEN: "screen",
  OVERLAY: "overlay",
  DARKEN: "darken",
  LIGHTEN: "lighten",
  COLOR_DODGE: "color-dodge",
  COLOR_BURN: "color-burn",
  HARD_LIGHT: "hard-light",
  SOFT_LIGHT: "soft-light",
  DIFFERENCE: "difference",
  EXCLUSION: "exclusion",
  HUE: "hue",
  SATURATION: "saturation",
  COLOR: "color",
  LUMINOSITY: "luminosity"
};
function cssBlendMode(blendMode) {
  return CSS_BLEND_MODES[blendMode] ?? "normal";
}
function mixBlendCss(blendMode) {
  if (!blendMode || blendMode === "NORMAL" || blendMode === "PASS_THROUGH") return "";
  const cssMode = cssBlendMode(blendMode);
  return cssMode !== "normal" ? `mix-blend-mode:${cssMode};` : "";
}
function paintLayerCss(paint, ctx, node, width, height) {
  return paintToCssLayer(paint, {
    w: width,
    h: height,
    imageRef: hash => ctx.imageRef(hash),
    warn: (kind, message) => pushWarning(ctx, node, kind, message)
  });
}
function backgroundCss(paints, ctx, node, width, height) {
  if (!paints?.length) return "";
  const layers = [],
    blends = [];
  for (let paintIdx = paints.length - 1; paintIdx >= 0; paintIdx--) {
    const layerCss = paintLayerCss(paints[paintIdx], ctx, node, width, height);
    if (!layerCss) continue;
    layers.push(layerCss);
    const blendMode = paints[paintIdx].blendMode;
    blends.push(blendMode && blendMode !== "NORMAL" ? cssBlendMode(blendMode) : "normal");
  }
  if (!layers.length) return "";
  if (layers.length === 1 && paints.length === 1 && paints[0].type === "SOLID" && paints[0].color && blends[0] === "normal") return `background-color:${cssColor(paints[0].color, paints[0].opacity ?? 1)};`;
  let css = `background:${layers.join(",")};`;
  return layers.length === 1 && blends[0] !== "normal" && mixBlendCss(node.blendMode) === "" ? css += `mix-blend-mode:${blends[0]};` : blends.some(blend => blend !== "normal") && (css += `background-blend-mode:${blends.join(",")};`), css;
}
function borderRadiusCss(node) {
  if (node.type === "ELLIPSE") return "border-radius:50%;";
  const radiusTL = node.rectangleTopLeftCornerRadius ?? node.cornerRadius ?? 0,
    radiusTR = node.rectangleTopRightCornerRadius ?? node.cornerRadius ?? 0,
    radiusBR = node.rectangleBottomRightCornerRadius ?? node.cornerRadius ?? 0,
    radiusBL = node.rectangleBottomLeftCornerRadius ?? node.cornerRadius ?? 0;
  return radiusTL || radiusTR || radiusBR || radiusBL ? radiusTL === radiusTR && radiusTR === radiusBR && radiusBR === radiusBL ? `border-radius:${fmtNum(radiusTL)}px;` : `border-radius:${fmtNum(radiusTL)}px ${fmtNum(radiusTR)}px ${fmtNum(radiusBR)}px ${fmtNum(radiusBL)}px;` : "";
}
function effectsCss(node, ctx, asSvg) {
  const result = {
      boxShadow: [],
      filter: "",
      backdrop: "",
      svgFilter: ""
    },
    svgParts = [],
    dropShadows = [];
  for (const effect of node.effects ?? []) if (effect.visible !== !1) if (effect.type === "DROP_SHADOW" && effect.color && effect.offset) asSvg ? (dropShadows.unshift(`drop-shadow(${fmtNum(effect.offset.x)}px ${fmtNum(effect.offset.y)}px ${fmtNum(effect.radius ?? 0)}px ${cssColor(effect.color)})`), effect.spread && pushWarning(ctx, node, "effect-spread", "drop-shadow spread ignored on text/vector")) : result.boxShadow.unshift(`${fmtNum(effect.offset.x)}px ${fmtNum(effect.offset.y)}px ${fmtNum(effect.radius ?? 0)}px ${fmtNum(effect.spread ?? 0)}px ${cssColor(effect.color)}`);else if (effect.type === "INNER_SHADOW" && effect.color && effect.offset) {
    if (asSvg) {
      const filterIdx = svgParts.length,
        filterInput = filterIdx === 0 ? "SourceGraphic" : `is${filterIdx - 1}`;
      svgParts.push(`<feOffset in="SourceAlpha" dx="${fmtNum(effect.offset.x)}" dy="${fmtNum(effect.offset.y)}" result="o${filterIdx}"/><feGaussianBlur in="o${filterIdx}" stdDeviation="${fmtNum((effect.radius ?? 0) / 2)}" result="b${filterIdx}"/><feComposite in="SourceAlpha" in2="b${filterIdx}" operator="out" result="cut${filterIdx}"/><feFlood flood-color="${cssColor(effect.color)}" result="f${filterIdx}"/><feComposite in="f${filterIdx}" in2="cut${filterIdx}" operator="in" result="is${filterIdx}s"/><feComposite in="is${filterIdx}s" in2="${filterInput}" operator="over" result="is${filterIdx}"/>`);
    } else result.boxShadow.unshift(`inset ${fmtNum(effect.offset.x)}px ${fmtNum(effect.offset.y)}px ${fmtNum(effect.radius ?? 0)}px ${fmtNum(effect.spread ?? 0)}px ${cssColor(effect.color)}`);
  } else effect.type === "BACKGROUND_BLUR" ? result.backdrop += `blur(${fmtNum(effect.radius ?? 0)}px) ` : effect.type === "FOREGROUND_BLUR" || effect.type === "LAYER_BLUR" ? result.filter += `blur(${fmtNum(effect.radius ?? 0)}px) ` : effect.type === "NOISE" ? pushWarning(ctx, node, "effect-noise", "Noise effect not supported") : pushWarning(ctx, node, "effect-unknown", `Unknown effect type ${effect.type}`);
  return dropShadows.length && (result.filter = dropShadows.join(" ") + " " + result.filter), svgParts.length && (result.svgFilter = svgParts.join("")), result;
}
function textStyleCss(node) {
  let css = "";
  if (node.fontName) {
    const fontMeta = node.derivedTextData?.fontMetaData?.[0],
      fontStyleName = node.fontName.style,
      fontWeight = fontMeta?.fontWeight ?? (/semi|demi/i.test(fontStyleName) ? 600 : /bold/i.test(fontStyleName) ? 700 : /medium/i.test(fontStyleName) ? 500 : /light/i.test(fontStyleName) ? 300 : 400),
      fontStyleCss = /italic/i.test(fontStyleName) || fontMeta?.fontStyle === "ITALIC" ? "italic" : "normal";
    css += `font-family:'${node.fontName.family.replace(/'/g, "\\'")}',sans-serif;font-weight:${fontWeight};font-style:${fontStyleCss};`;
  }
  node.fontSize && (css += `font-size:${fmtNum(node.fontSize)}px;`), node.textAlignHorizontal && (css += `text-align:${{
    LEFT: "left",
    RIGHT: "right",
    CENTER: "center",
    JUSTIFIED: "justify"
  }[node.textAlignHorizontal] ?? "left"};`);
  const lineHeight = node.lineHeight;
  lineHeight && (lineHeight.units === "PIXELS" ? css += `line-height:${fmtNum(lineHeight.value)}px;` : lineHeight.units === "PERCENT" ? css += `line-height:${fmtNum(lineHeight.value)}%;` : lineHeight.units === "RAW" && (css += `line-height:${fmtNum(lineHeight.value)};`));
  const letterSpacing = node.letterSpacing;
  letterSpacing?.value && (letterSpacing.units === "PIXELS" ? css += `letter-spacing:${fmtNum(letterSpacing.value)}px;` : letterSpacing.units === "PERCENT" && (css += `letter-spacing:${fmtNum(letterSpacing.value / 100)}em;`));
  const fillSolid = lastVisibleSolid(node.fillPaints);
  return fillSolid?.color && (css += `color:${cssColor(fillSolid.color, fillSolid.opacity ?? 1)};`), node.textDecoration === "UNDERLINE" ? css += "text-decoration:underline;" : node.textDecoration === "STRIKETHROUGH" && (css += "text-decoration:line-through;"), css;
}
function borderCss(node, ctx) {
  const strokes = node.strokePaints,
    weight = node.strokeWeight ?? 0,
    stroke = lastVisibleSolid(strokes),
    strokeCss = stroke?.color ? cssColor(stroke.color, stroke.opacity ?? 1) : void 0,
    shadows = [];
  let css = "";
  const independent = node.borderStrokeWeightsIndependent,
    takesSpace = node.bordersTakeSpace;
  if (strokeCss && independent) {
    const topW = node.borderTopWeight ?? weight,
      rightW = node.borderRightWeight ?? weight,
      bottomW = node.borderBottomWeight ?? weight,
      leftW = node.borderLeftWeight ?? weight,
      lineStyle = node.dashPattern?.length ? "dashed" : "solid";
    topW && (css += `border-top:${fmtNum(topW)}px ${lineStyle} ${strokeCss};`), rightW && (css += `border-right:${fmtNum(rightW)}px ${lineStyle} ${strokeCss};`), bottomW && (css += `border-bottom:${fmtNum(bottomW)}px ${lineStyle} ${strokeCss};`), leftW && (css += `border-left:${fmtNum(leftW)}px ${lineStyle} ${strokeCss};`), takesSpace || pushWarning(ctx, node, "border-independent-spacing", "Independent borders may offset abs-positioned children");
  } else if (strokeCss && weight > 0) {
    const align = node.strokeAlign ?? "INSIDE";
    if (node.dashPattern?.length) {
      const offset = align === "INSIDE" ? -weight : align === "CENTER" ? -weight / 2 : 0;
      css += `outline:${fmtNum(weight)}px dashed ${strokeCss};outline-offset:${fmtNum(offset)}px;`;
    } else align === "INSIDE" ? shadows.push(`inset 0 0 0 ${fmtNum(weight)}px ${strokeCss}`) : align === "OUTSIDE" ? shadows.push(`0 0 0 ${fmtNum(weight)}px ${strokeCss}`) : shadows.push(`inset 0 0 0 ${fmtNum(weight / 2)}px ${strokeCss}`, `0 0 0 ${fmtNum(weight / 2)}px ${strokeCss}`);
  }
  return takesSpace && !independent && pushWarning(ctx, node, "borders-take-space", "bordersTakeSpace with uniform stroke not handled"), {
    shadows: shadows,
    css: css
  };
}
const JUSTIFY_MAP = {
    MIN: "flex-start",
    CENTER: "center",
    MAX: "flex-end",
    SPACE_EVENLY: "space-between",
    SPACE_BETWEEN: "space-between"
  },
  ALIGN_MAP = {
    MIN: "flex-start",
    CENTER: "center",
    MAX: "flex-end",
    BASELINE: "baseline",
    STRETCH: "stretch"
  };
function layoutCss(node, ctx) {
  const mode = node.stackMode;
  if (mode !== "HORIZONTAL" && mode !== "VERTICAL") {
    if (mode === "GRID") {
      const gridParts = ["display:grid"],
        rowsTemplate = gridTemplate(node.gridRows, node.gridRowsSizing),
        colsTemplate = gridTemplate(node.gridColumns, node.gridColumnsSizing);
      rowsTemplate && gridParts.push(`grid-template-rows:${rowsTemplate}`), colsTemplate && gridParts.push(`grid-template-columns:${colsTemplate}`), (node.gridRowGap || node.gridColumnGap) && gridParts.push(`gap:${fmtNum(node.gridRowGap ?? 0)}px ${fmtNum(node.gridColumnGap ?? 0)}px`);
      const gridPadTop = node.stackPaddingTop ?? node.stackVerticalPadding ?? 0,
        gridPadRight = node.stackPaddingRight ?? node.stackHorizontalPadding ?? 0,
        gridPadBottom = node.stackPaddingBottom ?? node.stackVerticalPadding ?? 0,
        gridPadLeft = node.stackPaddingLeft ?? node.stackHorizontalPadding ?? 0;
      return (gridPadTop || gridPadRight || gridPadBottom || gridPadLeft) && gridParts.push(`padding:${fmtNum(gridPadTop)}px ${fmtNum(gridPadRight)}px ${fmtNum(gridPadBottom)}px ${fmtNum(gridPadLeft)}px`), {
        css: gridParts.join(";"),
        grid: !0
      };
    }
    return {
      css: ""
    };
  }
  const parts = ["display:flex", `flex-direction:${mode === "HORIZONTAL" ? "row" : "column"}`],
    spacing = node.stackPrimaryAlignItems === "SPACE_EVENLY" || node.stackPrimaryAlignItems === "SPACE_BETWEEN" ? 0 : node.stackSpacing ?? 0,
    spaceBetweenWrap = node.stackWrap === "WRAP" && node.stackCounterSpacing != null && !Number.isFinite(node.stackCounterSpacing),
    counterSpacing = Number.isFinite(node.stackCounterSpacing) ? node.stackCounterSpacing : void 0;
  spaceBetweenWrap && parts.push("align-content:space-between"), (spacing < 0 || counterSpacing != null && counterSpacing < 0) && pushWarning(ctx, node, "layout-negative-gap", "Negative auto-layout spacing not expressible as CSS gap");
  const gapMain = Math.max(0, spacing),
    gapCounter = counterSpacing != null ? Math.max(0, counterSpacing) : void 0;
  if (gapMain || gapCounter) {
    const [rowGap, colGap] = mode === "HORIZONTAL" ? [gapCounter ?? gapMain, gapMain] : [gapMain, gapCounter ?? gapMain];
    parts.push(rowGap !== colGap ? `gap:${fmtNum(rowGap)}px ${fmtNum(colGap)}px` : `gap:${fmtNum(gapMain)}px`);
  }
  const padTop = node.stackPaddingTop ?? node.stackVerticalPadding ?? 0,
    padRight = node.stackPaddingRight ?? node.stackHorizontalPadding ?? 0,
    padBottom = node.stackPaddingBottom ?? node.stackVerticalPadding ?? 0,
    padLeft = node.stackPaddingLeft ?? node.stackHorizontalPadding ?? 0;
  (padTop || padRight || padBottom || padLeft) && parts.push(`padding:${fmtNum(padTop)}px ${fmtNum(padRight)}px ${fmtNum(padBottom)}px ${fmtNum(padLeft)}px`);
  const justify = JUSTIFY_MAP[node.stackPrimaryAlignItems ?? "MIN"],
    align = ALIGN_MAP[node.stackCounterAlignItems ?? "MIN"];
  justify !== "flex-start" && parts.push(`justify-content:${justify}`), align !== "flex-start" && parts.push(`align-items:${align}`), node.stackWrap === "WRAP" && parts.push("flex-wrap:wrap");
  const hugPrimary = node.stackPrimarySizing ? node.stackPrimarySizing !== "FIXED" : axisHugsContent(node, "primary"),
    hugCounter = node.stackCounterSizing ? node.stackCounterSizing !== "FIXED" : axisHugsContent(node, "counter"),
    isHorizontal = mode === "HORIZONTAL";
  return {
    css: parts.join(";"),
    axis: mode,
    hugW: isHorizontal ? hugPrimary : hugCounter,
    hugH: isHorizontal ? hugCounter : hugPrimary
  };
}
function flexChildCss(child, axis, parent, parentStretches = !1) {
  const parts = [],
    grows = (child.stackChildPrimaryGrow ?? 0) > 0,
    stretches = parent ? stretchesCounterAxis(child, parent, parentStretches) : child.stackChildAlignSelf === "STRETCH";
  grows ? parts.push("flex:1 0 0") : parts.push("flex:none"), stretches && parts.push("align-self:stretch");
  const isHorizontal = axis === "HORIZONTAL";
  return {
    css: parts.join(";"),
    suppressW: isHorizontal ? grows : stretches,
    suppressH: isHorizontal ? stretches : grows
  };
}
function geometryPaths(geometry, doc) {
  const paths = [];
  for (const geom of geometry ?? []) {
    if (geom.commandsBlob == null) continue;
    const blob = doc.blobs[geom.commandsBlob];
    if (!blob) continue;
    const pathD = pathToD(parseCommandsBlob(blob.bytes));
    pathD && paths.push({
      d: pathD,
      rule: geom.windingRule === "ODD" ? "evenodd" : "nonzero"
    });
  }
  return paths;
}
function glyphPaths(node, doc) {
  const textData = node.derivedTextData,
    glyphs = [];
  for (const glyph of textData?.glyphs ?? []) {
    const blob = doc.blobs[glyph.commandsBlob];
    if (!blob) continue;
    const pathD = pathToD(parseCommandsBlob(blob.bytes));
    pathD && glyphs.push({
      d: pathD,
      x: glyph.position.x,
      y: glyph.position.y,
      fontSize: glyph.fontSize,
      rotation: glyph.rotation
    });
  }
  return glyphs;
}
const fmtCoord = value => {
  const rounded = Math.round(value * 1e3) / 1e3;
  return Object.is(rounded, -0) ? "0" : String(rounded);
};
function vectorNetworkPaths(node, doc) {
  const blobIndex = node.vectorData?.vectorNetworkBlob;
  if (blobIndex == null) return [];
  const bytes = doc.blobs[blobIndex]?.bytes;
  if (!bytes || bytes.length < 12) return [];
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      vertexCount = view.getUint32(0, !0),
      segmentCount = view.getUint32(4, !0),
      regionCount = view.getUint32(8, !0),
      segmentsOffset = 12 + vertexCount * 12,
      regionsOffset = segmentsOffset + segmentCount * 28;
    if (regionCount === 0 || bytes.length < regionsOffset) return [];
    const normSize = node.vectorData?.normalizedSize,
      scaleX = normSize?.x && node.size?.x != null ? node.size.x / normSize.x : 1,
      scaleY = normSize?.y && node.size?.y != null ? node.size.y / normSize.y : 1,
      vertexX = vertexIdx => view.getFloat32(12 + vertexIdx * 12 + 4, !0) * scaleX,
      vertexY = vertexIdx => view.getFloat32(12 + vertexIdx * 12 + 8, !0) * scaleY,
      readSegment = segIdx => {
        const segOffset = segmentsOffset + segIdx * 28;
        if (segOffset + 28 > bytes.length) return;
        const startVertex = view.getUint32(segOffset + 4, !0),
          endVertex = view.getUint32(segOffset + 16, !0);
        if (!(startVertex >= vertexCount || endVertex >= vertexCount)) return {
          start: startVertex,
          end: endVertex,
          t1x: view.getFloat32(segOffset + 8, !0) * scaleX,
          t1y: view.getFloat32(segOffset + 12, !0) * scaleY,
          t2x: view.getFloat32(segOffset + 20, !0) * scaleX,
          t2y: view.getFloat32(segOffset + 24, !0) * scaleY
        };
      },
      paths = [];
    let offset = regionsOffset;
    for (let regionIdx = 0; regionIdx < regionCount && !(offset + 8 > bytes.length); regionIdx++) {
      const winding = view.getUint32(offset, !0),
        loopCount = view.getUint32(offset + 4, !0);
      offset += 8;
      let pathD = "";
      for (let loopIdx = 0; loopIdx < loopCount; loopIdx++) {
        if (offset + 4 > bytes.length) return paths;
        const segCount = view.getUint32(offset, !0);
        if (offset += 4, offset + segCount * 4 > bytes.length) return paths;
        let lastVertex = -1;
        for (let segListIdx = 0; segListIdx < segCount; segListIdx++) {
          const segment = readSegment(view.getUint32(offset + segListIdx * 4, !0));
          if (!segment) continue;
          let {
            start: segStart,
            end: segEnd,
            t1x: tan1x,
            t1y: tan1y,
            t2x: tan2x,
            t2y: tan2y
          } = segment;
          lastVertex !== -1 && segStart !== lastVertex && segEnd === lastVertex && ([segStart, segEnd] = [segEnd, segStart], [tan1x, tan1y, tan2x, tan2y] = [tan2x, tan2y, tan1x, tan1y]), (lastVertex === -1 || segStart !== lastVertex) && (pathD += `M ${fmtCoord(vertexX(segStart))} ${fmtCoord(vertexY(segStart))} `), tan1x === 0 && tan1y === 0 && tan2x === 0 && tan2y === 0 ? pathD += `L ${fmtCoord(vertexX(segEnd))} ${fmtCoord(vertexY(segEnd))} ` : pathD += `C ${fmtCoord(vertexX(segStart) + tan1x)} ${fmtCoord(vertexY(segStart) + tan1y)} ${fmtCoord(vertexX(segEnd) + tan2x)} ${fmtCoord(vertexY(segEnd) + tan2y)} ${fmtCoord(vertexX(segEnd))} ${fmtCoord(vertexY(segEnd))} `, lastVertex = segEnd;
        }
        offset += segCount * 4, lastVertex !== -1 && (pathD += "Z ");
      }
      pathD && paths.push({
        d: pathD.trim(),
        rule: winding === 0 ? "nonzero" : "evenodd"
      });
    }
    return paths;
  } catch {
    return [];
  }
}
function glyphSvg(node, ctx, extraAttrs = "") {
  return glyphPaths(node, ctx.fig).map(glyph => {
    const rotate = glyph.rotation ? ` rotate(${glyph.rotation * (180 / Math.PI)})` : "";
    return `<path ${extraAttrs}transform="translate(${fmtNum(glyph.x)} ${fmtNum(glyph.y)}) scale(${fmtNum(glyph.fontSize)} ${fmtNum(-glyph.fontSize)})${rotate}" d="${escapeHtml(glyph.d)}"/>`;
  }).join("");
}
function svgTextFill(node, ctx) {
  const paint = node.fillPaints?.find(candidate => candidate.visible !== !1);
  if (!paint) return {
    fill: "#000",
    defs: ""
  };
  if (paint.type === "SOLID" && paint.color) return {
    fill: cssColor(paint.color, paint.opacity ?? 1),
    defs: ""
  };
  if (paint.type === "IMAGE") {
    const imageHash = paint.image?.hash;
    if (imageHash) {
      const hashHex = bytesToHex(imageHash),
        image = ctx.fig.images.get(hashHex);
      if (image) {
        const patternId = nextUid(ctx, "tp"),
          dataUri = `data:${image.mime};base64,${bytesToBase64(image.bytes)}`,
          scaleMode = paint.imageScaleMode,
          width = node.size?.x ?? 100,
          height = node.size?.y ?? 100,
          scale = paint.scale ?? 1,
          imgWidth = paint.originalImageWidth ?? width,
          imgHeight = paint.originalImageHeight ?? height,
          tileW = scaleMode === "TILE" ? imgWidth * scale : width,
          tileH = scaleMode === "TILE" ? imgHeight * scale : height,
          patternSvg = `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${fmtNum(tileW)}" height="${fmtNum(tileH)}"><image href="${dataUri}" width="${fmtNum(tileW)}" height="${fmtNum(tileH)}"/></pattern>`;
        return {
          fill: `url(#${patternId})`,
          defs: patternSvg
        };
      }
    }
    return pushWarning(ctx, node, "text-image-fill", "Text IMAGE fill missing, falling back to white"), {
      fill: "#fff",
      defs: ""
    };
  }
  if (paint.type?.startsWith("GRADIENT")) {
    pushWarning(ctx, node, "text-gradient-fill", `Text ${paint.type} fill approximated`);
    const stopColor = paint.stops?.[0]?.color;
    return {
      fill: stopColor ? cssColor(stopColor, paint.opacity ?? 1) : "#000",
      defs: ""
    };
  }
  return {
    fill: "#000",
    defs: ""
  };
}
function textSvg(node, ctx, filterSvg = "") {
  const textData = node.derivedTextData;
  if (!textData?.glyphs?.length) return null;
  const width = node.size?.x ?? textData.layoutSize?.x ?? 0,
    height = node.size?.y ?? textData.layoutSize?.y ?? 0,
    {
      fill: fill,
      defs: fillDefs
    } = svgTextFill(node, ctx),
    strokeW = node.strokeWeight ?? 0,
    stroke = node.strokePaints?.find(paint => paint.visible !== !1);
  let strokeAttrs = "",
    strokeDefs = "",
    strokeExtra = "";
  if (strokeW > 0 && stroke) {
    const paintDefs = [],
      strokePaint = svgPaint(stroke, ctx, node, paintDefs, {
        w: width,
        h: height
      });
    if (strokePaint) {
      strokeDefs = paintDefs.join("");
      const align = node.strokeAlign ?? "OUTSIDE",
        strokeWidth = align === "CENTER" ? strokeW : strokeW * 2;
      strokeAttrs = `stroke="${strokePaint}" stroke-width="${fmtNum(strokeWidth)}"${align === "OUTSIDE" ? ' paint-order="stroke fill"' : ""}`, strokeExtra = 'vector-effect="non-scaling-stroke" ', align === "INSIDE" && pushWarning(ctx, node, "text-stroke-inside", "Text INSIDE stroke approximated");
    }
  }
  const glyphs = glyphSvg(node, ctx, strokeExtra);
  if (!glyphs) return null;
  const filterId = filterSvg ? nextUid(ctx, "f") : "",
    filterDef = filterSvg ? `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">${filterSvg}</filter>` : "",
    defs = filterDef || fillDefs || strokeDefs ? `<defs>${filterDef}${fillDefs}${strokeDefs}</defs>` : "",
    group = `<g${filterId ? ` filter="url(#${filterId})"` : ""} ${strokeAttrs}>${glyphs}</g>`,
    overflow = node.textTruncation === "ENDING" && (node.maxLines ?? 0) > 0 ? "hidden" : "visible";
  return `<svg width="${fmtNum(width)}" height="${fmtNum(height)}" viewBox="0 0 ${fmtNum(width)} ${fmtNum(height)}" style="position:absolute;inset:0;overflow:${overflow}" fill="${fill}">${defs}${group}</svg>`;
}
function svgPaint(paint, ctx, node, defs, box) {
  if (paint.visible !== !1) {
    if (paint.type === "SOLID" && paint.color) return cssColor(paint.color, paint.opacity ?? 1);
    if (paint.type === "GRADIENT_LINEAR" && paint.stops) {
      const gradId = nextUid(ctx, "g"),
        transform = paint.transform,
        inverse = transform && invertMatrix(transform);
      let startNx = 0,
        startNy = 0,
        endNx = 0,
        endNy = 1;
      inverse && ([startNx, startNy] = transformPoint(inverse, 0, 0.5), [endNx, endNy] = transformPoint(inverse, 1, 0.5));
      const opacity = paint.opacity ?? 1,
        stopsSvg = paint.stops.map(stop => `<stop offset="${stop.position}" stop-color="${cssColor(stop.color, opacity)}"/>`).join("");
      return box ? defs.push(`<linearGradient id="${gradId}" gradientUnits="userSpaceOnUse" x1="${fmtNum(startNx * box.w)}" y1="${fmtNum(startNy * box.h)}" x2="${fmtNum(endNx * box.w)}" y2="${fmtNum(endNy * box.h)}">${stopsSvg}</linearGradient>`) : defs.push(`<linearGradient id="${gradId}" x1="${startNx}" y1="${startNy}" x2="${endNx}" y2="${endNy}">${stopsSvg}</linearGradient>`), `url(#${gradId})`;
    }
    pushWarning(ctx, node, "vector-paint", `Vector paint type ${paint.type} not supported, skipping layer`);
  }
}
function geometrySvg(node, ctx, width, height, filterSvg = "") {
  const paths = [],
    defs = [],
    pathsOf = geometry => geometryPaths(geometry, ctx.fig),
    pushPaths = (pathList, paints, extraAttr = "") => {
      for (const {
        d: pathD,
        rule: fillRule
      } of pathList) for (const paint of paints ?? []) {
        const fillValue = svgPaint(paint, ctx, node, defs);
        fillValue && paths.push(`<path d="${escapeHtml(pathD)}" fill="${fillValue}" fill-rule="${fillRule}"${extraAttr}/>`);
      }
    },
    fillPaths = pathsOf(node.fillGeometry),
    strokePaths = pathsOf(node.strokeGeometry);
  pushPaths(fillPaths, node.fillPaints);
  const align = node.strokeAlign ?? "CENTER";
  let maskAttr = "";
  if (strokePaths.length && fillPaths.length && align !== "CENTER") {
    const maskId = nextUid(ctx, "sm"),
      maskPaths = fillPaths.map(({
        d: maskPathD,
        rule: maskRule
      }) => `<path d="${escapeHtml(maskPathD)}" fill="white" fill-rule="${maskRule}"/>`).join("");
    defs.push(align === "INSIDE" ? `<mask id="${maskId}">${maskPaths}</mask>` : `<mask id="${maskId}"><rect x="-50%" y="-50%" width="200%" height="200%" fill="white"/>${maskPaths.replaceAll('fill="white"', 'fill="black"')}</mask>`), maskAttr = ` mask="url(#${maskId})"`;
  }
  if (pushPaths(strokePaths, node.strokePaints, maskAttr), !paths.length) return "";
  const filterId = filterSvg ? nextUid(ctx, "f") : "";
  filterSvg && defs.push(`<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">${filterSvg}</filter>`);
  const defsHtml = defs.length ? `<defs>${defs.join("")}</defs>` : "",
    group = filterId ? `<g filter="url(#${filterId})">${paths.join("")}</g>` : paths.join(""),
    svgWidth = Math.max(width, 1),
    svgHeight = Math.max(height, 1);
  return `<svg width="${fmtNum(svgWidth)}" height="${fmtNum(svgHeight)}" style="position:absolute;left:0;top:0;overflow:visible">${defsHtml}${group}</svg>`;
}
function clipPathSvg(node, ctx) {
  const matrix = node.transform,
    translateX = matrix?.m02 ?? 0,
    translateY = matrix?.m12 ?? 0,
    wrap = content => translateX || translateY ? `<g transform="translate(${fmtNum(translateX)} ${fmtNum(translateY)})">${content}</g>` : content;
  if (node.type === "TEXT") {
    const glyphsSvg = glyphSvg(node, ctx);
    return glyphsSvg ? wrap(glyphsSvg) : null;
  }
  const clipPaths = geometryPaths(node.fillGeometry ?? [], ctx.fig).map(path => `<path d="${escapeHtml(path.d)}" clip-rule="${path.rule}"/>`);
  if (!clipPaths.length && node.children?.length) for (const child of node.children) {
    const childClip = clipPathSvg(child, ctx);
    childClip && clipPaths.push(childClip);
  }
  if (!clipPaths.length) {
    const width = node.size?.x ?? 0,
      height = node.size?.y ?? 0,
      radius = node.cornerRadius ?? 0;
    width > 0 && height > 0 && clipPaths.push(`<rect width="${fmtNum(width)}" height="${fmtNum(height)}" rx="${fmtNum(radius)}"/>`);
  }
  return clipPaths.length ? wrap(clipPaths.join("")) : null;
}
function maskGroupHtml(clipSvg, content, ctx) {
  const clipId = nextUid(ctx, "mask");
  return `<svg width="0" height="0" style="position:absolute"><defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${clipSvg}</clipPath></defs></svg><div data-fig-mask-group style="position:absolute;inset:0;clip-path:url(#${clipId})">${content}</div>`;
}
function mergeOverridePaths(overrides, derived) {
  const byPath = new Map(),
    addAll = list => {
      for (const override of list ?? []) {
        const pathKey = (override.guidPath?.guids ?? []).map(guidStr).join("/"),
          existing = byPath.get(pathKey) ?? {},
          {
            guidPath: _guidPath,
            ...rest
          } = override;
        byPath.set(pathKey, {
          ...existing,
          ...rest
        });
      }
    };
  return addAll(overrides), addAll(derived), byPath;
}
function nodeOverrideKey(node) {
  const key = node.overrideKey;
  return guidStr(key || node.guid) || "?";
}
const mergeNodeOverride = (node, override) => override ? {
    ...node,
    ...override,
    children: node.children
  } : node,
  SWAP_INHERIT_FIELDS = ["opacity", "blendMode"];
function inheritSwapFields(node, overrides, ctx) {
  const swapGuid = node.overriddenSymbolID;
  if (!swapGuid || isEmptyGuid(swapGuid)) return node;
  const swapSymbol = ctx.fig.nodes.get(guidStr(swapGuid));
  if (!swapSymbol) return node;
  const inherited = {};
  for (const field of SWAP_INHERIT_FIELDS) !(field in overrides) && swapSymbol[field] != null && (inherited[field] = swapSymbol[field]);
  return Object.keys(inherited).length ? {
    ...node,
    ...inherited
  } : node;
}
function propValuesByDef(assignments) {
  const byDef = new Map();
  for (const assignment of assignments ?? []) byDef.set(guidStr(assignment.defID), assignment.value);
  return byDef;
}
function applyPropRefsFromMap(node, propMap, ctx) {
  const propRefs = node.componentPropRefs;
  if (!propRefs?.length) return node;
  let result = node;
  for (const propRef of propRefs) {
    const assigned = propMap.get(guidStr(propRef.defID));
    if (assigned === void 0) continue;
    const field = propRef.componentPropNodeField;
    field === "VISIBLE" && assigned.boolValue !== void 0 ? result = {
      ...result,
      visible: assigned.boolValue
    } : field === "TEXT_DATA" && assigned.textValue ? result = {
      ...result,
      textData: assigned.textValue
    } : field === "OVERRIDDEN_SYMBOL_ID" && assigned.guidValue ? result = {
      ...result,
      overriddenSymbolID: assigned.guidValue
    } : field && pushWarning(ctx, node, "prop-ref-unknown", `Unhandled componentPropNodeField=${field}`);
  }
  return result;
}
function overridesAlongPath(stack, path) {
  let merged = {};
  for (let stackIdx = stack.length - 1; stackIdx >= 0; stackIdx--) {
    const entry = stack[stackIdx],
      fullPath = [...entry.prefix, ...path];
    for (let sliceIdx = 0; sliceIdx < fullPath.length; sliceIdx++) {
      const match = entry.map.get(fullPath.slice(sliceIdx).join("/"));
      if (match) {
        merged = {
          ...merged,
          ...match
        };
        break;
      }
    }
  }
  return merged;
}
function applyPropRefsStack(stack, node, ctx) {
  let result = node;
  for (let stackIdx = stack.length - 1; stackIdx >= 0; stackIdx--) result = applyPropRefsFromMap(result, stack[stackIdx].propMap, ctx);
  return result;
}
const isEmptyGuid = guid => !guid || guid.sessionID === 4294967295 && guid.localID === 4294967295;
function renderInstance(node, ctx, stack, path, renderFn, maskFn, stretched = !1) {
  const instance = node,
    symbolData = instance.symbolData;
  if (!symbolData) return pushWarning(ctx, node, "instance-no-symbol", "Instance has no symbolData"), "";
  const symbolGuid = isEmptyGuid(instance.overriddenSymbolID) ? symbolData.symbolID : instance.overriddenSymbolID,
    symbol = ctx.fig.nodes.get(guidStr(symbolGuid));
  if (!symbol) return pushWarning(ctx, node, "instance-missing-symbol", `Symbol ${guidStr(symbolGuid)} not found`), "";
  const overrideMap = mergeOverridePaths(symbolData.symbolOverrides, instance.derivedSymbolData),
    propMap = propValuesByDef(instance.componentPropAssignments),
    newStack = [...stack.map(entry => ({
      ...entry,
      prefix: [...entry.prefix, ...path]
    })), {
      map: overrideMap,
      prefix: [],
      propMap: propMap
    }],
    renderSymbol = (curNode, nodePath, stretch) => {
      const stackMode = curNode.stackMode,
        axis = stackMode === "HORIZONTAL" || stackMode === "VERTICAL" ? stackMode : void 0,
        parts = [],
        children = curNode.children ?? [];
      let childIdx = 0;
      for (; childIdx < children.length;) {
        const child = children[childIdx],
          childPath = [...nodePath, nodeOverrideKey(child)],
          overrides = overridesAlongPath(newStack, childPath);
        let merged = mergeNodeOverride(child, Object.keys(overrides).length ? overrides : void 0);
        if (merged = applyPropRefsStack(newStack, merged, ctx), merged.type === "INSTANCE" && (merged = inheritSwapFields(merged, overrides, ctx)), merged.mask && merged.visible !== !1) {
          const maskedParts = [];
          for (childIdx++; childIdx < children.length && !children[childIdx].mask;) {
            const sibling = children[childIdx],
              siblingPath = [...nodePath, nodeOverrideKey(sibling)],
              siblingOverrides = overridesAlongPath(newStack, siblingPath);
            let siblingMerged = mergeNodeOverride(sibling, Object.keys(siblingOverrides).length ? siblingOverrides : void 0);
            siblingMerged = applyPropRefsStack(newStack, siblingMerged, ctx), siblingMerged.type === "INSTANCE" && (siblingMerged = inheritSwapFields(siblingMerged, siblingOverrides, ctx)), maskedParts.push(renderChild(siblingMerged, siblingPath)), childIdx++;
          }
          parts.push(maskFn(merged, maskedParts.join("")));
          continue;
        }
        parts.push(renderChild(merged, childPath)), childIdx++;
      }
      return parts.join("");
      function renderChild(childNode, childNodePath) {
        const stretchChild = stretchesCounterAxis(childNode, curNode, stretch) && sameStackMode(curNode, childNode);
        return renderFn(childNode, nodeArg => renderSymbol(nodeArg, childNodePath, stretchChild), instArg => renderInstance(instArg, ctx, newStack, childNodePath, renderFn, maskFn, stretchChild), axis, curNode, stretch);
      }
    };
  return renderSymbol(symbol, [], stretched);
}
const RENDER_SKIP_TYPES = new Set(["VARIABLE", "VARIABLE_SET", "STYLE", "VARIABLE_OVERRIDE", "STICKY", "WIDGET"]),
  KNOWN_BOX_TYPES = new Set(["FRAME", "GROUP", "SYMBOL", "INSTANCE", "SECTION", "COMPONENT_SET", "RECTANGLE", "ROUNDED_RECTANGLE", "ELLIPSE", "SLICE", "CANVAS", "DOCUMENT"]),
  RENDER_VECTOR_TYPES = new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "REGULAR_POLYGON"]);
function renderNode(node, ctx, isRoot, contentFn, parentAxis, parent, stretched = !1) {
  if (node.visible === !1 || node.internalOnly) return "";
  const guidKey = guidStr(node.guid),
    nodeType = node.type ?? "";
  if (RENDER_SKIP_TYPES.has(nodeType)) return "";
  const width = node.size?.x ?? 0,
    height = node.size?.y ?? 0,
    matrix = node.transform,
    posX = matrix?.m02 ?? 0,
    posY = matrix?.m12 ?? 0,
    flexMode = ctx.opts.layoutMode === "flex",
    inFlexFlow = flexMode && parentAxis != null && node.stackPositioning !== "ABSOLUTE",
    inGridFlow = flexMode && parent?.stackMode === "GRID" && node.stackPositioning !== "ABSOLUTE",
    isAxisAligned = !matrix || Math.abs(matrix.m00 - 1) < 1e-5 && Math.abs(matrix.m11 - 1) < 1e-5 && Math.abs(matrix.m01) < 1e-5 && Math.abs(matrix.m10) < 1e-5,
    rotatedInFlow = inFlexFlow && isRotated(node),
    scaledInFlow = inFlexFlow && !rotatedInFlow && !isAxisAligned;
  rotatedInFlow && pushWarning(ctx, node, "layout-flex-fallback", "Rotated node in auto-layout; falling back to absolute position");
  const styles = [];
  let posComment = "",
    suppressW = !1,
    suppressH = !1;
  if (inGridFlow) {
    styles.push("position:relative");
    const gridChild = gridChildCss(node, parent);
    gridChild.gridRow && styles.push(`grid-row:${gridChild.gridRow}`), gridChild.gridColumn && styles.push(`grid-column:${gridChild.gridColumn}`), gridChild.justifySelf && styles.push(`justify-self:${gridChild.justifySelf}`), gridChild.alignSelf && styles.push(`align-self:${gridChild.alignSelf}`), suppressW = gridChild.stretchW, suppressH = gridChild.stretchH, posComment = `/* grid ${fmtNum(posX)},${fmtNum(posY)},${fmtNum(width)},${fmtNum(height)} */`;
  } else if (inFlexFlow && !rotatedInFlow) {
    styles.push("position:relative");
    const flexChild = flexChildCss(node, parentAxis, parent, stretched);
    styles.push(flexChild.css), suppressW = flexChild.suppressW, suppressH = flexChild.suppressH, scaledInFlow && matrix && styles.push(`transform:matrix(${fmtNum(matrix.m00)},${fmtNum(matrix.m10)},${fmtNum(matrix.m01)},${fmtNum(matrix.m11)},0,0)`), posComment = `/* ${fmtNum(posX)},${fmtNum(posY)},${fmtNum(width)},${fmtNum(height)} */`;
  } else styles.push(isRoot ? "position:relative" : "position:absolute"), !isRoot && matrix && (isAxisAligned ? styles.push(`left:${fmtNum(posX)}px`, `top:${fmtNum(posY)}px`) : styles.push("left:0", "top:0", `transform:matrix(${fmtNum(matrix.m00)},${fmtNum(matrix.m10)},${fmtNum(matrix.m01)},${fmtNum(matrix.m11)},${fmtNum(matrix.m02)},${fmtNum(matrix.m12)})`, "transform-origin:0 0")), rotatedInFlow && (posComment = `/* abs-fallback ${fmtNum(posX)},${fmtNum(posY)},${fmtNum(width)},${fmtNum(height)} */`);
  styles.push("box-sizing:border-box"), suppressW || styles.push(`width:${fmtNum(width)}px`), suppressH || styles.push(`height:${fmtNum(height)}px`), node.opacity != null && node.opacity < 1 && styles.push(`opacity:${fmtNum(node.opacity)}`), (node.frameMaskDisabled === !1 || node.clipsContent === !0) && styles.push("overflow:hidden"), styles.push(mixBlendCss(node.blendMode));
  const radiusCss = borderRadiusCss(node);
  radiusCss && styles.push(radiusCss.slice(0, -1));
  const isText = nodeType === "TEXT",
    isVector = RENDER_VECTOR_TYPES.has(nodeType),
    effects = effectsCss(node, ctx, isText || isVector),
    borderShadows = [];
  let innerHtml = "";
  if (isText) {
    styles.push(textStyleCss(node).slice(0, -1));
    const chars = node.textData?.characters ?? "";
    if (ctx.opts.textMode === "glyphs") {
      const svgText = textSvg(node, ctx, effects.svgFilter);
      if (svgText && effects.backdrop) {
        const maskUri = `data:image/svg+xml;base64,${bytesToBase64(new TextEncoder().encode(svgText.replace(/fill="[^"]*"/, 'fill="#000"')))}`;
        innerHtml = `<div style="position:absolute;inset:0;backdrop-filter:${effects.backdrop.trim()};-webkit-mask-image:url('${maskUri}');mask-image:url('${maskUri}');-webkit-mask-size:100% 100%;mask-size:100% 100%"></div>` + svgText, effects.backdrop = "";
      } else innerHtml = svgText ?? `<span style="white-space:pre-wrap">${escapeHtml(chars)}</span>`;
      innerHtml += `<span style="position:absolute;inset:0;opacity:0;white-space:pre-wrap">${escapeHtml(chars)}</span>`;
    } else innerHtml = `<span style="white-space:pre-wrap">${escapeHtml(chars)}</span>`;
  } else if (isVector) {
    if (innerHtml = geometrySvg(node, ctx, width, height, effects.svgFilter), node.children?.length && nodeType !== "BOOLEAN_OPERATION") {
      pushWarning(ctx, node, "vector-children", `${nodeType} has ${node.children.length} children (rendering as overlay)`);
      for (const child of node.children) innerHtml += renderNode(child, ctx, !1);
    }
  } else {
    const bgCss = backgroundCss(node.fillPaints ?? node.backgroundPaints, ctx, node, width, height);
    bgCss && styles.push(bgCss.slice(0, -1));
    const borderInfo = borderCss(node, ctx);
    borderInfo.css && styles.push(borderInfo.css.slice(0, -1)), borderShadows.push(...borderInfo.shadows), nodeType && !KNOWN_BOX_TYPES.has(nodeType) && pushWarning(ctx, node, "unknown-type", `Unhandled node type ${nodeType}, rendering as div`);
    let axis;
    if (flexMode) {
      const layout = layoutCss(node, ctx);
      layout.css && styles.push(layout.css), axis = layout.axis, layout.grid, !isRoot && layout.axis && (layout.hugW && (suppressW = !0), layout.hugH && (suppressH = !0));
    }
    if (nodeType === "INSTANCE" && !node.children?.length) {
      const stretchInner = isRoot || parent !== void 0 && stretchesCounterAxis(node, parent, stretched);
      if (contentFn) innerHtml = contentFn(node, axis);else {
        const resolved = resolveInstance(node, [], ctx.fig, 0, {
          expandAll: !0
        });
        innerHtml = resolved ? renderChildren(resolved.children ?? [], ctx, axis, resolved, stretchInner) : renderInstanceHtml(node, ctx, [], [], stretchInner);
      }
    } else if (contentFn) innerHtml = contentFn(node, axis);else {
      const stretchKids = isRoot || parent !== void 0 && stretchesCounterAxis(node, parent, stretched) && sameStackMode(parent, node);
      innerHtml = renderChildren(node.children ?? [], ctx, axis, node, stretchKids);
    }
  }
  const allShadows = [...borderShadows, ...effects.boxShadow];
  allShadows.length && styles.push(`box-shadow:${allShadows.join(",")}`), effects.filter && styles.push(`filter:${effects.filter.trim()}`), effects.backdrop && styles.push(`backdrop-filter:${effects.backdrop.trim()}`);
  const styleAttr = escapeHtml(styles.filter(Boolean).join(";")) + posComment;
  return `<div ${`data-fig-id="${guidKey}" data-fig-type="${escapeHtml(nodeType)}" data-fig-name="${escapeHtml(node.name ?? "")}"`} style="${styleAttr}">${innerHtml}</div>`;
}
function renderChildren(children, ctx, axis, parent, stretched = !1) {
  let html = "",
    childIdx = 0;
  for (; childIdx < children.length;) {
    const child = children[childIdx];
    if (child.mask && child.visible !== !1) {
      const clipSvg = clipPathSvg(child, ctx),
        maskedParts = [];
      for (childIdx++; childIdx < children.length && !children[childIdx].mask;) maskedParts.push(renderNode(children[childIdx], ctx, !1, void 0, axis, parent, stretched)), childIdx++;
      html += clipSvg ? maskGroupHtml(clipSvg, maskedParts.join(""), ctx) : (pushWarning(ctx, child, "mask-no-geometry", "Mask has no usable geometry; rendering siblings unmasked"), maskedParts.join(""));
    } else html += renderNode(child, ctx, !1, void 0, axis, parent, stretched), childIdx++;
  }
  return html;
}
function renderInstanceHtml(node, ctx, stack, path, _stretched = !1) {
  return renderInstance(node, ctx, stack, path, (childNode, renderKids, renderInst, axis, parentNode, stretchFlag) => childNode.type === "INSTANCE" && !childNode.children?.length ? renderNode(childNode, ctx, !1, () => renderInst(childNode), axis, parentNode, stretchFlag ?? !1) : renderNode(childNode, ctx, !1, kid => renderKids(kid), axis, parentNode, stretchFlag ?? !1), (maskNode, maskContent) => {
    const clipSvg = clipPathSvg(maskNode, ctx);
    return clipSvg ? maskGroupHtml(clipSvg, maskContent, ctx) : maskContent;
  });
}
const MIME_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "application/octet-stream": "bin"
};
function renderToHtml(fig, guidKey, opts = {}) {
  const rootNode = fig.nodes.get(guidKey);
  if (!rootNode) throw new Error(`Node not found: ${guidKey}`);
  const imageMode = opts.imageMode ?? "inline",
    imageDir = opts.imageDir ?? "images",
    textMode = opts.textMode ?? "glyphs",
    layoutMode = opts.layoutMode ?? "absolute",
    imageVars = new Map(),
    externalImages = new Map(),
    warnings = [],
    bodyHtml = renderNode(rootNode, {
      fig: fig,
      opts: {
        imageMode: imageMode,
        imageDir: imageDir,
        textMode: textMode,
        layoutMode: layoutMode
      },
      warnings: warnings,
      uid: {
        n: 0
      },
      imageRef: hashBytes => {
        if (imageMode === "none") return;
        const hashHex = bytesToHex(hashBytes),
          image = fig.images.get(hashHex);
        if (!image) {
          warnings.push({
            nodeId: "-",
            kind: "image-missing",
            message: `Image hash ${hashHex} not in archive`
          });
          return;
        }
        if (imageMode === "inline") {
          const existing = imageVars.get(hashHex);
          if (existing) return `var(${existing.varName})`;
          const varName = `--img-${imageVars.size}`,
            dataUri = `data:${image.mime};base64,${bytesToBase64(image.bytes)}`;
          return imageVars.set(hashHex, {
            varName: varName,
            dataUri: dataUri
          }), `var(${varName})`;
        }
        const external = externalImages.get(hashHex),
          filename = external?.filename ?? `${hashHex}.${MIME_EXTENSIONS[image.mime] ?? "bin"}`;
        return external || externalImages.set(hashHex, {
          hash: hashHex,
          bytes: image.bytes,
          mime: image.mime,
          filename: filename
        }), `url("${imageDir}/${filename}")`;
      },
      imageVars: imageVars,
      externalImages: externalImages
    }, !0);
  let varCss = "";
  for (const {
    varName: cssVar,
    dataUri: uri
  } of imageVars.values()) varCss += `${cssVar}:url("${uri}");`;
  return {
    html: `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(rootNode.name ?? guidKey)}</title>
<style>*{margin:0;padding:0}body{font-family:sans-serif}:root{${varCss}}</style>
</head><body>${bodyHtml}</body></html>`,
    warnings: warnings,
    images: [...externalImages.values()]
  };
}
const RASTER_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp"
  },
  ASSET_HASH_LEN = 16;
function resolveImage(fig, hash) {
  const image = fig.images.get(hash);
  if (!image) return;
  const mime = detectMime(image.bytes),
    ext = RASTER_EXT[mime];
  return {
    filename: `${hash.slice(0, ASSET_HASH_LEN)}.${ext ?? "bin"}`,
    bytes: image.bytes,
    mime: mime,
    raster: ext !== void 0
  };
}
function slug(name, fallback = "node") {
  return (name ?? "").replace(/[^a-zA-Z0-9._ -]+/g, " ").trim().replace(/\s+/g, "-").replace(/^[-._]+|[-._]+$/g, "").slice(0, 60) || fallback;
}
function pascal(name, fallback = "Node") {
  let result = (name ?? "").replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).slice(0, 5).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join("").slice(0, 40);
  const leadingDigits = result.match(/^(\d+)(.*)$/);
  return leadingDigits && (result = leadingDigits[2] + leadingDigits[1]), result = result.replace(/^[^a-zA-Z]+/, ""), result ? result.charAt(0).toUpperCase() + result.slice(1) : fallback;
}
function camel(name, fallback = "value") {
  const pascalName = pascal(name, fallback);
  return pascalName.charAt(0).toLowerCase() + pascalName.slice(1);
}
function dedupe(names) {
  // Uniqueness is keyed on a case-folded form: these names become file paths,
  // and names differing only by case (e.g. MdAddChart vs MdAddchart) would
  // silently overwrite each other on case-insensitive filesystems.
  const fold = name => name.normalize("NFC").toLowerCase();
  const counts = new Map(),
    result = [];
  for (const name of names) {
    const count = counts.get(fold(name)) ?? 0;
    counts.set(fold(name), count + 1), result.push(count === 0 ? name : `${name}${count + 1}`);
  }
  const seen = new Set();
  for (let nameIdx = 0; nameIdx < result.length; nameIdx++) {
    let candidate = result[nameIdx];
    for (; seen.has(fold(candidate));) candidate = candidate + "_";
    seen.add(fold(candidate)), result[nameIdx] = candidate;
  }
  return result;
}
function childSlugs(children) {
  const rawSlugs = children.map(child => slug(child.name, (child.type ?? "node").toLowerCase())),
    uniqueSlugs = dedupe(rawSlugs),
    byGuid = new Map();
  return children.forEach((child, childIdx) => byGuid.set(guidStr(child.guid), uniqueSlugs[childIdx])), byGuid;
}
function childPascals(children) {
  const rawNames = children.map(child => pascal(child.name, pascal(child.type ?? "Node"))),
    uniqueNames = dedupe(rawNames),
    byGuid = new Map();
  return children.forEach((child, childIdx) => byGuid.set(guidStr(child.guid), uniqueNames[childIdx])), byGuid;
}
function truncateLine(text, maxLen = 120) {
  return [...(text ?? "").replace(/[\r\n\u2028\u2029]+/g, " ")].slice(0, maxLen).join("");
}
function escapeCommentText(text) {
  return (text ?? "").replace(/\*\//g, "*\\/");
}
function jsxStringAttr(name, value) {
  return ` ${name}={${JSON.stringify(value ?? "")}}`;
}
function weigh(node) {
  let weight = 3;
  node.type === "TEXT" && (weight += 2), (node.fillGeometry?.length || node.strokeGeometry?.length) && (weight += 4);
  for (const child of node.children ?? []) weight += weigh(child);
  return weight;
}
function weightMap(root, detectRepeats = !0) {
  const weights = new Map(),
    visit = node => {
      let weight = 3;
      node.type === "TEXT" && (weight += 2), (node.fillGeometry?.length || node.strokeGeometry?.length) && (weight += 4);
      const children = node.children ?? [];
      if (detectRepeats && children.length >= 3) {
        const runs = findRepeatedRuns(children);
        let childIdx = 0;
        for (const run of runs) {
          for (; childIdx < run.start; childIdx++) weight += visit(children[childIdx]);
          const runWeight = visit(children[run.start]);
          for (let itemIdx = run.start + 1; itemIdx < run.end; itemIdx++) visit(children[itemIdx]);
          weight += runWeight + (run.end - run.start) + 3, childIdx = run.end;
        }
        for (; childIdx < children.length; childIdx++) weight += visit(children[childIdx]);
      } else for (const child of children) weight += visit(child);
      return weights.set(guidStr(node.guid), weight), weight;
    };
  return visit(root), weights;
}
function signature(node, depth = 2) {
  const parts = [node.type ?? "?"];
  return node.type === "TEXT" && parts.push("T"), depth > 0 && node.children?.length ? parts.push("[" + node.children.map(child => signature(child, depth - 1)).join(",") + "]") : parts.push(`#${node.children?.length ?? 0}`), parts.join(":");
}
function findRepeatedRuns(children, minRun = 3) {
  if (children.length < minRun) return [];
  const sigs = children.map(child => signature(child)),
    runs = [];
  let runStart = 0;
  for (; runStart < children.length;) {
    const sig = sigs[runStart];
    let runEnd = runStart + 1;
    for (; runEnd < children.length && sigs[runEnd] === sig;) runEnd++;
    runEnd - runStart >= minRun && weigh(children[runStart]) >= 4 && runs.push({
      start: runStart,
      end: runEnd,
      sig: sig,
      items: children.slice(runStart, runEnd)
    }), runStart = runEnd;
  }
  return runs;
}
function pickSplits(node, weights, budget) {
  const splits = new Set(),
    totalWeight = weights.get(guidStr(node.guid)) ?? 0;
  if (totalWeight <= budget) return splits;
  let remaining = totalWeight;
  const candidates = [],
    collect = (parent, _unused) => {
      for (const child of parent.children ?? []) {
        const childId = guidStr(child.guid),
          childWeight = weights.get(childId) ?? 0;
        childWeight >= 30 && (child.children?.length ?? 0) > 0 && candidates.push({
          id: childId,
          w: childWeight,
          node: child
        }), collect(child);
      }
    };
  collect(node), candidates.sort((candA, candB) => candB.w - candA.w);
  const hasSplitParent = target => {
    const checkUnder = subtree => {
      for (const childNode of subtree.children ?? []) {
        if (childNode === target) return splits.has(guidStr(subtree.guid));
        if (checkUnder(childNode)) return !0;
      }
      return !1;
    };
    return checkUnder(node);
  };
  for (const candidate of candidates) {
    if (remaining <= budget) break;
    splits.has(candidate.id) || hasSplitParent(candidate.node) || (splits.add(candidate.id), remaining -= candidate.w - 2);
  }
  for (const candidate of candidates) {
    if (!splits.has(candidate.id)) continue;
    const childSplits = pickSplits(candidate.node, weights, budget);
    for (const splitId of childSplits) splits.add(splitId);
  }
  return splits;
}
const EMIT_SKIP_TYPES = new Set(["VARIABLE", "VARIABLE_SET", "STYLE", "VARIABLE_OVERRIDE", "STICKY", "WIDGET", "SLICE"]),
  EMIT_VECTOR_TYPES = new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "REGULAR_POLYGON"]),
  ICON_PATH_THRESHOLD = 400;
function standaloneSvg(node, fig) {
  const width = node.size?.x ?? 0,
    height = node.size?.y ?? 0,
    fillPaths = geometryPaths(node.fillGeometry, fig),
    strokePaths = geometryPaths(node.strokeGeometry, fig),
    pathLines = [...fillPaths.map(path => `  <path d="${path.d}" fill="currentColor" fill-rule="${path.rule}"/>`), ...strokePaths.map(path => `  <path d="${path.d}" fill="currentColor" fill-rule="${path.rule}"/>`)];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmtNum(width)}" height="${fmtNum(height)}" viewBox="0 0 ${fmtNum(width)} ${fmtNum(height)}" fill="none">
${pathLines.join(`
`)}
</svg>
`;
}
function escapeJsxComment(text) {
  return text.replace(/[{}<>]/g, ch => ({
    "{": "&#123;",
    "}": "&#125;",
    "<": "&lt;",
    ">": "&gt;"
  })[ch]);
}
const DEFAULT_NAME_RE = /^(Frame|Group|Rectangle|Ellipse|Line|Vector|Star|Polygon|Slice|Component|Section|Instance)\s*\d*$/i;
function isMeaningfulName(name, nodeType) {
  return !(!name || DEFAULT_NAME_RE.test(name) || nodeType && name.toLowerCase() === nodeType.toLowerCase());
}
function dataNameAttr(node) {
  return isMeaningfulName(node.name, node.type) ? jsxStringAttr("data-name", node.name) : "";
}
function emitNodeJsx(node, ctx, isRoot, indent) {
  if (node.internalOnly) return "";
  const nodeType = node.type ?? "";
  if (EMIT_SKIP_TYPES.has(nodeType)) return "";
  const guidKey = guidStr(node.guid),
    holes = ctx.propHoles.get(guidKey) ?? [],
    findHole = kind => holes.find(hole => hole.kind === kind),
    visibleHole = findHole("visible");
  if (!visibleHole && node.visible === !1) return "";
  if (!isRoot && ctx.splits.has(guidKey) && ctx.childNames.has(guidKey)) {
    const childName = ctx.childNames.get(guidKey);
    ctx.imports.set(childName, `./${childName}/${childName}.jsx`);
    const transform = node.transform,
      sizeText = `${fmtNum(node.size?.x ?? 0)}×${fmtNum(node.size?.y ?? 0)}`,
      posText = transform ? ` at ${fmtNum(transform.m02)},${fmtNum(transform.m12)}` : "";
    return `${indent}<${childName} /> {/* → ${ctx.vfsPath}/${childName}/${childName}.jsx (${sizeText}${posText}) */}`;
  }
  if (nodeType === "INSTANCE") {
    const instanceJsx = emitInstanceJsx(node, ctx, indent, isRoot, findHole("slot"));
    return visibleHole ? wrapVisibilityProp(instanceJsx, visibleHole, node, indent) : instanceJsx;
  }
  const style = computeNodeStyle(node, {
    isRoot: isRoot,
    imageRef: imageHash => ctx.imagePath(imageHash)
  });
  if (nodeType === "TEXT") {
    const textStyle = {
      ...style,
      ...textStyleProps(node)
    };
    delete textStyle.backgroundColor, delete textStyle.background;
    const chars = String(node.textData?.characters ?? ""),
      styleText = fmtObject(textStyle, indent),
      textHole = findHole("text"),
      contentJsx = textHole ? `{props.${textHole.propKey} ?? ${JSON.stringify(chars)}}` : chars.includes(`
`) ? `
${indent}  {${JSON.stringify(chars)}}
${indent}` : escapeJsxComment(chars),
      spanJsx = `${indent}<span${dataNameAttr(node)} style={${styleText}}>${contentJsx}</span>`;
    return visibleHole ? wrapVisibilityProp(spanJsx, visibleHole, node, indent) : spanJsx;
  }
  if (EMIT_VECTOR_TYPES.has(nodeType)) {
    const vectorJsx = emitVectorJsx(node, ctx, style, indent);
    return visibleHole ? wrapVisibilityProp(vectorJsx, visibleHole, node, indent) : vectorJsx;
  }
  const visibleChildren = (node.children ?? []).filter(child => !EMIT_SKIP_TYPES.has(child.type ?? "")),
    childrenJsx = emitChildrenJsx(visibleChildren, ctx, indent + "  "),
    fillHole = findHole("fill"),
    styleExpr = fillHole ? bgColorPropStyle(style, fillHole.propKey, indent) : fmtObject(style, indent),
    nameAttr = dataNameAttr(node),
    divJsx = childrenJsx.trim() ? `${indent}<div${nameAttr} style={${styleExpr}}>
${childrenJsx}
${indent}</div>` : `${indent}<div${nameAttr} style={${styleExpr}} />`;
  return visibleHole ? wrapVisibilityProp(divJsx, visibleHole, node, indent) : divJsx;
}
function emitVectorJsx(node, ctx, style, indent) {
  const fillPaths = geometryPaths(node.fillGeometry, ctx.fig),
    strokePaths = geometryPaths(node.strokeGeometry, ctx.fig),
    allPaths = [...fillPaths, ...strokePaths],
    totalPathLen = allPaths.reduce((total, path) => total + path.d.length, 0),
    color = firstVisibleSolidColor(node.fillPaints) ?? firstVisibleSolidColor(node.strokePaints) ?? "currentColor",
    width = node.size?.x ?? 0,
    height = node.size?.y ?? 0,
    nameAttr = dataNameAttr(node);
  if (totalPathLen > ICON_PATH_THRESHOLD || allPaths.length > 3) {
    const assetName = uniqueAssetName(slug(node.name, "icon"), ctx, ".svg"),
      svgContent = standaloneSvg(node, ctx.fig);
    ctx.addAsset({
      kind: "svg",
      name: assetName,
      content: svgContent,
      mime: "image/svg+xml"
    });
    const imgStyle = {
        ...style,
        color: color
      },
      imgStyleText = fmtObject(imgStyle, indent);
    return `${indent}<img${nameAttr} src="./${assetName}"${jsxStringAttr("alt", node.name)} style={${imgStyleText}} />`;
  }
  const pathLines = allPaths.map(path => `${indent}  <path d="${path.d}" fillRule="${path.rule}" />`).join(`
`),
    styleText = fmtObject(style, indent);
  return allPaths.length ? `${indent}<svg${nameAttr} width={${fmtNum(width)}} height={${fmtNum(height)}} viewBox="0 0 ${fmtNum(width)} ${fmtNum(height)}" fill="${color}" style={${styleText}}>
${pathLines}
${indent}</svg>` : `${indent}<div${nameAttr} style={${styleText}} /> {/* ${escapeCommentText(node.type)}: empty geometry */}`;
}
function firstVisibleSolidColor(paints) {
  const solid = paints?.find(paint => paint.visible !== !1 && paint.type === "SOLID" && paint.color);
  return solid?.color ? cssColor(solid.color, solid.opacity ?? 1) : void 0;
}
function wrapVisibilityProp(jsx, hole, node, indent) {
  const defaultText = node.visible === !1 ? "false" : "true";
  return `${indent}{(props.${hole.propKey} ?? ${defaultText}) && (
${jsx}
${indent})}`;
}
function bgColorPropStyle(style, propKey, indent) {
  const rest = {
      ...style
    },
    bgValue = rest.backgroundColor ?? rest.background;
  delete rest.backgroundColor, delete rest.background;
  const restText = fmtObject(rest, indent),
    bgDecl = `backgroundColor: props.${propKey} ?? ${JSON.stringify(bgValue ?? void 0)}`;
  return restText === "{}" ? `{ ${bgDecl} }` : restText.replace(/\}$/, `  ${bgDecl},
${indent}}`);
}
function uniqueAssetName(base, ctx, ext) {
  let candidate = `${base}${ext}`,
    counter = 2;
  for (; ctx.assetNames.has(candidate);) candidate = `${base}-${counter++}${ext}`;
  return ctx.assetNames.add(candidate), candidate;
}
function emitChildrenJsx(children, ctx, indent) {
  if (!children.length) return "";
  if (ctx.detectRepeats) {
    const runs = findRepeatedRuns(children);
    if (runs.length) {
      const parts = [];
      let childIdx = 0;
      for (const run of runs) {
        for (; childIdx < run.start; childIdx++) parts.push(emitNodeJsx(children[childIdx], ctx, !1, indent));
        parts.push(emitRepeatJsx(run.items, ctx, indent)), childIdx = run.end;
      }
      for (; childIdx < children.length; childIdx++) parts.push(emitNodeJsx(children[childIdx], ctx, !1, indent));
      return parts.filter(Boolean).join(`
`);
    }
  }
  return children.map(child => emitNodeJsx(child, ctx, !1, indent)).filter(Boolean).join(`
`);
}
function emitRepeatJsx(items, ctx, indent) {
  const first = items[0],
    holesByGuid = new Map(),
    diffs = items.map(item => diffInstanceProps(first, item, ctx, holesByGuid)),
    propKeys = new Set();
  for (const diff of diffs) for (const key of Object.keys(diff)) propKeys.add(key);
  const moduleName = ctx.spawnRepeatModule(first, pascal(first.name, "Item"), holesByGuid);
  ctx.imports.set(moduleName, `./${moduleName}/${moduleName}.jsx`);
  const modulePath = `${ctx.vfsPath}/${moduleName}/${moduleName}.jsx`;
  if (propKeys.size === 0) return `${indent}{Array.from({ length: ${items.length} }).map((_, i) => (
${indent}  <${moduleName} key={i} />
${indent}))} {/* ${items.length}× → ${modulePath} */}`;
  const fmtValue = value => value instanceof BareId ? value.bareId : JSON.stringify(value),
    itemLines = items.map((item, itemIdx) => {
      const entries = [...propKeys].map(propKey => diffs[itemIdx][propKey] !== void 0 ? `${propKey}: ${fmtValue(diffs[itemIdx][propKey])}` : null).filter(Boolean).join(", ");
      return `${indent}  { ${entries} },`;
    });
  return `${indent}{[
${itemLines.join(`
`)}
${indent}].map((item, i) => (
${indent}  <${moduleName} key={i} {...item} />
${indent}))} {/* ${items.length}× → ${modulePath} */}`;
}
class BareId {
  constructor(value) {
    this.bareId = value;
  }
  bareId;
}
function pushUniqueByKind(map, key, entry) {
  const list = map.get(key) ?? [];
  list.some(existing => existing.kind === entry.kind) || list.push(entry), map.set(key, list);
}
function camelKeyFromName(name) {
  const words = name.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).slice(0, 2);
  return camel(words.join(" ").slice(0, 20)) || "value";
}
function instanceSymbolId(node) {
  const symbolData = node.symbolData,
    symbolId = node.overriddenSymbolID ?? symbolData?.symbolID;
  return symbolId ? guidStr(symbolId) : void 0;
}
function diffInstanceProps(base, variant, ctx, holesByGuid, keyPrefix = "") {
  const props = {},
    guidKey = guidStr(base.guid),
    keyBase = keyPrefix || camelKeyFromName(base.name ?? base.type ?? "item"),
    baseText = base.textData?.characters,
    variantText = variant.textData?.characters;
  if (baseText !== variantText && variantText != null) {
    const propKey = keyBase + "Text";
    props[propKey] = String(variantText), pushUniqueByKind(holesByGuid, guidKey, {
      kind: "text",
      propKey: propKey
    });
  }
  if ((base.visible ?? !0) !== (variant.visible ?? !0)) {
    const propKey = keyBase + "Visible";
    props[propKey] = !!(variant.visible ?? !0), pushUniqueByKind(holesByGuid, guidKey, {
      kind: "visible",
      propKey: propKey
    });
  }
  if (base.type === "INSTANCE" || variant.type === "INSTANCE") {
    const baseSymbol = instanceSymbolId(base),
      variantSymbol = instanceSymbolId(variant);
    if (baseSymbol !== variantSymbol && variantSymbol) {
      const compRef = ctx.componentRef(variantSymbol),
        slotKey = keyBase + "Slot";
      compRef ? (ctx.imports.set(compRef.name, compRef.importPath), props[slotKey] = new BareId(compRef.name)) : props[slotKey] = variantSymbol, pushUniqueByKind(holesByGuid, guidKey, {
        kind: "slot",
        propKey: slotKey
      });
    }
  }
  const baseChildren = base.children ?? [],
    variantChildren = variant.children ?? [],
    pairCount = Math.min(baseChildren.length, variantChildren.length);
  for (let childIdx = 0; childIdx < pairCount; childIdx++) {
    const childKey = camelKeyFromName(baseChildren[childIdx].name ?? baseChildren[childIdx].type ?? `c${childIdx}`);
    Object.assign(props, diffInstanceProps(baseChildren[childIdx], variantChildren[childIdx], ctx, holesByGuid, keyPrefix ? `${keyPrefix}_${childKey}` : childKey));
  }
  return props;
}
function emitInstanceJsx(node, ctx, indent, isRoot, slotHole) {
  const symbolData = node.symbolData;
  if (!symbolData) return `${indent}{/* INSTANCE missing symbolData */}`;
  const symbolKey = guidStr(symbolData.symbolID),
    compRef = ctx.componentRef(symbolKey),
    symbolNode = ctx.fig.nodes.get(symbolKey);
  if (!compRef) {
    const stubName = pascal(symbolNode?.name ?? node.name, "Component"),
      stubComment = symbolNode ? `"${escapeCommentText(symbolNode.name)}"` : "not in file";
    return `${indent}<${stubName} /> {/* external: ${symbolKey} (${stubComment}) */}`;
  }
  ctx.imports.set(compRef.name, compRef.importPath);
  const overrides = symbolData.symbolOverrides ?? [],
    attrs = [],
    style = computeNodeStyle(node, {
      isRoot: isRoot,
      imageRef: imageHash => ctx.imagePath(imageHash)
    }),
    posStyle = {
      position: style.position,
      left: style.left,
      top: style.top,
      width: style.width,
      height: style.height
    };
  for (const key of Object.keys(posStyle)) posStyle[key] == null && delete posStyle[key];
  attrs.push(`style={${fmtObject(posStyle, indent + "  ")}}`);
  for (const override of overrides) {
    const guidPath = override.guidPath?.guids ?? [],
      targetKey = guidPath[guidPath.length - 1] ? guidStr(guidPath[guidPath.length - 1]) : symbolKey,
      targetNode = ctx.fig.nodes.get(targetKey),
      keyBase = camelKeyFromName(targetNode?.name ?? "override"),
      {
        guidPath: _guidPath,
        ...fields
      } = override,
      fieldNames = Object.keys(fields);
    if (fieldNames.includes("textData")) {
      const text = fields.textData?.characters;
      text && attrs.push(`${keyBase}Text={${JSON.stringify(text)}}`);
    } else if (fieldNames.includes("overriddenSymbolID")) {
      const swapKey = guidStr(fields.overriddenSymbolID),
        swapRef = ctx.componentRef(swapKey);
      attrs.push(`${keyBase}Slot=${JSON.stringify(swapRef?.importPath ?? swapKey)}`);
    } else if (fieldNames.includes("fillPaints")) {
      const fillColor = firstVisibleSolidColor(fields.fillPaints);
      fillColor && attrs.push(`${keyBase}Fill="${fillColor}"`);
    } else fieldNames.includes("visible") ? attrs.push(`${keyBase}Visible={${!!fields.visible}}`) : fieldNames.length && attrs.push(`/* ${escapeCommentText(`${keyBase}: ${fieldNames.join(",")}`)} */`);
  }
  const propAssignments = node.componentPropAssignments;
  for (const assignment of propAssignments ?? []) {
    const defNode = ctx.fig.nodes.get(guidStr(assignment.defID)),
      propKey = camelKeyFromName(defNode?.name ?? "prop");
    if (assignment.value?.textValue?.characters) attrs.push(`${propKey}={${JSON.stringify(assignment.value.textValue.characters)}}`);else if (assignment.value?.boolValue !== void 0) attrs.push(`${propKey}={${!!assignment.value.boolValue}}`);else if (assignment.value?.guidValue) {
      const slotKey = guidStr(assignment.value.guidValue),
        slotRef = ctx.componentRef(slotKey);
      attrs.push(`${propKey}=${JSON.stringify(slotRef?.importPath ?? slotKey)}`);
    } else assignment.value && attrs.push(`${propKey}={${JSON.stringify(assignment.value).slice(0, 60)}}`);
  }
  const nameAttr = dataNameAttr(node),
    refComment = ` {/* → ${compRef.importPath} */}`,
    tagName = slotHole ? pascal(slotHole.propKey) : compRef.name;
  return slotHole && (slotHole.defaultSlot = compRef.name), attrs.length <= 1 ? `${indent}<${tagName}${nameAttr} ${attrs.join(" ")} />${refComment}` : `${indent}<${tagName}${nameAttr}
${attrs.map(attr => `${indent}  ${attr}`).join(`
`)}
${indent}/>${refComment}`;
}
function emitModule(spec) {
  const {
      node: node
    } = spec,
    weights = weightMap(node, spec.detectRepeats),
    splits = pickSplits(node, weights, spec.maxLines);
  return buildComponentModule(node, spec.name, spec.folder, spec.vfsPath, splits, spec, spec.propHoles);
}
function buildComponentModule(node, name, folder, vfsPath, splits, spec, propHoles) {
  const assets = [],
    subModules = [],
    imports = new Map(),
    imagePaths = new Map(),
    holes = propHoles ?? new Map(),
    imagePath = hashBytes => {
      const hashHex = bytesToHex(hashBytes);
      if (imagePaths.has(hashHex)) return imagePaths.get(hashHex);
      const image = spec.resolveImage(hashHex);
      if (!image) return;
      const assetPath = `./assets/${image.filename}`;
      imagePaths.set(hashHex, assetPath);
      const docText = `# ${image.filename}

- mime: ${image.mime}
- size: ${image.bytes.length} bytes
- hash: ${hashHex}
`;
      return assets.push({
        kind: "image",
        name: `assets/${image.filename}`,
        content: docText,
        bytes: image.bytes,
        mime: image.mime
      }), assetPath;
    },
    splitNodes = [],
    collectSplits = parent => {
      for (const child of parent.children ?? []) splits.has(guidStr(child.guid)) ? splitNodes.push(child) : collectSplits(child);
    };
  collectSplits(node);
  const splitNames = dedupe(splitNodes.map(splitNode => pascal(splitNode.name, pascal(splitNode.type ?? "Part")))),
    namesByGuid = new Map();
  splitNodes.forEach((splitNode, nodeIdx) => namesByGuid.set(guidStr(splitNode.guid), splitNames[nodeIdx]));
  const usedNames = new Set(namesByGuid.values()),
    spawnRepeat = (repeatNode, baseName, holesArg) => {
      let uniqueName = baseName,
        counter = 2;
      for (; usedNames.has(uniqueName);) uniqueName = `${baseName}${counter++}`;
      usedNames.add(uniqueName);
      const repeatPath = `${vfsPath}/${uniqueName}`;
      return subModules.push(buildComponentModule(repeatNode, uniqueName, uniqueName, repeatPath, splits, spec, holesArg)), uniqueName;
    },
    ctx = {
      fig: spec.fig,
      splits: splits,
      detectRepeats: spec.detectRepeats,
      componentRef: spec.componentRef,
      addAsset: asset => (assets.push(asset), `./${asset.name}`),
      imagePath: imagePath,
      imports: imports,
      subModules: subModules,
      childNames: namesByGuid,
      assetNames: new Set(),
      warnings: [],
      spawnRepeatModule: spawnRepeat,
      vfsPath: vfsPath,
      propHoles: holes
    },
    jsx = emitNodeJsx(node, ctx, !0, "    ");
  for (const splitNode of splitNodes) {
    const splitName = namesByGuid.get(guidStr(splitNode.guid)),
      splitPath = `${vfsPath}/${splitName}`;
    subModules.push(buildComponentModule(splitNode, splitName, splitName, splitPath, splits, spec));
  }
  const importsText = [...imports.entries()].map(([importName, importPath]) => `import ${importName} from ${JSON.stringify(importPath)};`).join(`
`),
    allHoles = [];
  for (const holeList of holes.values()) allHoles.push(...holeList);
  const typeByKind = {
      text: "string",
      visible: "boolean",
      fill: "string",
      slot: "React.ComponentType<any>"
    },
    seenKeys = new Set(),
    propSigs = [];
  for (const hole of allHoles) seenKeys.has(hole.propKey) || (seenKeys.add(hole.propKey), propSigs.push(`${hole.propKey}?: ${typeByKind[hole.kind]}`));
  const slotDecls = allHoles.filter(hole => hole.kind === "slot" && hole.defaultSlot).map(hole => `  const ${pascal(hole.propKey)} = props.${hole.propKey} ?? ${hole.defaultSlot};`);
  let propsParam = "",
    interfaceText = "";
  propSigs.length > 2 ? (interfaceText = `interface ${name}Props {
${propSigs.map(propLine => `  ${propLine};`).join(`
`)}
}

`, propsParam = `props: ${name}Props = {}`) : propSigs.length && (propsParam = `props: { ${propSigs.join("; ")} } = {}`);
  const slotDeclsText = slotDecls.length ? slotDecls.join(`
`) + `
` : "",
    sourceText = `${importsText ? importsText + `

` : ""}// figma node: ${guidStr(node.guid)} (${truncateLine(node.type)}) "${truncateLine(node.name)}"
${interfaceText}export default function ${name}(${propsParam}) {
${slotDeclsText}  return (
${jsx}
  );
}
`;
  return {
    name: name,
    folder: folder,
    nodeId: guidStr(node.guid),
    source: sourceText,
    assets: assets,
    children: subModules
  };
}
function scanSymbolHoles(fig) {
  const holesBySymbol = new Map(),
    addHole = (symbolKey, nodeKey, hole) => {
      let holes = holesBySymbol.get(symbolKey);
      holes || holesBySymbol.set(symbolKey, holes = new Map()), pushUniqueByKind(holes, nodeKey, hole);
    };
  for (const node of fig.nodes.values()) {
    if (node.type !== "INSTANCE") continue;
    const symbolData = node.symbolData;
    if (!symbolData?.symbolID) continue;
    const symbolKey = guidStr(symbolData.symbolID);
    for (const override of symbolData.symbolOverrides ?? []) {
      const guidPath = override.guidPath?.guids ?? [];
      if (!guidPath.length) continue;
      const targetKey = guidStr(guidPath[guidPath.length - 1]),
        targetNode = fig.nodes.get(targetKey),
        keyBase = camelKeyFromName(targetNode?.name ?? "override"),
        {
          guidPath: _guidPath,
          ...fields
        } = override;
      "textData" in fields ? addHole(symbolKey, targetKey, {
        kind: "text",
        propKey: keyBase + "Text"
      }) : "overriddenSymbolID" in fields ? addHole(symbolKey, targetKey, {
        kind: "slot",
        propKey: keyBase + "Slot"
      }) : "fillPaints" in fields ? addHole(symbolKey, targetKey, {
        kind: "fill",
        propKey: keyBase + "Fill"
      }) : "visible" in fields && addHole(symbolKey, targetKey, {
        kind: "visible",
        propKey: keyBase + "Visible"
      });
    }
    const propAssignments = node.componentPropAssignments;
    for (const _assignment of propAssignments ?? []);
  }
  for (const node of fig.nodes.values()) {
    if (node.type !== "SYMBOL") continue;
    const symbolKey = guidStr(node.guid),
      walk = cur => {
        const propRefs = cur.componentPropRefs;
        for (const propRef of propRefs ?? []) {
          const defKey = guidStr(propRef.defID),
            defNode = fig.nodes.get(defKey),
            keyBase = camelKeyFromName(defNode?.name ?? "prop"),
            field = propRef.componentPropNodeField;
          field === "VISIBLE" ? addHole(symbolKey, guidStr(cur.guid), {
            kind: "visible",
            propKey: keyBase + "Visible"
          }) : field === "TEXT_DATA" ? addHole(symbolKey, guidStr(cur.guid), {
            kind: "text",
            propKey: keyBase + "Text"
          }) : field === "OVERRIDDEN_SYMBOL_ID" && addHole(symbolKey, guidStr(cur.guid), {
            kind: "slot",
            propKey: keyBase + "Slot"
          });
        }
        for (const child of cur.children ?? []) walk(child);
      };
    walk(node);
  }
  return holesBySymbol;
}
function collectMetadata(fig) {
  const colors = new Map(),
    fonts = new Map(),
    images = new Map(),
    components = new Map(),
    nodeTypes = new Map();
  let totalNodes = 0;
  const addColor = (color, role) => {
      if (!color || color.a === 0) return;
      const css = cssColor(color),
        colorEntry = colors.get(css) ?? {
          color: css,
          count: 0,
          roles: new Set()
        };
      colorEntry.count++, colorEntry.roles.add(role), colors.set(css, colorEntry);
    },
    addPaint = (paint, role) => {
      if (paint.visible !== !1) {
        if (paint.type === "SOLID") addColor(paint.color, role);else if (paint.type?.startsWith("GRADIENT")) for (const stop of paint.stops ?? []) addColor(stop.color, role);else if (paint.type === "IMAGE") {
          const hash = paint.image?.hash;
          if (hash) {
            const hashHex = bytesToHex(hash),
              image = fig.images.get(hashHex),
              entry = images.get(hashHex) ?? {
                hash: hashHex,
                mime: image?.mime ?? "?",
                bytes: image?.bytes.length ?? 0,
                count: 0
              };
            entry.count++, images.set(hashHex, entry);
          }
        }
      }
    },
    pages = (fig.root.children ?? []).filter(child => child.type === "CANVAS"),
    visit = (node, pageKey, internal) => {
      totalNodes++;
      const typeName = node.type ?? "?";
      if (nodeTypes.set(typeName, (nodeTypes.get(typeName) ?? 0) + 1), !internal) {
        for (const paint of node.fillPaints ?? []) addPaint(paint, node.type === "TEXT" ? "text" : "fill");
        for (const paint of node.strokePaints ?? []) addPaint(paint, "stroke");
        for (const effect of node.effects ?? []) (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") && effect.visible !== !1 && addColor(effect.color, "shadow");
        if (node.fontName) {
          const fontKey = `${node.fontName.family}//${node.fontName.style}`,
            entry = fonts.get(fontKey) ?? {
              family: node.fontName.family,
              style: node.fontName.style,
              sizes: new Map(),
              count: 0
            };
          entry.count++, node.fontSize && entry.sizes.set(node.fontSize, (entry.sizes.get(node.fontSize) ?? 0) + 1), fonts.set(fontKey, entry);
        }
      }
      if (node.type === "INSTANCE") {
        const symbolData = node.symbolData;
        if (symbolData?.symbolID) {
          const symbolKey = guidStr(symbolData.symbolID),
            symbolNode = fig.nodes.get(symbolKey),
            componentEntry = components.get(symbolKey) ?? {
              symbolId: symbolKey,
              name: symbolNode?.name ?? "?",
              instanceCount: 0,
              pageIds: new Set()
            };
          componentEntry.instanceCount++, internal || componentEntry.pageIds.add(pageKey), components.set(symbolKey, componentEntry);
        }
      }
      for (const child of node.children ?? []) visit(child, pageKey, internal);
    };
  for (const page of pages) visit(page, guidStr(page.guid), !!page.internalOnly);
  return {
    colors: [...colors.values()].sort((entryA, entryB) => entryB.count - entryA.count),
    fonts: [...fonts.values()].sort((entryA, entryB) => entryB.count - entryA.count),
    images: [...images.values()].sort((entryA, entryB) => entryB.count - entryA.count),
    components: [...components.values()].sort((entryA, entryB) => entryB.instanceCount - entryA.instanceCount),
    nodeTypes: nodeTypes,
    totalNodes: totalNodes
  };
}
function metadataMarkdown(meta, limit = 30) {
  const lines = [`# Design metadata
`];
  lines.push(`## Colors (top ${Math.min(limit, meta.colors.length)})
`);
  for (const colorInfo of meta.colors.slice(0, limit)) lines.push(`- \`${colorInfo.color}\` — ${colorInfo.count}× (${[...colorInfo.roles].join(", ")})`);
  lines.push(`
## Fonts (${meta.fonts.length})
`);
  for (const fontInfo of meta.fonts.slice(0, limit)) {
    const sizesText = [...fontInfo.sizes.entries()].sort((sizeEntryA, sizeEntryB) => sizeEntryB[1] - sizeEntryA[1]).slice(0, 6).map(([size, count]) => `${size}px×${count}`).join(", ");
    lines.push(`- **${fontInfo.family}** ${fontInfo.style} — ${fontInfo.count}× (sizes: ${sizesText})`);
  }
  lines.push(`
## Images (top ${Math.min(limit, meta.images.length)})
`);
  for (const imageInfo of meta.images.slice(0, limit)) {
    const sizeKb = (imageInfo.bytes / 1024).toFixed(0);
    lines.push(`- \`${imageInfo.hash.slice(0, ASSET_HASH_LEN)}\` (${imageInfo.mime}, ${sizeKb}KB) — ${imageInfo.count}×`);
  }
  lines.push(`
## Components (top ${Math.min(limit, meta.components.length)})
`);
  for (const componentInfo of meta.components.slice(0, limit)) lines.push(`- **${componentInfo.name}** (\`${componentInfo.symbolId}\`) — ${componentInfo.instanceCount} instances across ${componentInfo.pageIds.size} page(s)`);
  lines.push(`
## Node types
`);
  const typeCounts = [...meta.nodeTypes.entries()].sort((typeA, typeB) => typeB[1] - typeA[1]);
  for (const [typeName, count] of typeCounts) lines.push(`- ${typeName}: ${count}`);
  return lines.push(`
Total nodes: ${meta.totalNodes}`), lines.join(`
`) + `
`;
}
class FigVfs {
  constructor(fig, options = {}) {
    this.fig = fig;
    const maxLines = options.maxLines ?? 1200,
      detectRepeats = options.detectRepeats ?? !0,
      resolveImageFn = hash => resolveImage(fig, hash);
    this.addDir("/"), this.meta = collectMetadata(fig);
    const canvases = (fig.root.children ?? []).filter(child => child.type === "CANVAS"),
      pages = canvases.filter(canvas => !canvas.internalOnly),
      pageSlugs = dedupe(pages.map(page => slug(page.name, "page"))),
      symbolsById = new Map(),
      collectSymbols = (node, pageIdx) => {
        node.type === "SYMBOL" && symbolsById.set(guidStr(node.guid), {
          name: pascal(node.name, "Component"),
          pageIdx: pageIdx,
          node: node
        });
        for (const child of node.children ?? []) collectSymbols(child, pageIdx);
      };
    pages.forEach((page, pageIdx) => collectSymbols(page, pageIdx));
    for (const canvas of canvases) canvas.internalOnly && collectSymbols(canvas, -1);
    const collectRefs = (node, acc) => {
        if (node.type === "INSTANCE") {
          const symbolData = node.symbolData;
          symbolData?.symbolID && acc.add(guidStr(symbolData.symbolID));
        }
        for (const child of node.children ?? []) collectRefs(child, acc);
      },
      pagesBySymbol = new Map(),
      internalSymbols = new Set([...symbolsById.entries()].filter(([, info]) => info.pageIdx === -1).map(([symbolKey]) => symbolKey)),
      depsBySymbol = new Map();
    for (const symbolKey of internalSymbols) {
      const refs = new Set();
      collectRefs(symbolsById.get(symbolKey).node, refs), depsBySymbol.set(symbolKey, new Set([...refs].filter(ref => internalSymbols.has(ref)))), pagesBySymbol.set(symbolKey, new Set());
    }
    pages.forEach((page, pageIdx) => {
      const refs = new Set();
      collectRefs(page, refs);
      for (const ref of refs) internalSymbols.has(ref) && pagesBySymbol.get(ref).add(pageIdx);
    });
    let changed = !0;
    for (; changed;) {
      changed = !1;
      for (const [symbolKey, deps] of depsBySymbol) {
        const symbolPages = pagesBySymbol.get(symbolKey);
        for (const dep of deps) for (const pageIdx of symbolPages) {
          const depPages = pagesBySymbol.get(dep);
          depPages.has(pageIdx) || (depPages.add(pageIdx), changed = !0);
        }
      }
    }
    const sharedDir = "/external-shared",
      dirBySymbol = new Map();
    for (const symbolKey of internalSymbols) {
      const pagesUsing = pagesBySymbol.get(symbolKey);
      pagesUsing.size !== 0 && dirBySymbol.set(symbolKey, pagesUsing.size === 1 ? `/${pageSlugs[[...pagesUsing][0]]}/external` : sharedDir);
    }
    const dirFor = (symbolKey, info) => info.pageIdx !== -1 ? `/${pageSlugs[info.pageIdx]}/components` : dirBySymbol.get(symbolKey),
      nameBySymbol = new Map();
    {
      const byDir = new Map();
      for (const [symbolKey, info] of symbolsById) {
        const dir = dirFor(symbolKey, info) ?? sharedDir,
          group = byDir.get(dir) ?? [];
        group.push([symbolKey, info]), byDir.set(dir, group);
      }
      for (const [, group] of byDir) {
        const names = dedupe(group.map(([, info]) => info.name));
        group.forEach(([symbolKey], groupIdx) => nameBySymbol.set(symbolKey, names[groupIdx]));
      }
    }
    const holesBySymbol = scanSymbolHoles(fig),
      externalsById = new Map(),
      componentRef = symbolKey => {
        const info = symbolsById.get(symbolKey);
        if (!info) {
          const symbolNode = fig.nodes.get(symbolKey),
            fallbackName = pascal(symbolNode?.name, "External");
          let external = externalsById.get(symbolKey);
          return external || (external = {
            name: dedupe([...externalsById.values()].map(ext => ext.name).concat(fallbackName)).pop(),
            symId: symbolKey,
            symName: symbolNode?.name
          }, externalsById.set(symbolKey, external)), {
            name: external.name,
            importPath: `${sharedDir}/${external.name}/${external.name}.jsx`
          };
        }
        const name = nameBySymbol.get(symbolKey),
          dir = dirFor(symbolKey, info) ?? sharedDir;
        return {
          name: name,
          importPath: `${dir}/${name}/${name}.jsx`
        };
      };
    pages.forEach((page, pageIdx) => {
      const pageDir = `/${pageSlugs[pageIdx]}`;
      this.addDir(pageDir, guidStr(page.guid)), this.addDir(`${pageDir}/components`);
      for (const [symbolKey, info] of symbolsById) {
        if (info.pageIdx !== pageIdx) continue;
        const name = nameBySymbol.get(symbolKey),
          modPath = `${pageDir}/components/${name}`,
          module = emitModule({
            node: info.node,
            name: name,
            folder: name,
            vfsPath: modPath,
            fig: fig,
            componentRef: componentRef,
            maxLines: maxLines,
            detectRepeats: detectRepeats,
            resolveImage: resolveImageFn,
            propHoles: holesBySymbol.get(symbolKey)
          });
        this.mountModule(module, `${pageDir}/components`);
      }
      for (const symbolKey of internalSymbols) {
        if (dirBySymbol.get(symbolKey) !== `${pageDir}/external`) continue;
        const name = nameBySymbol.get(symbolKey),
          modPath = `${pageDir}/external/${name}`,
          module = emitModule({
            node: symbolsById.get(symbolKey).node,
            name: name,
            folder: name,
            vfsPath: modPath,
            fig: fig,
            componentRef: componentRef,
            maxLines: maxLines,
            detectRepeats: detectRepeats,
            resolveImage: resolveImageFn,
            propHoles: holesBySymbol.get(symbolKey)
          });
        this.mountModule(module, `${pageDir}/external`);
      }
      const frames = (page.children ?? []).filter(child => child.type !== "SYMBOL" && !child.internalOnly),
        frameSlugs = dedupe(frames.map(frame => slug(frame.name, (frame.type ?? "frame").toLowerCase())));
      frames.forEach((frame, frameIdx) => {
        const frameSlug = frameSlugs[frameIdx],
          framePath = `${pageDir}/${frameSlug}`,
          module = emitModule({
            node: frame,
            name: pascal(frame.name, "Frame"),
            folder: frameSlug,
            vfsPath: framePath,
            fig: fig,
            componentRef: componentRef,
            maxLines: maxLines,
            detectRepeats: detectRepeats,
            resolveImage: resolveImageFn
          });
        this.mountModule(module, pageDir, "index.jsx");
      });
    }), this.addDir(sharedDir);
    for (const symbolKey of internalSymbols) {
      if (dirBySymbol.get(symbolKey) !== sharedDir) continue;
      const name = nameBySymbol.get(symbolKey),
        modPath = `${sharedDir}/${name}`,
        module = emitModule({
          node: symbolsById.get(symbolKey).node,
          name: name,
          folder: name,
          vfsPath: modPath,
          fig: fig,
          componentRef: componentRef,
          maxLines: maxLines,
          detectRepeats: detectRepeats,
          resolveImage: resolveImageFn,
          propHoles: holesBySymbol.get(symbolKey)
        });
      this.mountModule(module, sharedDir);
    }
    for (const external of externalsById.values()) {
      const stubDir = `${sharedDir}/${external.name}`;
      this.addDir(stubDir), this.addFile(`${stubDir}/${external.name}.jsx`, `// External component stub (not in this .fig)
// symbol guid: ${external.symId}
// name: ${truncateLine(external.symName ?? "?")}
export default function ${external.name}(props) {
  return <div data-external="${external.symId}" {...props} />;
}
`);
    }
    const externalCounts = {
      perPage: 0,
      shared: 0
    };
    for (const dir of dirBySymbol.values()) externalCounts[dir === sharedDir ? "shared" : "perPage"]++;
    const readme = this.buildReadme(pages, pageSlugs, symbolsById, externalCounts, externalsById.size);
    this.addFile("/README.md", readme), this.addFile("/METADATA.md", metadataMarkdown(this.meta));
  }
  fig;
  entries = new Map();
  idToPath = new Map();
  pathToId = new Map();
  meta;
  mountModule(module, parentDir, fileName) {
    const dir = `${parentDir}/${module.folder}`;
    this.addDir(dir, module.nodeId);
    const entryName = fileName ?? `${module.name}.jsx`;
    this.addFile(`${dir}/${entryName}`, module.source, module.nodeId);
    for (const asset of module.assets) this.addFile(`${dir}/${asset.name}`, asset.content, void 0, asset.bytes, asset.mime);
    for (const child of module.children) this.mountModule(child, dir);
  }
  addDir(path, nodeId) {
    this.entries.has(path) || (this.entries.set(path, {
      path: path,
      kind: "dir",
      nodeId: nodeId
    }), nodeId && (this.idToPath.set(nodeId, path), this.pathToId.set(path, nodeId)));
  }
  addFile(path, content, nodeId, bytes, mime) {
    const segments = path.split("/").slice(1);
    let prefix = "";
    for (let segIdx = 0; segIdx < segments.length - 1; segIdx++) prefix += "/" + segments[segIdx], this.addDir(prefix);
    this.entries.set(path, {
      path: path,
      kind: "file",
      content: content,
      size: bytes?.length ?? content.length,
      bytes: bytes,
      mime: mime,
      nodeId: nodeId
    }), nodeId && !this.idToPath.has(nodeId) && (this.idToPath.set(nodeId, path), this.pathToId.set(path, nodeId));
  }
  buildReadme(pages, pageSlugs, symbolsById, externalCounts, stubCount) {
    const lines = [`# Figma file (virtual)
`, `Pages:
`];
    pages.forEach((page, pageIdx) => {
      const frames = (page.children ?? []).filter(child => !child.internalOnly);
      lines.push(`- /${pageSlugs[pageIdx]}  (${frames.length} frames, guid=${guidStr(page.guid)})`);
    });
    const localCount = [...symbolsById.values()].filter(info => info.pageIdx !== -1).length;
    return lines.push("", "Components:", `  ${localCount} local → /<page>/components/`, `  ${externalCounts.perPage} page-scoped external → /<page>/external/`, `  ${externalCounts.shared + stubCount} shared external → /external-shared/`, "", "Tools: ls(path), read_file(path), grep(pattern), pathForId(id), idForPath(path), read_bytes(path)"), lines.join(`
`) + `
`;
  }
  ls(path = "/") {
    path = normalizePath(path);
    const entry = this.entries.get(path);
    if (!entry || entry.kind !== "dir") throw new Error(`Not a directory: ${path}`);
    const prefix = path === "/" ? "/" : path + "/",
      names = new Set();
    for (const key of this.entries.keys()) {
      if (!key.startsWith(prefix) || key === path) continue;
      const childName = key.slice(prefix.length).split("/")[0],
        childPath = prefix + childName,
        childEntry = this.entries.get(childPath);
      names.add(childName + (childEntry?.kind === "dir" ? "/" : ""));
    }
    return [...names].sort();
  }
  read_file(path) {
    path = normalizePath(path);
    const entry = this.entries.get(path);
    if (!entry) throw new Error(`No such file: ${path}`);
    if (entry.kind === "dir") throw new Error(`Is a directory: ${path}`);
    return entry.content ?? "";
  }
  read_bytes(path) {
    return path = normalizePath(path), this.entries.get(path)?.bytes;
  }
  grep(pattern, options = {}) {
    const regex = new RegExp(pattern, options.flags ?? "i"),
      exts = options.ext ?? [".jsx"],
      matches = [];
    for (const entry of this.entries.values()) {
      if (entry.kind !== "file" || !entry.content || !exts.some(ext => entry.path.endsWith(ext))) continue;
      const lines = entry.content.split(`
`);
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) regex.test(lines[lineIdx]) && matches.push({
        path: entry.path,
        line: lineIdx + 1,
        text: lines[lineIdx].trim().slice(0, 200)
      });
    }
    return matches;
  }
  pathForId(nodeId) {
    return this.idToPath.get(nodeId);
  }
  idForPath(path) {
    return this.pathToId.get(normalizePath(path));
  }
  tree(path = "/", maxDepth = 1 / 0) {
    path = normalizePath(path);
    const lines = [],
      walk = (curPath, depth) => {
        const entry = this.entries.get(curPath);
        if (!entry) return;
        const label = curPath === "/" ? "/" : curPath.split("/").pop(),
          suffix = entry.kind === "file" ? ` (${entry.size}b)` : "/";
        if (lines.push("  ".repeat(depth) + label + suffix), entry.kind === "dir" && depth < maxDepth) for (const childName of this.ls(curPath)) {
          const childPath = (curPath === "/" ? "" : curPath) + "/" + childName.replace(/\/$/, "");
          walk(childPath, depth + 1);
        }
      };
    return walk(path, 0), lines.join(`
`);
  }
  allPaths() {
    return [...this.entries.keys()].sort();
  }
  stat(path) {
    return this.entries.get(normalizePath(path));
  }
  metadata(limit = 20) {
    return metadataMarkdown(this.meta, limit);
  }
}
function normalizePath(path) {
  return path.startsWith("/") || (path = "/" + path), path = path.replace(/\/+/g, "/"), path.length > 1 && path.endsWith("/") && (path = path.slice(0, -1)), path;
}
function cssVarName(name) {
  return "--" + (name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "token");
}
function modeSelector(name, idx) {
  return idx === 0 ? ":root" : /dark/i.test(name) ? ':root[data-theme="dark"], .dark' : /light/i.test(name) ? ':root[data-theme="light"], .light' : `:root[data-mode="${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}"]`;
}
function externalVarName(key) {
  return "--Ext-" + key.replace(/[^a-zA-Z0-9]/g, "-");
}
function tokenValueCss(data, tokensByGuid, guidForKey) {
  const value = data?.value;
  if (value) {
    if (value.colorValue) return cssColor(value.colorValue);
    if (value.floatValue != null) {
      const float = value.floatValue;
      return `${Number.isInteger(float) ? float : +float.toFixed(3)}`;
    }
    if (typeof value.textValue == "string") return JSON.stringify(value.textValue);
    if (value.alias) {
      const aliasGuid = value.alias.guid ? guidStr(value.alias.guid) : value.alias.assetRef ? guidForKey(value.alias.assetRef.key) : void 0,
        token = aliasGuid ? tokensByGuid.get(aliasGuid) : void 0;
      if (token) return `var(${token.css})`;
      const extKey = aliasGuid ?? value.alias.assetRef?.key;
      return extKey ? `var(${externalVarName(extKey)})` : void 0;
    }
  }
}
function collectTokens(fig) {
  const tokensByGuid = new Map(),
    modeNames = new Map(),
    modeIds = [],
    modeIndexById = new Map(),
    rootModeBySet = new Map(),
    setGuidByKey = new Map();
  for (const node of fig.nodes.values()) {
    if (node.type !== "VARIABLE_SET") continue;
    const setGuid = guidStr(node.guid);
    typeof node.key == "string" && !setGuidByKey.has(node.key) && setGuidByKey.set(node.key, setGuid);
    let modeIdx = 0;
    for (const mode of node.variableSetModes ?? []) {
      const modeId = guidStr(mode.id);
      modeIdx === 0 && !rootModeBySet.has(setGuid) && rootModeBySet.set(setGuid, modeId), modeNames.has(modeId) || (modeNames.set(modeId, mode.name), modeIds.push(modeId), modeIndexById.set(modeId, modeIdx)), modeIdx++;
    }
  }
  const dataByGuid = new Map(),
    usedCssNames = new Set(),
    varGuidByKey = new Map(),
    variables = [];
  for (const node of fig.nodes.values()) node.type === "VARIABLE" && (variables.push(node), typeof node.key == "string" && !varGuidByKey.has(node.key) && varGuidByKey.set(node.key, guidStr(node.guid)));
  const publishedByGuid = new Map();
  for (const variable of variables) {
    if (!variable.publishID) continue;
    const publishedGuid = guidStr(variable.publishID);
    publishedGuid !== guidStr(variable.guid) && fig.nodes.get(publishedGuid)?.type === "VARIABLE" && publishedByGuid.set(guidStr(variable.guid), publishedGuid);
  }
  for (const variable of variables) {
    const guidKey = guidStr(variable.guid);
    if (publishedByGuid.has(guidKey)) continue;
    let cssName = cssVarName(variable.name ?? guidKey),
      counter = 2;
    for (; usedCssNames.has(cssName);) cssName = cssVarName(variable.name ?? guidKey) + `-${counter++}`;
    usedCssNames.add(cssName);
    const setRef = variable.variableSetID,
      setGuid = setRef?.guid ? guidStr(setRef.guid) : setRef?.assetRef ? setGuidByKey.get(setRef.assetRef.key) : void 0;
    tokensByGuid.set(guidKey, {
      css: cssName,
      figName: variable.name ?? guidKey,
      values: new Map(),
      resolvedType: variable.variableResolvedType ?? "STRING",
      rootModeId: setGuid ? rootModeBySet.get(setGuid) : void 0
    });
    const valuesByMode = new Map();
    for (const entry of variable.variableDataValues?.entries ?? []) valuesByMode.set(guidStr(entry.modeID), entry.variableData);
    dataByGuid.set(guidKey, valuesByMode);
  }
  for (const [aliasGuid, targetGuid] of publishedByGuid) {
    const target = tokensByGuid.get(targetGuid);
    target && tokensByGuid.set(aliasGuid, target);
  }
  const guidForKey = key => {
    const guidKey = varGuidByKey.get(key);
    return guidKey ? publishedByGuid.get(guidKey) ?? guidKey : void 0;
  };
  for (const [guidKey, token] of tokensByGuid) {
    const valuesByMode = dataByGuid.get(guidKey);
    if (valuesByMode) for (const [modeId, data] of valuesByMode) {
      const cssValue = tokenValueCss(data, tokensByGuid, guidForKey);
      cssValue && token.values.set(modeId, cssValue);
    }
  }
  const defaultModeIds = new Set([...modeIndexById].filter(([, modeIdx]) => modeIdx === 0).map(([modeId]) => modeId)),
    tokenByCss = new Map();
  for (const token of tokensByGuid.values()) tokenByCss.set(token.css, token);
  const varRefRe = /^var\((--[a-zA-Z0-9-]+)\)$/,
    rootValue = token => {
      if (token.rootModeId != null) {
        const value = token.values.get(token.rootModeId);
        if (value != null) return value;
      }
      for (const [modeId, value] of token.values) if (defaultModeIds.has(modeId)) return value;
    },
    resolveChain = token => {
      const seen = new Set();
      let cur = token;
      for (; cur && !seen.has(cur);) {
        seen.add(cur);
        const mode = rootValue(cur);
        if (mode == null) return;
        const match = varRefRe.exec(mode);
        if (!match) return mode;
        cur = tokenByCss.get(match[1]);
      }
    },
    resolvable = new Set();
  let changed = !0;
  for (; changed;) {
    changed = !1;
    for (const token of tokensByGuid.values()) {
      if (resolvable.has(token)) continue;
      const value = rootValue(token);
      if (value == null) continue;
      const match = varRefRe.exec(value),
        aliasTarget = match ? tokenByCss.get(match[1]) : void 0;
      (!match || aliasTarget && resolvable.has(aliasTarget)) && (resolvable.add(token), changed = !0);
    }
  }
  const unresolved = new Map();
  for (const token of tokensByGuid.values()) {
    if (!resolvable.has(token)) {
      token.values.clear();
      continue;
    }
    const fallback = resolveChain(token);
    for (const [modeId, value] of token.values) {
      const match = varRefRe.exec(value);
      if (!match) continue;
      const aliasTarget = tokenByCss.get(match[1]);
      (!aliasTarget || !resolvable.has(aliasTarget)) && (fallback != null ? token.values.set(modeId, `var(${match[1]}, ${fallback})`) : token.values.delete(modeId));
    }
  }
  const modeIdsInUse = new Set();
  for (const token of tokensByGuid.values()) for (const modeId of token.values.keys()) modeIdsInUse.add(modeId);
  for (const modeId of modeIdsInUse) {
    const settled = new Set();
    let modeChanged = !0;
    for (; modeChanged;) {
      modeChanged = !1;
      for (const token of tokensByGuid.values()) {
        if (settled.has(token)) continue;
        const value = token.values.get(modeId);
        if (value == null) {
          resolvable.has(token) && (settled.add(token), modeChanged = !0);
          continue;
        }
        const match = /^var\((--[a-zA-Z0-9-]+)\)$/.exec(value);
        if (!match) {
          settled.add(token), modeChanged = !0;
          continue;
        }
        const aliasTarget = tokenByCss.get(match[1]);
        aliasTarget && settled.has(aliasTarget) && (settled.add(token), modeChanged = !0);
      }
    }
    for (const token of tokensByGuid.values()) {
      const value = token.values.get(modeId);
      if (value == null || settled.has(token) || !/^var\((--[a-zA-Z0-9-]+)\)$/.exec(value)) continue;
      const resolved = resolveChain(token);
      resolved != null ? token.values.set(modeId, resolved) : token.values.delete(modeId);
    }
  }
  const finalModeIds = new Set();
  for (const token of tokensByGuid.values()) for (const modeId of token.values.keys()) finalModeIds.add(modeId);
  const modes = modeIds.filter(modeId => finalModeIds.has(modeId)).map(modeId => ({
    id: modeId,
    name: modeNames.get(modeId) ?? modeId,
    selector: modeSelector(modeNames.get(modeId) ?? "", modeIndexById.get(modeId) ?? 0)
  }));
  modes.length === 0 && modes.push({
    id: "",
    name: "default",
    selector: ":root"
  });
  const cssNameOf = guid => {
      const token = tokensByGuid.get(guid);
      if (!token) {
        unresolved.set(`guid:${guid}`, {
          label: guid
        });
        return;
      }
      if (!resolvable.has(token)) {
        unresolved.set(token.css, {
          css: token.css,
          label: token.figName
        });
        return;
      }
      return token.css;
    },
    guidForAlias = alias => {
      if (alias?.guid) {
        const guidKey = guidStr(alias.guid);
        return publishedByGuid.get(guidKey) ?? guidKey;
      }
      if (alias?.assetRef) return guidForKey(alias.assetRef.key);
    };
  return {
    tokens: tokensByGuid,
    modes: modes,
    unresolved: unresolved,
    cssNameOf: cssNameOf,
    guidForAlias: guidForAlias,
    cssNameOfAlias: alias => {
      const guidKey = guidForAlias(alias);
      if (guidKey) return cssNameOf(guidKey);
      alias?.assetRef && unresolved.set(`key:${alias.assetRef.key}`, {
        label: alias.assetRef.key
      });
    },
    rootValueOf: guid => {
      const seen = new Set();
      let cur = tokensByGuid.get(guid);
      for (; cur && !seen.has(cur);) {
        seen.add(cur);
        const mode = rootValue(cur);
        if (mode == null) return;
        const match = varRefRe.exec(mode);
        if (!match) return mode;
        cur = tokenByCss.get(match[1]);
      }
    }
  };
}
function tokensToCss(collected) {
  const lines = ["/* Generated from Figma Variables. First mode = :root default.", "   FLOAT tokens are unitless — multiply by 1px in calc() where a length is needed. */"],
    selectorById = new Map();
  for (const mode of collected.modes) selectorById.set(mode.id, mode.selector);
  const selectors = [":root"];
  for (const mode of collected.modes) selectors.includes(mode.selector) || selectors.push(mode.selector);
  const declsBySelector = new Map(),
    seen = new Set();
  for (const token of collected.tokens.values()) {
    if (seen.has(token)) continue;
    seen.add(token);
    const kindComment = token.resolvedType === "COLOR" ? " /* @kind color */" : "";
    for (const [modeId, value] of token.values) {
      const selector = token.rootModeId === modeId ? ":root" : selectorById.get(modeId);
      if (selector === void 0) continue;
      let decls = declsBySelector.get(selector);
      decls || (decls = [], declsBySelector.set(selector, decls)), decls.push(`  ${token.css}: ${value};${kindComment}`);
    }
  }
  for (const selector of selectors) {
    const decls = declsBySelector.get(selector);
    decls === void 0 || decls.length === 0 || lines.push("", `${selector} {`, ...decls.sort(), "}");
  }
  return lines.join(`
`) + `
`;
}
function paintVarCss(data, collected) {
  const alias = data?.value?.alias;
  if (!alias) return;
  const cssName = collected.cssNameOfAlias(alias);
  return cssName ? `var(${cssName})` : void 0;
}
function consumptionMapCss(node, collected) {
  const fieldMap = {
      CORNER_RADIUS: {
        css: "borderRadius",
        unit: "px"
      },
      STACK_SPACING: {
        css: "gap",
        unit: "px"
      },
      STACK_PADDING_LEFT: {
        css: "paddingLeft",
        unit: "px"
      },
      STACK_PADDING_TOP: {
        css: "paddingTop",
        unit: "px"
      },
      STACK_PADDING_RIGHT: {
        css: "paddingRight",
        unit: "px"
      },
      STACK_PADDING_BOTTOM: {
        css: "paddingBottom",
        unit: "px"
      },
      FONT_SIZE: {
        css: "fontSize",
        unit: "px"
      },
      WIDTH: {
        css: "width",
        unit: "px"
      },
      HEIGHT: {
        css: "height",
        unit: "px"
      },
      STROKE_WEIGHT: {
        css: "borderWidth",
        unit: "px"
      },
      OPACITY: {
        css: "opacity",
        unit: "none"
      }
    },
    style = {};
  for (const entry of node.variableConsumptionMap?.entries ?? []) {
    const field = entry.variableField,
      mapping = field && Object.hasOwn(fieldMap, field) ? fieldMap[field] : void 0;
    if (!mapping) continue;
    const varCss = paintVarCss(entry.variableData, collected);
    if (varCss) {
      if (field === "OPACITY") {
        const guid = collected.guidForAlias(entry.variableData?.value?.alias),
          rootVal = guid ? collected.rootValueOf(guid) : void 0,
          num = rootVal != null ? Number(rootVal) : NaN;
        if (Number.isFinite(num) && num > 1) continue;
      }
      style[mapping.css] = mapping.unit === "px" ? `calc(${varCss} * 1px)` : varCss;
    }
  }
  return style;
}
const IDENT_RE = /^[A-Za-z][A-Za-z0-9_]*$/,
  RESERVED_WORDS = new Set(["default", "class", "function", "var", "let", "const", "return", "export", "import", "if", "else", "new", "this", "super", "null", "true", "false"]),
  BUNDLE_GLOBALS = new Set(["Array", "Boolean", "Date", "Element", "Error", "Event", "Fragment", "Function", "Image", "Map", "Node", "Number", "Object", "Option", "Promise", "Proxy", "Range", "React", "ReactDOM", "Reflect", "RegExp", "Set", "String", "Symbol", "Text", "WeakMap", "WeakSet", "Window"]);
function safeIdent(name, fallback, options) {
  return !IDENT_RE.test(name) || RESERVED_WORDS.has(name) || options?.bundleMode && BUNDLE_GLOBALS.has(name) ? fallback : name;
}
function safePascal(name, fallback, options) {
  return safeIdent(pascal(name, fallback), fallback, options);
}
function safeCamel(name, fallback) {
  return safeIdent(camel(name, fallback), fallback);
}
const SIZE_ABBREV = Object.assign(Object.create(null), {
    xsmall: "xs",
    small: "sm",
    base: "base",
    medium: "md",
    large: "lg",
    xlarge: "xl",
    xxlarge: "2xl"
  }),
  CAMEL_IDENT_RE = /^[a-z][a-zA-Z0-9]*$/,
  MAX_VARIANT_COMBOS = 384,
  MAX_VARIANT_SAMPLES = 64;
function normalizeVariantLabel(label, sizeLike = !1) {
  let text = label.trim();
  const match = text.match(/^(.*?)\s*\(\d+(?:\.\d+)?\)$/);
  if (match && (text = match[1].trim()), match || sizeLike) {
    const abbrev = SIZE_ABBREV[text.toLowerCase().replace(/[\s_-]+/g, "")];
    if (abbrev) return abbrev;
  }
  return CAMEL_IDENT_RE.test(text) ? text : text.toLowerCase();
}
function normalizeVariantValue(label, sizeLike = !1) {
  const lower = label.trim().toLowerCase();
  return lower === "yes" || lower === "true" ? !0 : lower === "no" || lower === "false" ? !1 : normalizeVariantLabel(label, sizeLike);
}
function escapeVariantToken(value) {
  return String(value).replace(/[%|=]/g, ch => encodeURIComponent(ch));
}
function isSizeLikeProp(propName, values) {
  if (/size|scale/i.test(propName)) return !0;
  const sizeCount = values.filter(value => {
    const cleaned = value.trim().replace(/\s*\(\d+(?:\.\d+)?\)$/, "");
    return Object.hasOwn(SIZE_ABBREV, cleaned.toLowerCase().replace(/[\s_-]+/g, ""));
  }).length;
  return values.length > 0 && sizeCount / values.length > 0.5;
}
function normalizeVariantOptions(propName, values) {
  const sizeLike = isSizeLikeProp(propName, values),
    normalized = values.map(value => normalizeVariantValue(value, sizeLike)),
    allBoolean = normalized.length > 0 && normalized.every(value => typeof value == "boolean") && new Set(normalized).size === 2;
  let finalValues = allBoolean ? normalized : values.map(value => normalizeVariantLabel(value, sizeLike));
  const seen = new Set();
  let hasDup = !1;
  for (const value of finalValues) {
    const key = String(value);
    seen.has(key) && (hasDup = !0), seen.add(key);
  }
  hasDup && (finalValues = [...values]);
  const isBoolean = allBoolean && !hasDup,
    byOriginal = new Map();
  return values.forEach((value, idx) => byOriginal.set(value, finalValues[idx])), {
    values: finalValues,
    isBoolean: isBoolean,
    normalize: value => {
      const mapped = byOriginal.get(value) ?? byOriginal.get(value.trim());
      return mapped !== void 0 ? mapped : hasDup ? value : isBoolean ? normalizeVariantValue(value, sizeLike) : normalizeVariantLabel(value, sizeLike);
    }
  };
}
function parseVariantName(name) {
  const attrs = {};
  for (const part of name.split(/,\s*/)) {
    const eqIdx = part.indexOf("=");
    eqIdx > 0 && (attrs[part.slice(0, eqIdx).trim()] = part.slice(eqIdx + 1).trim());
  }
  return attrs;
}
const PROP_KIND_LABELS = {
  BOOL: "bool",
  TEXT: "text",
  INSTANCE_SWAP: "slot",
  NUMBER: "number",
  VARIANT: "variant"
};
function buildPropModel(node, _unused, warn) {
  const propDefs = (node.componentPropDefs ?? []).filter(def => !def.isDeleted),
    byDefId = new Map(),
    ordered = [],
    usedKeys = new Set(["className", "style", "children"]),
    uniqueKey = name => {
      const base = safeCamel(name, "prop");
      let candidate = base,
        counter = 2;
      for (; usedKeys.has(candidate);) candidate = base + counter++;
      return usedKeys.add(candidate), candidate;
    },
    valueOrders = new Map();
  for (const entry of node.stateGroupPropertyValueOrders ?? []) {
    if (!entry || typeof entry.property != "string") continue;
    const values = Array.isArray(entry.values) ? entry.values.filter(value => typeof value == "string") : [],
      seen = new Set(),
      deduped = [];
    for (const value of values) seen.has(value) || (seen.add(value), deduped.push(value));
    valueOrders.set(entry.property, deduped);
  }
  if (node.isStateGroup) for (const child of node.children ?? []) {
    if (child.type !== "SYMBOL") continue;
    const attrs = parseVariantName(child.name ?? "");
    for (const propName of Object.keys(attrs)) {
      const value = attrs[propName],
        known = valueOrders.get(propName) ?? [];
      if (known.includes(value)) {
        valueOrders.set(propName, known);
        continue;
      }
      const sizeLike = isSizeLikeProp(propName, [...known, value]),
        normalized = String(normalizeVariantValue(value, sizeLike)),
        matchIdx = known.findIndex(other => other !== value && String(normalizeVariantValue(other, sizeLike)) === normalized);
      matchIdx >= 0 ? known[matchIdx] = value : known.push(value), valueOrders.set(propName, known);
    }
  }
  const optionsByProp = new Map();
  for (const [propName, values] of valueOrders) optionsByProp.set(propName, normalizeVariantOptions(propName, values));
  const sortedDefs = [...propDefs].sort((defA, defB) => (defA.sortPosition ?? "").localeCompare(defB.sortPosition ?? ""));
  for (const def of sortedDefs) {
    if (!def.name || !def.type) continue;
    const kind = PROP_KIND_LABELS[def.type] ?? "text",
      key = uniqueKey(def.name);
    let tsType = "string",
      defaultLit = "undefined";
    const initial = def.initialValue;
    if (kind === "variant") {
      const options = optionsByProp.get(def.name);
      if (options?.isBoolean) tsType = "boolean", defaultLit = String(options.values[0] ?? !1);else {
        const values = options?.values ?? [];
        tsType = values.length ? values.map(value => JSON.stringify(value)).join(" | ") : "string", defaultLit = JSON.stringify(values[0] ?? "");
      }
    } else if (kind === "bool") tsType = "boolean", defaultLit = initial?.boolValue === !0 ? "true" : "false";else if (kind === "text") tsType = "string", defaultLit = JSON.stringify(String(initial?.textValue?.characters ?? ""));else if (kind === "number") {
      tsType = "number";
      const num = Number(initial?.floatValue);
      defaultLit = Number.isFinite(num) ? String(num) : "0";
    } else kind === "slot" && (tsType = "React.ReactNode", defaultLit = "undefined");
    const prop = {
      key: key,
      tsType: tsType,
      defaultLit: defaultLit,
      kind: kind
    };
    byDefId.set(guidStr(def.id), prop), ordered.push(prop);
  }
  for (const child of node.children ?? []) for (const def of child.componentPropDefs ?? []) {
    const parentProp = def.parentPropDefId && byDefId.get(guidStr(def.parentPropDefId));
    parentProp && byDefId.set(guidStr(def.id), parentProp);
  }
  const variantKeys = ordered.filter(prop => prop.kind === "variant").map(prop => prop.key),
    variantNames = sortedDefs.filter(def => def.type === "VARIANT" && def.name).map(def => def.name),
    normalizeByKey = new Map();
  for (let idx = 0; idx < variantKeys.length; idx++) {
    const options = optionsByProp.get(variantNames[idx] ?? "");
    options && normalizeByKey.set(variantKeys[idx], options.normalize);
  }
  const variantMap = new Map(),
    variantAttrs = new Map();
  if (node.isStateGroup) for (const child of node.children ?? []) {
    if (child.type !== "SYMBOL") continue;
    const attrs = parseVariantName(child.name ?? ""),
      attrPairs = variantNames.map((propName, propIdx) => {
        const raw = Object.hasOwn(attrs, propName) ? attrs[propName] : "",
          options = optionsByProp.get(propName);
        return [variantKeys[propIdx], options ? options.normalize(raw) : normalizeVariantLabel(raw)];
      }),
      variantKey = attrPairs.map(([key, value]) => `${key}=${escapeVariantToken(value)}`).join("|"),
      guidKey = guidStr(child.guid),
      existing = variantMap.get(variantKey);
    if (existing !== void 0 && existing !== guidKey) {
      warn?.(guidKey, "variant-key-mismatch", `variant "${(child.name ?? "").slice(0, 60)}" collides on key "${variantKey}" with an earlier child — this variant will be unreachable`);
      continue;
    }
    variantMap.set(variantKey, guidKey), variantAttrs.set(guidKey, attrPairs);
  }
  return {
    byDefId: byDefId,
    ordered: ordered,
    variantMap: variantMap,
    variantKeys: variantKeys,
    variantAttrs: variantAttrs,
    variantNormalize: normalizeByKey
  };
}
function firstVisibleSolidPaint(paints) {
  return paints?.find(paint => paint.visible !== !1 && paint.type === "SOLID" && paint.color);
}
function paintVarWithAlpha(paint, collected) {
  const varCss = paintVarCss(paint.colorVar, collected);
  if (!varCss) return;
  const guid = collected.guidForAlias(paint.colorVar?.value?.alias),
    rootVal = guid !== void 0 ? collected.rootValueOf(guid) : void 0,
    literal = paint.color !== void 0 ? cssColor(paint.color) : void 0;
  if (rootVal !== void 0 && literal !== void 0 && rootVal !== literal) return;
  const opacity = paint.opacity ?? 1;
  return opacity >= 1 ? varCss : `color-mix(in srgb, ${varCss} ${+(opacity * 100).toFixed(1)}%, transparent)`;
}
function applyTokenVars(style, node, collected) {
  if (!collected) return style;
  const result = {
    ...style
  };
  if (node.type === "TEXT") {
    const paint = firstVisibleSolidPaint(node.fillPaints),
      varCss = paint && paintVarWithAlpha(paint, collected);
    varCss && (result.color = varCss);
  }
  if (result.border !== void 0 || result.borderTop !== void 0 || result.borderRight !== void 0 || result.borderBottom !== void 0 || result.borderLeft !== void 0 || result.outline !== void 0 || typeof result.boxShadow == "string") {
    const paint = firstVisibleSolidPaint(node.strokePaints),
      varCss = paint && paintVarWithAlpha(paint, collected);
    if (varCss) {
      const literal = paint.color ? cssColor(paint.color, paint.opacity ?? 1) : void 0;
      for (const prop of ["border", "borderTop", "borderRight", "borderBottom", "borderLeft", "outline"]) typeof result[prop] == "string" && (result[prop] = String(result[prop]).replace(/\s+\S+$/, ` ${varCss}`));
      literal && typeof result.boxShadow == "string" && (result.boxShadow = result.boxShadow.split(literal).join(varCss));
    }
  }
  return Object.assign(result, consumptionMapCss(node, collected)), result;
}
function tokenizedNodeStyle(node, isRoot, options) {
  const tokens = options.tokens,
    tokenFor = tokens ? paint => paintVarWithAlpha(paint, tokens) : void 0,
    imageRefFn = options.imageRef ? hash => options.imageRef(hash, guidStr(node.guid)) : void 0;
  return applyTokenVars(computeNodeStyle(node, {
    isRoot: isRoot,
    tokenFor: tokenFor,
    imageRef: imageRefFn,
    fixed: options.layoutMode === "fixed"
  }), node, tokens);
}
function fmtObjectLiteral(obj, indent, extra) {
  const entries = Object.entries(obj).filter(([, val]) => val != null),
    inline = entries.map(([key, val]) => `${key}: ${JSON.stringify(val)}`).join(", ");
  if (!extra) {
    if (entries.length === 0) return "{}";
    if (entries.length <= 3) return `{ ${inline} }`;
  }
  const lines = entries.map(([key, val]) => `${indent}  ${key}: ${JSON.stringify(val)},`);
  return extra && lines.push(`${indent}  ${extra},`), `{
${lines.join(`
`)}
${indent}}`;
}
const MAX_TEXT_SLOTS = 4;
function synthTextEnabled(model) {
  const keys = new Set(model.ordered.map(prop => prop.key));
  for (let slotIdx = 1; slotIdx <= MAX_TEXT_SLOTS; slotIdx++) if (keys.has(`text${slotIdx}`)) return !1;
  return !0;
}
function synthTextSlots(node, model) {
  const slots = new Map();
  let nextIdx = 0;
  const propFor = (target, field) => (target.componentPropRefs ?? []).filter(ref => !ref.isDeleted && ref.componentPropNodeField === field).map(ref => model.byDefId.get(guidStr(ref.defID))).find(Boolean),
    visit = cur => {
      if (!(nextIdx >= MAX_TEXT_SLOTS || cur.internalOnly || SKIP_NODE_TYPES.has(cur.type ?? "") || !overridePropExpr("VISIBLE", propFor(cur, "VISIBLE")) && cur.visible === !1) && cur.type !== "INSTANCE") {
        if (cur.type === "TEXT") {
          if (ICON_FONT_RE.test(cur.fontName?.family ?? "")) return;
          const styleIds = cur.textData?.characterStyleIDs;
          if (styleIds && styleIds.length > 0 && styleIds.some(styleId => styleId !== styleIds[0])) return;
          const textExpr = overridePropExpr("TEXT_DATA", propFor(cur, "TEXT_DATA")),
            chars = cur.textData?.characters ?? "";
          if (!textExpr && chars.trim()) {
            slots.set(guidStr(cur.guid), nextIdx);
            const overrideKey = cur.overrideKey;
            overrideKey && slots.set(guidStr(overrideKey), nextIdx), nextIdx++;
          }
          return;
        }
        if (!VECTOR_NODE_TYPES.has(cur.type ?? "")) for (const child of cur.children ?? []) visit(child);
      }
    };
  return visit(node), slots;
}
const MAX_ICON_SLOTS = 4,
  MAX_ICON_SIZE = 72;
function synthIconEnabled(model) {
  const keys = new Set(model.ordered.map(prop => prop.key));
  for (let slotIdx = 1; slotIdx <= MAX_ICON_SLOTS; slotIdx++) if (keys.has(`icon${slotIdx}`)) return !1;
  return !0;
}
function synthIconSlots(node, model) {
  const slots = new Map();
  let nextIdx = 0;
  const propFor = (target, field) => (target.componentPropRefs ?? []).filter(ref => !ref.isDeleted && ref.componentPropNodeField === field).map(ref => model.byDefId.get(guidStr(ref.defID))).find(Boolean),
    visit = cur => {
      if (!(nextIdx >= MAX_ICON_SLOTS || cur.internalOnly || SKIP_NODE_TYPES.has(cur.type ?? "") || !overridePropExpr("VISIBLE", propFor(cur, "VISIBLE")) && cur.visible === !1)) {
        if (cur.type === "INSTANCE") {
          const swapExpr = overridePropExpr("OVERRIDDEN_SYMBOL_ID", propFor(cur, "OVERRIDDEN_SYMBOL_ID")),
            width = cur.size?.x ?? 0,
            height = cur.size?.y ?? 0;
          if (!swapExpr && width > 0 && height > 0 && width <= MAX_ICON_SIZE && height <= MAX_ICON_SIZE) {
            const slot = {
              i: nextIdx,
              w: width,
              h: height
            };
            slots.set(guidStr(cur.guid), slot);
            const overrideKey = cur.overrideKey;
            overrideKey && slots.set(guidStr(overrideKey), slot), nextIdx++;
          }
          return;
        }
        if (!(cur.type === "TEXT" || VECTOR_NODE_TYPES.has(cur.type ?? ""))) for (const child of cur.children ?? []) visit(child);
      }
    };
  return visit(node), slots;
}
const ICON_FONT_RE = /font ?awesome|material (icons|symbols)|icomoon|glyphicons?|ionicons/i;
function emitGlyphSvg(node, fig, indent, styleAttr, dataAttr, nameAttr) {
  const width = node.size?.x ?? 0,
    height = node.size?.y ?? 0;
  if (width <= 0 || height <= 0) return;
  const pathLines = glyphPaths(node, fig).map(glyph => {
    const rotate = glyph.rotation ? ` rotate(${fmtNum(glyph.rotation * (180 / Math.PI))})` : "";
    return `${indent}  <path transform="translate(${fmtNum(glyph.x)} ${fmtNum(glyph.y)}) scale(${fmtNum(glyph.fontSize)} ${fmtNum(-glyph.fontSize)})${rotate}" d=${JSON.stringify(glyph.d)} fill="currentColor" />`;
  });
  if (pathLines.length !== 0) return `${indent}<svg${nameAttr}${dataAttr} width={${fmtNum(width)}} height={${fmtNum(height)}} viewBox="0 0 ${fmtNum(width)} ${fmtNum(height)}" fill="none" ${styleAttr}>
${pathLines.join(`
`)}
${indent}</svg>`;
}
const noop = () => {},
  SKIP_NODE_TYPES = new Set(["VARIABLE", "VARIABLE_SET", "STYLE", "VARIABLE_OVERRIDE", "STICKY", "WIDGET", "SLICE"]),
  VECTOR_NODE_TYPES = new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "REGULAR_POLYGON"]),
  FONT_WEIGHT_PATTERNS = [[/thin/i, 100], [/extra ?light|ultra ?light/i, 200], [/semi ?bold|demi ?bold/i, 600], [/extra ?bold|ultra ?bold/i, 800], [/light/i, 300], [/medium/i, 500], [/bold/i, 700], [/black|heavy/i, 900]];
function styleOverrideCss(style) {
  const css = {},
    fontStyleName = style.fontName?.style ?? "";
  for (const [pattern, weight] of FONT_WEIGHT_PATTERNS) if (pattern.test(fontStyleName)) {
    css.fontWeight = weight;
    break;
  }
  /italic|oblique/i.test(fontStyleName) && (css.fontStyle = "italic");
  const paint = lastSolidPaint(style.fillPaints);
  paint?.color && (css.color = cssColor(paint.color, paint.opacity ?? 1)), style.textDecoration === "UNDERLINE" ? css.textDecoration = "underline" : style.textDecoration === "STRIKETHROUGH" && (css.textDecoration = "line-through"), style.fontSize !== void 0 && (css.fontSize = +fmtNum(style.fontSize)), style.textCase === "UPPER" ? css.textTransform = "uppercase" : style.textCase === "LOWER" ? css.textTransform = "lowercase" : style.textCase === "TITLE" && (css.textTransform = "capitalize"), (style.fontVariantCaps === "SMALL" || style.toggledOnOTFeatures?.includes("SMCP")) && (css.fontVariant = "small-caps"), style.fontVariantPosition === "SUPER" || style.toggledOnOTFeatures?.includes("SUPS") ? (css.verticalAlign = "super", css.fontSize = "0.72em") : style.fontVariantPosition === "SUB" && (css.verticalAlign = "sub", css.fontSize = "0.72em");
  const variations = (style.fontVariations ?? []).filter(variation => variation.axisName && variation.value !== void 0).map(variation => {
    const axis = variation.axisTag !== void 0 ? String.fromCharCode(variation.axisTag >> 24 & 255, variation.axisTag >> 16 & 255, variation.axisTag >> 8 & 255, variation.axisTag & 255) : "";
    return axis ? `"${axis}" ${variation.value}` : void 0;
  }).filter(Boolean);
  return variations.length && (css.fontVariationSettings = variations.join(", ")), css;
}
function richTextSegments(node) {
  const textData = node.textData,
    chars = textData?.characters ?? "",
    styleIds = textData?.characterStyleIDs,
    overrideTable = textData?.styleOverrideTable,
    hasMixedStyles = !!styleIds?.length && !!overrideTable?.length && styleIds.some(styleId => styleId !== styleIds[0]),
    lineMeta = textData?.lines ?? [],
    hasLists = lineMeta.some(line => line.lineType === "UNORDERED_LIST" || line.lineType === "ORDERED_LIST");
  if (!hasMixedStyles && !hasLists) return;
  const cssById = new Map();
  for (const override of overrideTable ?? []) cssById.set(override.styleID, styleOverrideCss(override));
  const textLines = chars.split(`
`),
    parts = [];
  let offset = 0,
    listCounter = 0;
  return textLines.forEach((lineText, lineIdx) => {
    const line = lineMeta[lineIdx];
    line?.lineType === "ORDERED_LIST" ? listCounter++ : listCounter = 0;
    const indent = "  ".repeat(Math.max(0, (line?.indentationLevel ?? 1) - 1)),
      prefix = line?.lineType === "UNORDERED_LIST" ? `${indent}• ` : line?.lineType === "ORDERED_LIST" ? `${indent}${listCounter}. ` : "";
    lineIdx > 0 && parts.push('{"\\n"}'), prefix && parts.push(`{${JSON.stringify(prefix)}}`);
    let pos = 0;
    for (; pos < lineText.length;) {
      const styleId = styleIds?.[offset + pos] ?? 0;
      let runEnd = pos + 1;
      for (; runEnd < lineText.length && (styleIds?.[offset + runEnd] ?? 0) === styleId;) runEnd++;
      const segText = lineText.slice(pos, runEnd),
        css = cssById.get(styleId);
      css && Object.keys(css).length > 0 ? parts.push(`<span style={${fmtObjectLiteral(css, "")}}>{${JSON.stringify(segText)}}</span>`) : parts.push(`{${JSON.stringify(segText)}}`), pos = runEnd;
    }
    offset += lineText.length + 1;
  }), parts.join("");
}
function dataFigAttr(node, options) {
  return options.annotateNodeIds ? ` data-fig="${guidStr(node.guid)}"` : "";
}
function escapeJsxText(text) {
  return text.replace(/[&{}<>]/g, ch => ({
    "&": "&amp;",
    "{": "&#123;",
    "}": "&#125;",
    "<": "&lt;",
    ">": "&gt;"
  })[ch]);
}
function overridePropExpr(field, prop) {
  if (prop) {
    if (field === "TEXT_DATA" && prop.kind === "text") return `props.${prop.key}`;
    if (field === "VISIBLE" && prop.kind === "bool") return `props.${prop.key}`;
    if (field === "OVERRIDDEN_SYMBOL_ID" && prop.kind === "slot") return `props.${prop.key}`;
  }
}
function stackDirection(node) {
  return node.stackMode === "HORIZONTAL" || node.stackMode === "VERTICAL" ? node.stackMode : void 0;
}
function applyStackChildLayout(style, node, stackMode, parent, parentStretched = !1) {
  if (!stackMode || node.stackPositioning === "ABSOLUTE") return;
  if (stackMode === "GRID") {
    parent && applyGridChildLayout(style, node, parent);
    return;
  }
  if (typeof style.transform == "string" && node.transform) {
    const matrix = node.transform;
    if (!(Math.abs(matrix.m01) < 1e-5 && Math.abs(matrix.m10) < 1e-5)) return;
    style.transform = `matrix(${fmtNum(matrix.m00)},${fmtNum(matrix.m10)},${fmtNum(matrix.m01)},${fmtNum(matrix.m11)},0,0)`, delete style.transformOrigin;
  }
  if (style.position = "relative", delete style.left, delete style.top, typeof style.transform == "string" && node.transform) {
    const matrix = node.transform;
    style.transform = `matrix(${fmtNum(matrix.m00)},${fmtNum(matrix.m10)},${fmtNum(matrix.m01)},${fmtNum(matrix.m11)},0,0)`, delete style.transformOrigin;
  }
  (node.stackChildPrimaryGrow ?? 0) > 0 ? (style.flexGrow = 1, stackMode === "HORIZONTAL" ? delete style.width : delete style.height) : style.flexShrink = 0, (node.stackChildAlignSelf === "STRETCH" || parent !== void 0 && stretchesCounterAxis(node, parent, parentStretched)) && (style.alignSelf = "stretch", stackMode === "HORIZONTAL" ? delete style.height : delete style.width);
  const autoResize = node.type === "TEXT" ? node.textAutoResize : void 0;
  node.type === "TEXT" && (autoResize == null || autoResize === "HEIGHT" || autoResize === "WIDTH_AND_HEIGHT") && (delete style.height, autoResize !== "HEIGHT" && delete style.width);
}
function assetMaskStyle(node, parent, ctx) {
  const width = node.size?.x ?? 0,
    height = node.size?.y ?? 0,
    offsetX = node.transform?.m02 ?? 0,
    offsetY = node.transform?.m12 ?? 0,
    parentW = parent.size?.x ?? 0,
    parentH = parent.size?.y ?? 0,
    style = {
      position: "absolute",
      left: 0,
      top: 0,
      width: parentW,
      height: parentH
    },
    imagePaint = node.fillPaints?.find(paint => paint.visible !== !1 && paint.type === "IMAGE" && paint.image?.hash);
  if (imagePaint && ctx.imageRef && ctx.assetMask) {
    const url = ctx.imageRef(imagePaint.image.hash, guidStr(node.guid));
    if (url) {
      const className = ctx.assetMask(`url(${url}) ${fmtNum(offsetX)}px ${fmtNum(offsetY)}px / ${fmtNum(width)}px ${fmtNum(height)}px no-repeat`);
      return {
        style: style,
        className: className
      };
    }
  }
  if (width <= 0 || height <= 0) return;
  if (node.type === "ELLIPSE") return style.clipPath = `ellipse(${fmtNum(width / 2)}px ${fmtNum(height / 2)}px at ${fmtNum(offsetX + width / 2)}px ${fmtNum(offsetY + height / 2)}px)`, {
    style: style
  };
  const radius = node.cornerRadius ?? 0;
  return style.clipPath = `inset(${fmtNum(offsetY)}px ${fmtNum(Math.max(0, parentW - offsetX - width))}px ${fmtNum(Math.max(0, parentH - offsetY - height))}px ${fmtNum(offsetX)}px${radius ? ` round ${fmtNum(radius)}px` : ""})`, {
    style: style
  };
}
function applyGridChildLayout(style, node, parent) {
  style.position = "relative", delete style.left, delete style.top;
  const css = gridChildCss(node, parent);
  css.gridRow && (style.gridRow = css.gridRow), css.gridColumn && (style.gridColumn = css.gridColumn), css.justifySelf && (style.justifySelf = css.justifySelf), css.alignSelf && (style.alignSelf = css.alignSelf), css.stretchW && delete style.width, css.stretchH && delete style.height;
}
function applyAutoSizing(style, node, isRoot = !1, hugWhenUnset = !0) {
  const direction = stackDirection(node);
  if (!direction || layoutChildren(node).length === 0) return;
  const primaryDim = direction === "HORIZONTAL" ? "width" : "height",
    counterDim = direction === "HORIZONTAL" ? "height" : "width",
    clearDim = dim => {
      isRoot && dim === "width" ? style.width = "fit-content" : delete style[dim];
    },
    hugs = (sizing, axis) => sizing !== void 0 ? sizing !== "FIXED" : hugWhenUnset && axisHugsContent(node, axis),
    primaryAlign = node.stackPrimaryAlignItems,
    spaced = primaryAlign === "SPACE_BETWEEN" || primaryAlign === "SPACE_EVENLY";
  hugs(node.stackPrimarySizing, "primary") && !(spaced && !node.stackPrimarySizing) && clearDim(primaryDim), hugs(node.stackCounterSizing, "counter") && clearDim(counterDim);
}
function emitSymbolNodeJsx(node, indent, isRoot, model, ctx, deps, parentStack = void 0, synth, uniformColor, parent, parentStretched = !1) {
  if (node.internalOnly || SKIP_NODE_TYPES.has(node.type ?? "")) return "";
  const propRefs = (node.componentPropRefs ?? []).filter(ref => !ref.isDeleted),
    propExprFor = field => overridePropExpr(field, propRefs.filter(ref => ref.componentPropNodeField === field).map(ref => model.byDefId.get(guidStr(ref.defID))).find(Boolean)),
    visibleExpr = propExprFor("VISIBLE");
  if (!visibleExpr && node.visible === !1) return "";
  let jsx;
  if (node.type === "INSTANCE") {
    let slotExpr = propExprFor("OVERRIDDEN_SYMBOL_ID");
    const symbolData = node.symbolData,
      symbolKey = node.overriddenSymbolID ? guidStr(node.overriddenSymbolID) : symbolData ? guidStr(symbolData.symbolID) : void 0,
      complex = symbolData !== void 0 && symbolKey !== void 0 && hasComplexOverrides(node, ctx.vectorKeysOf?.(symbolKey) ?? new Set());
    if (!slotExpr && synth && !complex) {
      const slot = synth.iconSlotByNode.get(guidStr(node.guid));
      if (slot !== void 0) {
        let slotProp = synth.iconSlots.get(slot.i);
        slotProp || (slotProp = {
          key: `icon${slot.i + 1}`,
          tsType: "React.ReactNode",
          defaultLit: "undefined",
          kind: "slot"
        }, synth.iconSlots.set(slot.i, slotProp)), slotExpr = `props.${slotProp.key}`;
      }
    }
    jsx = emitSymbolInstanceJsx(node, indent, ctx, deps, slotExpr, parentStack, isRoot, parent, parentStretched);
  } else if (node.type === "TEXT") {
    node.fontName && ctx.noteFont?.(node.fontName.family);
    const style = applyTokenVars({
      ...computeNodeStyle(node, {
        isRoot: isRoot,
        fixed: ctx.layoutMode === "fixed"
      }),
      ...textStyleProps(node)
    }, node, ctx.tokens);
    if (delete style.backgroundColor, delete style.background, applyStackChildLayout(style, node, parentStack, parent, parentStretched), isRoot && ctx.layoutMode !== "fixed") {
      const autoResize = node.textAutoResize;
      (autoResize == null || autoResize === "HEIGHT" || autoResize === "WIDTH_AND_HEIGHT") && (delete style.height, autoResize !== "HEIGHT" && delete style.width);
    }
    const chars = node.textData?.characters ?? "",
      textExpr = propExprFor("TEXT_DATA");
    if (!textExpr && ICON_FONT_RE.test(node.fontName?.family ?? "")) {
      const kept = {};
      for (const prop of ["position", "left", "top", "transform", "transformOrigin", "flexShrink", "alignSelf", "flexGrow", "opacity", "color"]) style[prop] !== void 0 && (kept[prop] = style[prop]);
      const styleLiteral = isRoot ? fmtObjectLiteral(kept, indent, "...props.style") : fmtObjectLiteral(kept, indent),
        classAttr = isRoot ? " className={props.className}" : "",
        svg = emitGlyphSvg(node, ctx.fig, indent, `style={${styleLiteral}}`, dataFigAttr(node, ctx), classAttr);
      if (svg !== void 0) return jsx = svg, visibleExpr ? isRoot ? `${indent}${visibleExpr} ? (
${jsx}
${indent}) : null` : `${indent}{${visibleExpr} && (
${jsx}
${indent})}` : jsx;
    }
    let content;
    const segments = textExpr ? void 0 : richTextSegments(node);
    if (textExpr) content = `{${textExpr}}`;else if (segments !== void 0) content = segments, style.whiteSpace = "pre-wrap", style.width !== void 0 && style.display === void 0 && (style.display = "inline-block");else {
      const slotIdx = synth?.slotByNode.get(guidStr(node.guid));
      if (slotIdx !== void 0) {
        let slot = synth.slots.get(slotIdx);
        slot || (slot = {
          key: `text${slotIdx + 1}`,
          tsType: "string",
          defaultLit: JSON.stringify(chars),
          kind: "text"
        }, synth.slots.set(slotIdx, slot)), content = `{props.${slot.key} ?? ${JSON.stringify(chars)}}`;
        const collapsible = node.textAutoResize == null || node.textAutoResize === "WIDTH_AND_HEIGHT" || chars.length <= 30;
        parentStack && !chars.includes(`
`) && collapsible && ctx.layoutMode !== "fixed" && (delete style.width, delete style.height, style.whiteSpace = "nowrap");
      } else content = chars.includes(`
`) ? `{${JSON.stringify(chars)}}` : escapeJsxText(chars);
    }
    borderFromShadow(style), chars.includes(`
`) && (style.whiteSpace = "pre-wrap");
    const styleText = isRoot ? fmtObjectLiteral(style, indent, "...props.style") : fmtObjectLiteral(style, indent);
    jsx = `${indent}<span${isRoot ? " className={props.className}" : ""}${dataFigAttr(node, ctx)} style={${styleText}}>${content}</span>`;
  } else if (VECTOR_NODE_TYPES.has(node.type ?? "") || node.type === "FRAME" && !node.children?.length && ((node.fillGeometry?.length ?? 0) > 0 || (node.strokeGeometry?.length ?? 0) > 0)) jsx = emitSymbolVectorJsx(node, indent, isRoot, ctx, parentStack, uniformColor, parent, parentStretched);else {
    const style = tokenizedNodeStyle(node, isRoot, ctx);
    let assetClass;
    ctx.assetBackground && typeof style.background == "string" && style.background.includes("url(./assets/") && (assetClass = ctx.assetBackground(style.background), delete style.background), isRoot && (delete style.position, delete style.left, delete style.top, style.position = "relative", uniformColor !== void 0 && (style.color = uniformColor)), ctx.layoutMode !== "fixed" && (applyStackChildLayout(style, node, parentStack, parent, parentStretched), applyAutoSizing(style, node, isRoot, ctx.hugWhenUnset ?? !0));
    const stack = ctx.layoutMode === "fixed" ? void 0 : node.stackMode === "GRID" ? "GRID" : stackDirection(node),
      children = (node.children ?? []).filter(child => !SKIP_NODE_TYPES.has(child.type ?? "")),
      stretched = isRoot || parent !== void 0 && stretchesCounterAxis(node, parent, parentStretched) && sameStackMode(parent, node),
      emitChild = (child, childIndent) => emitSymbolNodeJsx(child, childIndent, !1, model, ctx, deps, stack, synth, uniformColor, node, stretched),
      parts = [];
    for (let childIdx = 0; childIdx < children.length;) {
      const child = children[childIdx];
      if (child.mask && child.visible !== !1 && !stack) {
        const maskedParts = [];
        for (childIdx++; childIdx < children.length && !children[childIdx].mask;) {
          const maskedJsx = emitChild(children[childIdx], indent + "    ");
          maskedJsx && maskedParts.push(maskedJsx), childIdx++;
        }
        if (maskedParts.length === 0) continue;
        const maskStyle = assetMaskStyle(child, node, ctx);
        if (!maskStyle) {
          (ctx.warn ?? noop)(guidStr(child.guid), "skipped-node", `mask "${(child.name ?? "").slice(0, 40)}" has no usable image/shape; siblings emitted unmasked`), parts.push(...maskedParts);
          continue;
        }
        const maskClassAttr = maskStyle.className ? ` className=${JSON.stringify(maskStyle.className)}` : "";
        parts.push(`${indent}  <div${maskClassAttr} style={${fmtObjectLiteral(maskStyle.style, indent + "  ")}}>
${maskedParts.join(`
`)}
${indent}  </div>`);
        continue;
      }
      const childJsx = emitChild(child, indent + "  ");
      childJsx && parts.push(childJsx), childIdx++;
    }
    const styleText = isRoot ? fmtObjectLiteral(style, indent, "...props.style") : fmtObjectLiteral(style, indent),
      classAttr = isRoot ? assetClass ? ` className={${JSON.stringify(assetClass + " ")} + (props.className || '')}` : " className={props.className}" : assetClass ? ` className=${JSON.stringify(assetClass)}` : "";
    jsx = parts.length ? `${indent}<div${classAttr}${dataFigAttr(node, ctx)} style={${styleText}}>
${parts.join(`
`)}
${indent}</div>` : `${indent}<div${classAttr}${dataFigAttr(node, ctx)} style={${styleText}} />`;
  }
  return visibleExpr ? isRoot ? `${indent}${visibleExpr} ? (
${jsx}
${indent}) : null` : `${indent}{${visibleExpr} && (
${jsx}
${indent})}` : jsx;
}
function variantAttrsOf(model, guidKey) {
  return model.variantAttrs.get(guidKey) ?? [];
}
function variantKeyString(model, valueByKey) {
  return model.variantKeys.map(key => {
    let value = valueByKey?.get(key);
    if (value === void 0) {
      const prop = model.ordered.find(entry => entry.key === key);
      value = prop && prop.defaultLit !== "undefined" ? JSON.parse(prop.defaultLit) : "";
    }
    return `${key}=${escapeVariantToken(value)}`;
  }).join("|");
}
function closestVariantKey(key, candidates) {
  const parts = key.split("|");
  let best,
    bestScore = -1;
  for (const candidate of candidates) {
    const candParts = candidate.split("|");
    let score = 0;
    for (let partIdx = 0; partIdx < parts.length; partIdx++) candParts[partIdx] === parts[partIdx] && score++;
    score > bestScore && (bestScore = score, best = candidate);
  }
  return best;
}
const EMPTY_PROP_MODEL = {
  byDefId: new Map()
};
function emitSymbolInstanceJsx(node, indent, ctx, deps, slotExpr, parentStack = void 0, isRoot = !1, parent, parentStretched = !1) {
  const symbolData = node.symbolData,
    symbolKey = node.overriddenSymbolID ? guidStr(node.overriddenSymbolID) : symbolData ? guidStr(symbolData.symbolID) : void 0,
    name = symbolKey ? ctx.nameOf(symbolKey) : void 0,
    symbolNode = symbolKey ? ctx.fig.nodes.get(symbolKey) : void 0;
  if (!slotExpr && symbolNode && symbolData) {
    const vectorKeySet = (symbolKey ? ctx.vectorKeysOf?.(symbolKey) : void 0) ?? new Set();
    if (hasComplexOverrides(node, vectorKeySet)) {
      const resolved = resolveInstance(node, [], ctx.fig, 0);
      if (resolved) return (ctx.warn ?? noop)(guidStr(node.guid), "baked-instance", `call site of "${symbolNode.name ?? symbolKey}" baked inline: its overrides pass through nested instances`), emitSymbolNodeJsx(resolved, indent, isRoot, EMPTY_PROP_MODEL, ctx, deps, parentStack, void 0, void 0, parent, parentStretched);
    }
  }
  const fullStyle = computeNodeStyle(node, {
      isRoot: !1
    }),
    style = {},
    posKeys = ["position", "left", "top", "width", "height", "transform", "transformOrigin"];
  for (const key of posKeys) fullStyle[key] != null && (style[key] = fullStyle[key]);
  if (isRoot) {
    if (delete style.left, delete style.top, typeof style.transform == "string" && node.transform) {
      const transform = node.transform;
      style.transform = `matrix(${fmtNum(transform.m00)},${fmtNum(transform.m10)},${fmtNum(transform.m01)},${fmtNum(transform.m11)},0,0)`, delete style.transformOrigin;
    }
    style.position = "relative";
  }
  if (symbolNode && ctx.layoutMode !== "fixed") {
    const width = style.width,
      height = style.height,
      widthDiffers = typeof width == "number" && (symbolNode.size?.x ?? width) > 0 && Math.abs(width - (symbolNode.size?.x ?? width)) > FILL_TOLERANCE,
      heightDiffers = typeof height == "number" && (symbolNode.size?.y ?? height) > 0 && Math.abs(height - (symbolNode.size?.y ?? height)) > FILL_TOLERANCE;
    applyAutoSizing(style, symbolNode, isRoot, ctx.hugWhenUnset ?? !0), widthDiffers && style.width !== width && (style.width = width), heightDiffers && style.height !== height && (style.height = height);
  }
  ctx.layoutMode !== "fixed" && applyStackChildLayout(style, node, parentStack, parent, parentStretched), style.flexGrow != null && (style[parentStack === "VERTICAL" ? "height" : "width"] = "auto"), style.alignSelf === "stretch" && (style[parentStack === "VERTICAL" ? "width" : "height"] = "auto");
  const vectorKeys = symbolKey ? ctx.vectorKeysOf?.(symbolKey) : void 0;
  if (vectorKeys && vectorKeys.size > 0) for (const override of symbolData?.symbolOverrides ?? []) {
    const guids = override.guidPath?.guids;
    if (guids?.length !== 1 || !vectorKeys.has(guidStr(guids[0]))) continue;
    const paint = override.fillPaints?.find(fill => fill.visible !== !1 && fill.type === "SOLID" && fill.color);
    if (!paint) continue;
    const color = (ctx.tokens ? paintVarWithAlpha(paint, ctx.tokens) : void 0) ?? cssColor({
      ...paint.color,
      a: (paint.color.a ?? 1) * (paint.opacity ?? 1)
    });
    style.color = color;
    break;
  }
  let scale;
  if (name !== void 0 && symbolNode !== void 0 && stackDirection(symbolNode) === void 0 && typeof style.width == "number" && typeof style.height == "number" && (symbolNode.size?.x ?? 0) > 0 && (symbolNode.size?.y ?? 0) > 0) {
    const scaleX = style.width / symbolNode.size.x,
      scaleY = style.height / symbolNode.size.y;
    (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) && (scale = {
      sx: scaleX,
      sy: scaleY
    });
  }
  const styleAttr = isRoot ? `style={${fmtObjectLiteral(style, indent + "  ", "...props.style")}}` : `style={${fmtObjectLiteral(style, indent + "  ")}}`,
    attrs = isRoot ? ["className={props.className}", styleAttr] : [styleAttr],
    pushedKeys = new Set(),
    pushAttr = (key, expr) => pushedKeys.has(key) ? !1 : (pushedKeys.add(key), attrs.push(`${key}={${expr}}`), !0),
    propModel = symbolKey ? ctx.propModelOf?.(symbolKey) : void 0,
    variantKeySet = new Set(propModel?.variantKeys ?? []),
    variantValues = new Map(),
    recordVariant = (key, value) => {
      variantKeySet.has(key) && variantValues.set(key, value);
    },
    normalizeValue = (prop, value) => {
      if (prop.kind !== "variant") return value;
      const normalizeFn = propModel?.variantNormalize.get(prop.key);
      return normalizeFn ? normalizeFn(String(value)) : value;
    };
  for (const assignment of node.componentPropAssignments ?? []) {
    const prop = propModel?.byDefId.get(guidStr(assignment.defID));
    if (!prop) continue;
    const value = assignment.value;
    if (value?.textValue?.characters != null) {
      const normalized = normalizeValue(prop, value.textValue.characters),
        literal = typeof normalized == "boolean" ? `${normalized}` : JSON.stringify(normalized);
      pushAttr(prop.key, literal) && recordVariant(prop.key, normalized);
    } else if (value?.boolValue != null) {
      const boolVal = value.boolValue === !0,
        normalized = normalizeValue(prop, boolVal),
        literal = typeof normalized == "boolean" ? `${normalized}` : JSON.stringify(normalized);
      pushAttr(prop.key, literal) && recordVariant(prop.key, normalized);
    } else if (value?.floatValue != null) {
      const num = Number(value.floatValue);
      if (Number.isFinite(num)) {
        const normalized = normalizeValue(prop, String(num)),
          literal = typeof normalized == "boolean" ? `${normalized}` : prop.kind === "variant" ? JSON.stringify(normalized) : String(num);
        pushAttr(prop.key, literal) && recordVariant(prop.key, normalized);
      }
    } else if (value?.guidValue != null && prop.kind === "slot") {
      const swapKey = guidStr(value.guidValue),
        swapName = ctx.nameOf(swapKey);
      if (swapName) {
        deps.add(swapName);
        const swapModel = ctx.propModelOf?.(swapKey),
          attrText = swapModel ? variantAttrsOf(swapModel, swapKey).map(([attrKey, attrVal]) => ` ${attrKey}={${JSON.stringify(attrVal)}}`).join("") : "";
        pushAttr(prop.key, `<${swapName}${attrText} />`);
      }
    }
  }
  const textSlots = symbolKey ? ctx.textSlotsOf?.(symbolKey) : void 0;
  if (textSlots && textSlots.size > 0) for (const override of symbolData?.symbolOverrides ?? []) {
    const guids = override.guidPath?.guids;
    if (guids?.length !== 1) continue;
    const chars = override.textData?.characters;
    if (typeof chars != "string") continue;
    const slotIdx = textSlots.get(guidStr(guids[0]));
    slotIdx !== void 0 && pushAttr(`text${slotIdx + 1}`, JSON.stringify(chars));
  }
  const iconSlots = symbolKey ? ctx.iconSlotsOf?.(symbolKey) : void 0;
  if (iconSlots && iconSlots.size > 0) for (const override of symbolData?.symbolOverrides ?? []) {
    const guids = override.guidPath?.guids;
    if (guids?.length !== 1) continue;
    const swapId = override.overriddenSymbolID;
    if (!swapId) continue;
    const slot = iconSlots.get(guidStr(guids[0]));
    if (slot === void 0) continue;
    const swapKey = guidStr(swapId),
      swapName = ctx.nameOf(swapKey);
    if (!swapName) continue;
    deps.add(swapName);
    const swapModel = ctx.propModelOf?.(swapKey),
      attrText = swapModel ? variantAttrsOf(swapModel, swapKey).map(([attrKey, attrVal]) => ` ${attrKey}={${JSON.stringify(attrVal)}}`).join("") : "",
      swapNode = ctx.fig.nodes.get(swapKey),
      swapW = swapNode?.size?.x ?? 0,
      swapH = swapNode?.size?.y ?? 0;
    let iconStyle = '{ width: "100%", height: "100%" }';
    if (swapNode && swapW > 0 && swapH > 0) {
      const scaleX = slot.w / swapW,
        scaleY = slot.h / swapH,
        scaled = Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01;
      scaled && stackDirection(swapNode) === void 0 ? iconStyle = `{ transform: "scale(${fmtNum(scaleX)}, ${fmtNum(scaleY)})", transformOrigin: "0 0" }` : scaled && (iconStyle = `{ width: ${fmtNum(slot.w)}, height: ${fmtNum(slot.h)} }`);
    }
    pushAttr(`icon${slot.i + 1}`, `<${swapName}${attrText} style={${iconStyle}} />`);
  }
  if (propModel && symbolKey) for (const [key, value] of variantAttrsOf(propModel, symbolKey)) pushAttr(key, JSON.stringify(value)) && recordVariant(key, value);
  if (name && propModel && propModel.variantKeys.length > 0 && propModel.variantMap.size > 0) {
    const variantKey = variantKeyString(propModel, variantValues);
    if (!(() => {
      if (propModel.variantMap.size <= MAX_VARIANT_COMBOS) return propModel.variantMap;
      const sampled = new Set();
      let count = 0;
      for (const candKey of propModel.variantMap.keys()) {
        if (count++ >= MAX_VARIANT_SAMPLES) break;
        sampled.add(candKey);
      }
      return sampled;
    })().has(variantKey)) {
      const nearest = closestVariantKey(variantKey, propModel.variantMap.keys()),
        detail = propModel.variantMap.size > MAX_VARIANT_COMBOS ? "no variant deltas will apply (template renders unchanged)" : "the default body will render";
      (ctx.warn ?? noop)(guidStr(node.guid), "variant-key-mismatch", `instance "${(node.name ?? "").slice(0, 60)}" of ${name} produces variant key "${variantKey}" with no matching variant${nearest ? `; nearest existing key is "${nearest}"` : ""} — ${detail}`);
    }
  }
  const classText = isRoot ? "className={props.className} " : "";
  if (slotExpr) {
    if (name && deps.add(name), !name && symbolKey) {
      const defNode = ctx.fig.nodes.get(symbolKey);
      (ctx.warn ?? noop)(guidStr(node.guid), "external-instance", `slot default "${defNode?.name ?? symbolKey}" is outside the file/selection; the slot renders empty unless the consumer passes content`);
    }
    const slotAttrs = attrs.filter(attr => !attr.startsWith("style={") && !attr.startsWith("className={"));
    scale !== void 0 && slotAttrs.push(`style={{ transform: "scale(${fmtNum(scale.sx)}, ${fmtNum(scale.sy)})", transformOrigin: "0 0" }}`);
    const fallback = name ? ` ?? <${name}${slotAttrs.length ? ` ${slotAttrs.join(" ")}` : ""} />` : "";
    return `${indent}<div ${classText}${styleAttr}>{${slotExpr}${fallback}}</div>`;
  }
  if (!name) {
    const stubName = (symbolKey ? ctx.fig.nodes.get(symbolKey) : void 0)?.name ?? symbolKey ?? "?";
    return (ctx.warn ?? noop)(guidStr(node.guid), "external-instance", `instance of "${stubName}" stubbed (not in file/selection)`), `${indent}<div ${classText}${styleAttr} data-external={${JSON.stringify(stubName)}} />`;
  }
  if (deps.add(name), scale !== void 0) {
    const scaleStyle = {
      transform: `scale(${fmtNum(scale.sx)}, ${fmtNum(scale.sy)})`,
      transformOrigin: "0 0"
    };
    style.color != null && (scaleStyle.color = style.color);
    const attrLines = [`style={${fmtObjectLiteral(scaleStyle, indent + "    ")}}`, ...attrs.filter(attr => attr !== styleAttr && !attr.startsWith("className={"))],
      element = attrLines.length <= 1 ? `${indent}  <${name} ${attrLines.join(" ")} />` : `${indent}  <${name}
${attrLines.map(attr => `${indent}    ${attr}`).join(`
`)}
${indent}  />`;
    return `${indent}<div ${classText}${styleAttr}>
${element}
${indent}</div>`;
  }
  return attrs.length <= 1 ? `${indent}<${name} ${attrs.join(" ")} />` : `${indent}<${name}
${attrs.map(attr => `${indent}  ${attr}`).join(`
`)}
${indent}/>`;
}
function collectSvgPaths(node, fig) {
  const fillPaint = lastSolidPaint(node.fillPaints),
    fill = fillPaint?.color ? cssColor(fillPaint.color, fillPaint.opacity ?? 1) : void 0,
    strokePaint = lastSolidPaint(node.strokePaints),
    stroke = strokePaint?.color ? cssColor(strokePaint.color, strokePaint.opacity ?? 1) : void 0,
    ownPaths = [...geometryPaths(node.fillGeometry, fig).map(path => ({
      ...path,
      fill: fill
    })), ...geometryPaths(node.strokeGeometry, fig).map(path => ({
      ...path,
      fill: stroke
    }))];
  if (ownPaths.length) return ownPaths;
  const networkPaths = vectorNetworkPaths(node, fig);
  if (networkPaths.length) return networkPaths;
  const paths = [],
    transformOf = cur => {
      const matrix = cur.transform;
      if (!(!matrix || Math.abs(matrix.m00 - 1) < 1e-5 && Math.abs(matrix.m11 - 1) < 1e-5 && Math.abs(matrix.m01) < 1e-5 && Math.abs(matrix.m10) < 1e-5 && Math.abs(matrix.m02) < 1e-5 && Math.abs(matrix.m12) < 1e-5)) return `matrix(${fmtNum(matrix.m00)} ${fmtNum(matrix.m10)} ${fmtNum(matrix.m01)} ${fmtNum(matrix.m11)} ${fmtNum(matrix.m02)} ${fmtNum(matrix.m12)})`;
    },
    visit = (cur, parentTransform) => {
      for (const child of cur.children ?? []) {
        if (child.visible === !1) continue;
        const transform = [parentTransform, transformOf(child)].filter(Boolean).join(" ") || void 0,
          childFillPaint = lastSolidPaint(child.fillPaints),
          childFill = childFillPaint?.color ? cssColor(childFillPaint.color, childFillPaint.opacity ?? 1) : void 0,
          childStrokePaint = lastSolidPaint(child.strokePaints),
          childStroke = childStrokePaint?.color ? cssColor(childStrokePaint.color, childStrokePaint.opacity ?? 1) : void 0;
        for (const geom of geometryPaths(child.fillGeometry, fig)) paths.push({
          ...geom,
          transform: transform,
          fill: childFill
        });
        for (const geom of geometryPaths(child.strokeGeometry, fig)) paths.push({
          ...geom,
          transform: transform,
          fill: childStroke
        });
        visit(child, transform);
      }
    };
  return visit(node, void 0), paths;
}
const BORDER_SHORTHAND_RE = /^[\d.]+(?:px|em|rem|%)?\s+(?:solid|dashed|dotted|double|groove|ridge|inset|outset|none)\s+(.+)$/;
function firstTopLevelArg(text) {
  let depth = 0;
  for (let idx = 0; idx < text.length; idx++) {
    const ch = text[idx];
    if (ch === "(") depth++;else if (ch === ")") depth--;else if (ch === "," && depth === 0) return text.slice(0, idx);
  }
  return text;
}
const RING_SHADOW_RE = /^(?:inset\s+)?0 0 0 [\d.]+px\s+(.+)$/;
function borderFromShadow(style) {
  if (typeof style.boxShadow != "string") return;
  const filters = [];
  let rest = style.boxShadow;
  for (; rest.length > 0;) {
    const shadow = firstTopLevelArg(rest).trim();
    if (rest = rest.slice(Math.min(rest.length, firstTopLevelArg(rest).length + 1)).trimStart(), shadow.startsWith("inset")) continue;
    const match = /^(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px ([\d.]+)px\s+(.+)$/.exec(shadow);
    if (!match) continue;
    const radius = Number(match[3]) + Number(match[4]);
    filters.push(`drop-shadow(${match[1]}px ${match[2]}px ${fmtNum(radius)}px ${match[5]})`);
  }
  delete style.boxShadow, filters.length && (style.filter = style.filter ? `${style.filter} ${filters.join(" ")}` : filters.join(" "));
}
function dominantStyleColor(style) {
  const borderColor = typeof style.border == "string" ? BORDER_SHORTHAND_RE.exec(style.border)?.[1]?.trim() : void 0,
    ringColor = typeof style.boxShadow == "string" ? RING_SHADOW_RE.exec(firstTopLevelArg(style.boxShadow).trim())?.[1]?.trim() : void 0,
    bgColor = typeof style.background == "string" && !style.background.includes("gradient(") && !style.background.includes("url(") ? style.background : void 0,
    color = style.backgroundColor ?? bgColor ?? style.color ?? borderColor ?? ringColor;
  return typeof color == "string" ? color : void 0;
}
function nodeDominantColor(node, ctx) {
  return dominantStyleColor(tokenizedNodeStyle(node, !1, {
    tokens: ctx.tokens
  }));
}
function uniformVectorColor(node, model, ctx) {
  const colors = new Set();
  let mixed = !1;
  const propFor = (target, field) => (target.componentPropRefs ?? []).filter(ref => !ref.isDeleted && ref.componentPropNodeField === field).map(ref => model.byDefId.get(guidStr(ref.defID))).find(Boolean),
    visit = cur => {
      if (!(mixed || cur.internalOnly || SKIP_NODE_TYPES.has(cur.type ?? "") || !overridePropExpr("VISIBLE", propFor(cur, "VISIBLE")) && cur.visible === !1) && cur.type !== "INSTANCE") {
        if (VECTOR_NODE_TYPES.has(cur.type ?? "")) {
          const color = nodeDominantColor(cur, ctx);
          if (color === void 0) {
            mixed = !0;
            return;
          }
          colors.add(color);
          return;
        }
        for (const child of cur.children ?? []) visit(child);
      }
    };
  if (visit(node), !(mixed || colors.size !== 1)) return [...colors][0];
}
function emitSymbolVectorJsx(node, indent, isRoot, ctx, parentStack = void 0, uniformColor, parent, parentStretched = !1) {
  const paths = collectSvgPaths(node, ctx.fig),
    style = tokenizedNodeStyle(node, isRoot, {
      tokens: ctx.tokens
    });
  isRoot && (delete style.position, delete style.left, delete style.top, style.position = "relative"), applyStackChildLayout(style, node, parentStack, parent, parentStretched);
  const classAttr = isRoot ? " className={props.className}" : "";
  if (paths.length === 0) {
    (ctx.warn ?? noop)(guidStr(node.guid), "vector-dropped", `${node.type} "${truncateLine(node.name, 60)}" has no decodable geometry; emitted as a plain box`), delete style.backgroundColor, delete style.background, delete style.mixBlendMode, delete style.filter, delete style.backdropFilter, delete style.boxShadow, delete style.borderRadius, delete style.transform, delete style.transformOrigin, style.border = "1px dashed currentColor", style.display = "flex", style.alignItems = "center", style.justifyContent = "center", style.overflow = "hidden", style.fontSize = 10, typeof style.opacity == "number" ? style.opacity = Math.max(0.3, Math.min(style.opacity, 0.45)) : style.opacity == null && (style.opacity = 0.45);
    const fallbackSize = node.strokeWeight || 1;
    style.width || (style.width = fallbackSize), style.height || (style.height = fallbackSize);
    const label = node.name || node.type || "vector",
      labelText = escapeJsxText([...label].slice(0, 40).join("")),
      styleLiteral = isRoot ? fmtObjectLiteral(style, indent, "...props.style") : fmtObjectLiteral(style, indent);
    return `${indent}<div${classAttr}${dataFigAttr(node, ctx)} style={${styleLiteral}}>${labelText}</div>`;
  }
  const color = dominantStyleColor(style);
  if (delete style.backgroundColor, delete style.background, delete style.border, delete style.outline, delete style.outlineOffset, typeof style.boxShadow == "string") {
    const kept = [];
    let rest = style.boxShadow;
    for (; rest.length > 0;) {
      const shadow = firstTopLevelArg(rest).trim();
      RING_SHADOW_RE.test(shadow) || kept.push(shadow), rest = rest.slice(Math.min(rest.length, firstTopLevelArg(rest).length + 1)).trimStart();
    }
    kept.length ? style.boxShadow = kept.join(", ") : delete style.boxShadow;
  }
  borderFromShadow(style), color != null && !(!isRoot && color === uniformColor) && (style.color = color);
  const strokeWeight = node.strokeWeight ?? 1,
    noWidth = !node.size?.x,
    noHeight = !node.size?.y,
    width = node.size?.x || strokeWeight,
    height = node.size?.y || strokeWeight,
    widthStr = fmtNum(width),
    heightStr = fmtNum(height);
  style.width === 0 && (style.width = width), style.height === 0 && (style.height = height);
  const viewBox = `${noWidth ? fmtNum(-width / 2) : 0} ${noHeight ? fmtNum(-height / 2) : 0} ${widthStr} ${heightStr}`,
    sizeAttrs = (style.width != null ? ` width={${widthStr}}` : "") + (style.height != null ? ` height={${heightStr}}` : ""),
    styleLiteral = isRoot ? fmtObjectLiteral(style, indent, "...props.style") : fmtObjectLiteral(style, indent),
    multiColor = new Set(paths.map(path => path.fill).filter(fill => fill !== void 0)).size > 1,
    pathLines = paths.map(path => `${indent}  <path d={${JSON.stringify(path.d)}} fill=${multiColor && path.fill ? JSON.stringify(path.fill) : '"currentColor"'} fillRule="${path.rule}"${path.transform ? ` transform=${JSON.stringify(path.transform)}` : ""} />`).join(`
`);
  return `${indent}<svg${classAttr}${dataFigAttr(node, ctx)}${sizeAttrs} viewBox="${viewBox}" fill="none" style={${styleLiteral}}>
${pathLines}
${indent}</svg>`;
}
function defaultVariantGuid(node, _unused) {
  const model = buildPropModel(node),
    variant = defaultVariantNode(node, model);
  return guidStr((variant ?? node).guid);
}
function defaultVariantNode(node, model) {
  if (!node.isStateGroup) return node;
  const defaultKey = variantKeyString(model),
    guid = model.variantMap.get(defaultKey),
    symbols = (node.children ?? []).filter(child => child.type === "SYMBOL");
  return (guid ? symbols.find(child => guidStr(child.guid) === guid) : void 0) ?? symbols[0];
}
function variantStyleDelta(baseNode, variantNode, options) {
  const baseStyle = tokenizedNodeStyle(baseNode, !0, options),
    variantStyle = tokenizedNodeStyle(variantNode, !0, options);
  applyAutoSizing(baseStyle, baseNode, !0, options.hugWhenUnset ?? !0), applyAutoSizing(variantStyle, variantNode, !0, options.hugWhenUnset ?? !0);
  const delta = {};
  for (const prop of new Set([...Object.keys(baseStyle), ...Object.keys(variantStyle)])) prop === "position" || prop === "left" || prop === "top" || baseStyle[prop] !== variantStyle[prop] && (delta[prop] = variantStyle[prop] ?? "revert");
  return delta;
}
function emitRunnable(node, name, ctx) {
  const bundle = ctx.moduleFormat === "bundle",
    model = buildPropModel(node, ctx.fig, ctx.warn),
    deps = new Set(),
    defNode = node.isStateGroup ? defaultVariantNode(node, model) : node;
  if (!defNode) return {
    name: name,
    deps: deps,
    files: [{
      path: `${name}.jsx`,
      content: `${bundle ? "" : "export "}const ${name} = () => null;
`
    }]
  };
  const synth = ctx.synthTextProps && synthTextEnabled(model) ? {
      slotByNode: new Map(),
      slots: new Map(),
      iconSlotByNode: new Map(),
      iconSlots: new Map()
    } : void 0,
    emitBody = root => {
      synth && (synth.slotByNode = synthTextSlots(root, model), synth.iconSlotByNode = synthIconEnabled(model) ? synthIconSlots(root, model) : new Map());
      const uniformColor = uniformVectorColor(root, model, ctx);
      return emitSymbolNodeJsx(root, "    ", !0, model, ctx, deps, void 0, synth, uniformColor) || "    null";
    },
    fullVariants = node.isStateGroup && model.variantKeys.length > 0 && model.variantMap.size <= MAX_VARIANT_COMBOS,
    vkeyName = bundle ? `__vkey_${name}` : "__vkey",
    variantsName = bundle ? `__variants_${name}` : "__variants",
    vencName = bundle ? `__venc_${name}` : "__venc",
    vencDecl = `const ${vencName} = (v) => String(v).replace(/[%|=]/g, encodeURIComponent);
`,
    keyExpr = model.variantKeys.map(key => `${JSON.stringify(key + "=")} + ${vencName}(p.${key})`).join(" + '|' + ");
  let prelude = "",
    body;
  if (fullVariants) {
    const bodyByJsx = new Map(),
      bodyDecls = [],
      implLines = [];
    let defaultImpl;
    const bodyFor = variant => {
      const jsx = emitBody(variant);
      let bodyName = bodyByJsx.get(jsx);
      return bodyName || (bodyName = `__body${bodyByJsx.size}`, bodyByJsx.set(jsx, bodyName), bodyDecls.push(`  const ${bodyName} = () => (
${jsx}
  );`)), bodyName;
    };
    for (const [key, guid] of model.variantMap) {
      const variantNode = (node.children ?? []).find(child => guidStr(child.guid) === guid);
      if (!variantNode) continue;
      const bodyName = bodyFor(variantNode),
        label = truncateLine(variantNode.name);
      label && implLines.push(`    // figma: ${label}`), implLines.push(`    ${JSON.stringify(key)}: ${bodyName},`), variantNode === defNode && (defaultImpl = bodyName);
    }
    defaultImpl ??= bodyFor(defNode), prelude = vencDecl + `const ${vkeyName} = (p) => ${keyExpr};

`, body = bodyDecls.join(`
`) + `
  const __impls = {
${implLines.join(`
`)}
  };
  return (__impls[${vkeyName}(props)] ?? ${defaultImpl})();
`;
  } else {
    const rootJsx = emitBody(defNode);
    if (node.isStateGroup && model.variantKeys.length) {
      const deltaLines = [],
        skipped = [],
        defGuid = guidStr(defNode.guid);
      let count = 0;
      for (const [key, guid] of model.variantMap) {
        if (count >= MAX_VARIANT_SAMPLES) {
          guid !== defGuid && skipped.push(key);
          continue;
        }
        const variantNode = (node.children ?? []).find(child => guidStr(child.guid) === guid);
        if (!variantNode || variantNode === defNode) continue;
        count++;
        const delta = variantStyleDelta(defNode, variantNode, {
          tokens: ctx.tokens,
          hugWhenUnset: ctx.hugWhenUnset
        });
        Object.keys(delta).length !== 0 && deltaLines.push(`  ${JSON.stringify(key)}: ${fmtObjectLiteral(delta, "  ")},`);
      }
      if (skipped.length > 0) {
        const preview = skipped.slice(0, 10).map(key => truncateLine(key)).join(", ");
        (ctx.warn ?? noop)(guidStr(node.guid), "variant-cap", `${skipped.length} of ${model.variantMap.size} variants beyond the ${MAX_VARIANT_SAMPLES}-entry cap: ${preview}${skipped.length > 10 ? ", …" : ""}`);
      }
      count > 0 && (ctx.warn ?? noop)(guidStr(node.guid), "variant-root-only", `set exceeds the ${MAX_VARIANT_COMBOS}-variant body cap; deltas capture root-level styles only, nested-child differences not diffed`);
      const quoteKey = key => JSON.stringify(truncateLine(key)),
        skipComment = skipped.length > 0 ? `
  // …+${skipped.length} more variants not captured: ${skipped.slice(0, 10).map(quoteKey).join(", ")}${skipped.length > 10 ? ", …" : ""}` : "";
      prelude = `const ${variantsName} = {
${deltaLines.join(`
`)}${skipComment}
};
` + vencDecl + `const ${vkeyName} = (p) => ${keyExpr};

`;
    }
    const vsLine = prelude ? `  const __vs = ${variantsName}[${vkeyName}(props)] ?? {};
` : "",
      patchedJsx = prelude ? rootJsx.replace("...props.style", "...__vs, ...props.style") : rootJsx;
    body = vsLine + `  return (
${patchedJsx}
  );
`;
  }
  const imports = bundle ? [] : [...deps].sort().map(depName => `import { ${depName} } from './${depName}.jsx';`),
    propTypes = model.ordered.map(prop => `  ${prop.key}?: ${prop.tsType};`),
    slotTypes = synth ? [...[...synth.slots.entries()].sort((entryA, entryB) => entryA[0] - entryB[0]).map(([, slot]) => `  /** Text content; defaults to ${escapeCommentText(slot.defaultLit)}. */
  ${slot.key}?: string;`), ...[...synth.iconSlots.entries()].sort((entryA, entryB) => entryA[0] - entryB[0]).map(([, slot]) => `  /** Swappable nested instance; defaults to the design's. */
  ${slot.key}?: React.ReactNode;`)] : [],
    propsDts = `export interface ${name}Props {
  className?: string;
  style?: React.CSSProperties;
` + (propTypes.length ? propTypes.join(`
`) + `
` : "") + (slotTypes.length ? slotTypes.join(`
`) + `
` : "") + `}
`,
    defaults = model.ordered.filter(prop => prop.defaultLit !== "undefined").map(prop => `${prop.key}: _p.${prop.key} ?? ${prop.defaultLit}`).join(", "),
    propsInit = defaults ? `  const props = { ..._p, ${defaults} };
` : `  const props = _p;
`,
    label = truncateLine(node.name),
    jsxContent = (imports.length ? imports.join(`
`) + `

` : "") + `// figma node: ${guidStr(node.guid)} ${label}${node.isStateGroup ? ` (${model.variantMap.size} variants)` : ""}
` + prelude + `${bundle ? "" : "export "}function ${name}(_p = {}) {
` + propsInit + body + `}
` + (bundle ? "" : `export default ${name};
`);
  if (bundle) {
    const dtsFragment = `// figma layer: ${JSON.stringify(label)} (node ${guidStr(node.guid)})
` + propsDts;
    return {
      name: name,
      deps: deps,
      files: [{
        path: `${name}.jsx`,
        content: jsxContent
      }, {
        path: `${name}.dts-fragment`,
        content: dtsFragment
      }]
    };
  }
  const dtsContent = `import * as React from 'react';
` + propsDts + `export declare const ${name}: React.FC<${name}Props>;
export default ${name};
`;
  return {
    name: name,
    deps: deps,
    files: [{
      path: `${name}.jsx`,
      content: jsxContent
    }, {
      path: `${name}.d.ts`,
      content: dtsContent
    }]
  };
}
const DEFAULT_ASSET_MAX_BYTES = 4 * 1024 * 1024,
  DEFAULT_ASSET_TOTAL_BYTES = 16 * 1024 * 1024;
function fnv1aHex(text) {
  let hash = 2166136261;
  for (let idx = 0; idx < text.length; idx++) hash ^= text.charCodeAt(idx), hash = Math.imul(hash, 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
const COMPONENTS_DIR = "Components";
function sortModulesByDeps(modules) {
  const ordered = [],
    emitted = new Set(),
    visiting = new Set(),
    visit = mod => {
      if (!(emitted.has(mod.name) || visiting.has(mod.name))) {
        visiting.add(mod.name);
        for (const depName of [...mod.deps].sort()) {
          const dep = modules.get(depName);
          dep && visit(dep);
        }
        visiting.delete(mod.name), emitted.add(mod.name), ordered.push(mod);
      }
    };
  for (const mod of modules.values()) visit(mod);
  const names = ordered.map(mod => mod.name),
    header = `// ${COMPONENTS_DIR} bundle — ${names.length} component(s) materialized from a .fig as one
// self-contained file: no imports/exports; every component is assigned to window below.
// Design tokens / typography still ship separately (fig-tokens.css / fig-typography.css).
`,
    sources = ordered.map(mod => mod.files.find(file => file.path === `${mod.name}.jsx`)?.content ?? ""),
    globals = `// Globals for scripts loaded after this file.
` + names.map(name => `window.${name} = ${name};`).join(`
`) + `
`;
  return {
    path: `${COMPONENTS_DIR}.bundle.jsx`,
    content: [header, ...sources, globals].join(`
`)
  };
}
function buildBundleDts(modules) {
  const names = [...modules.keys()].sort(),
    fragments = names.map(name => modules.get(name).files.find(file => file.path === `${name}.dts-fragment`)?.content ?? ""),
    header = `// ${COMPONENTS_DIR}.d.ts — the complete catalog of the ${names.length} component(s) in
// ${COMPONENTS_DIR}.bundle.js. READ THIS FILE BEFORE USING THE BUNDLE: component
// names are derived from Figma layer names (sanitized to PascalCase,
// deduplicated) and may differ from what the design calls them — the
// "figma layer" comment above each interface maps them back.
// After the bundle <script> loads, every component is a window global
// (e.g. window.${names[0] ?? "Button"}) and usable directly in JSX.
import * as React from 'react';
`,
    decls = names.map(name => `declare const ${name}: React.FC<${name}Props>;`).join(`
`),
    globalBlock = `declare global {
  interface Window {
` + names.map(name => `    ${name}: React.FC<${name}Props>;`).join(`
`) + `
  }
}
`;
  return {
    path: `${COMPONENTS_DIR}.d.ts`,
    content: [header, ...fragments, decls, globalBlock].join(`
`)
  };
}
function enumerateComponents(fig, options) {
  const byGuid = new Map(),
    variantChildren = new Set();
  for (const node of fig.nodes.values()) if (node.isStateGroup) for (const child of node.children ?? []) variantChildren.add(guidStr(child.guid));
  const entries = [];
  for (const node of fig.nodes.values()) node.isStateGroup ? entries.push({
    node: node,
    isSet: !0
  }) : node.type === "SYMBOL" && !variantChildren.has(guidStr(node.guid)) && entries.push({
    node: node,
    isSet: !1
  });
  entries.sort((entryA, entryB) => Number(entryB.isSet) - Number(entryA.isSet));
  const names = dedupe(entries.map(entry => safePascal(entry.node.name, "Component", options)));
  return entries.forEach((entry, idx) => byGuid.set(guidStr(entry.node.guid), {
    node: entry.node,
    name: names[idx]
  })), byGuid;
}
function copyComponents(fig, tokens, options) {
  const nameOpts = {
      bundleMode: options.moduleFormat === "bundle"
    },
    components = enumerateComponents(fig, nameOpts),
    byLowerName = new Map(),
    byName = new Map();
  for (const [guid, {
    name: name
  }] of components) {
    const lower = name.toLowerCase();
    byLowerName.has(lower) || byLowerName.set(lower, guid), byName.has(name) || byName.set(name, guid);
  }
  const setByChild = new Map();
  for (const [guid, {
    node: node
  }] of components) if (node.isStateGroup) for (const child of node.children ?? []) setByChild.set(guidStr(child.guid), guid);
  const byChildName = new Map();
  for (const [childGuid, setGuid] of setByChild) {
    const childName = fig.nodes.get(childGuid)?.name;
    if (childName) for (const alias of [childName.toLowerCase(), safePascal(childName, "", nameOpts).toLowerCase()]) alias && !byLowerName.has(alias) && !byChildName.has(alias) && byChildName.set(alias, setGuid);
  }
  const emitted = new Map(),
    missing = [],
    selected = [];
  for (const name of options.names) {
    const resolved = components.has(name) ? name : setByChild.get(name) ?? byLowerName.get(safePascal(name, "", nameOpts).toLowerCase()) ?? byLowerName.get(name.toLowerCase()) ?? byChildName.get(safePascal(name, "", nameOpts).toLowerCase()) ?? byChildName.get(name.toLowerCase());
    resolved ? selected.push(resolved) : missing.push(name);
  }
  const frames = [],
    usedNames = new Set([...components.values()].map(entry => entry.name));
  for (const guid of options.frameGuids ?? []) {
    if (components.has(guid)) {
      selected.push(guid);
      continue;
    }
    const setGuid = setByChild.get(guid);
    if (setGuid) {
      selected.push(setGuid);
      continue;
    }
    const node = fig.nodes.get(guid);
    if (!node || node.type === "CANVAS" || node.type === "DOCUMENT") {
      missing.push(guid);
      continue;
    }
    const base = safePascal(node.name, "Screen", nameOpts);
    let name = base;
    for (let counter = 2; usedNames.has(name); counter++) name = base + counter;
    usedNames.add(name), frames.push({
      guid: guid,
      node: node,
      name: name
    });
  }
  const withDeps = (options.includeDeps ?? !1) || frames.length > 0,
    selectedGuids = new Set(selected),
    nameOf = guid => {
      const key = setByChild.get(guid) ?? guid;
      if (!(!withDeps && !selectedGuids.has(key))) return components.get(key)?.name;
    },
    warnings = [];
  let curComponent = "";
  const warn = (nodeId, kind, detail) => {
      warnings.push({
        component: curComponent,
        nodeId: nodeId,
        kind: kind,
        detail: detail
      });
    },
    modelCache = new Map(),
    propModelOf = guid => {
      const key = setByChild.get(guid) ?? guid,
        cached = modelCache.get(key);
      if (cached) return cached;
      const entry = components.get(key);
      if (!entry) return;
      const model = buildPropModel(entry.node, fig, warn);
      return modelCache.set(key, model), model;
    },
    vectorKeysCache = new Map(),
    vectorKeysOf = guid => {
      const key = setByChild.get(guid) ?? guid;
      if (vectorKeysCache.has(key)) return vectorKeysCache.get(key);
      const entry = components.get(key);
      let keys;
      if (entry) {
        keys = new Set();
        const visit = cur => {
          if (VECTOR_NODE_TYPES.has(cur.type ?? "")) {
            keys.add(guidStr(cur.guid));
            const overrideKey = cur.overrideKey;
            overrideKey && keys.add(guidStr(overrideKey));
          }
          for (const child of cur.children ?? []) visit(child);
        };
        visit(entry.node);
      }
      return vectorKeysCache.set(key, keys), keys;
    },
    textSlotsCache = new Map(),
    textSlotsOf = guid => {
      const key = setByChild.get(guid) ?? guid;
      if (textSlotsCache.has(key)) return textSlotsCache.get(key);
      const entry = components.get(key),
        model = entry ? propModelOf(key) : void 0;
      let slots;
      if (entry && model && synthTextEnabled(model)) {
        slots = new Map();
        const symbols = entry.node.isStateGroup ? (entry.node.children ?? []).filter(child => child.type === "SYMBOL") : [entry.node];
        for (const symbol of symbols) for (const [guidKey, slot] of synthTextSlots(symbol, model)) slots.has(guidKey) || slots.set(guidKey, slot);
      }
      return textSlotsCache.set(key, slots), slots;
    },
    iconSlotsCache = new Map(),
    iconSlotsOf = guid => {
      const key = setByChild.get(guid) ?? guid;
      if (iconSlotsCache.has(key)) return iconSlotsCache.get(key);
      const entry = components.get(key),
        model = entry ? propModelOf(key) : void 0;
      let slots;
      if (entry && model && synthTextEnabled(model) && synthIconEnabled(model)) {
        slots = new Map();
        const symbols = entry.node.isStateGroup ? (entry.node.children ?? []).filter(child => child.type === "SYMBOL") : [entry.node];
        for (const symbol of symbols) for (const [guidKey, slot] of synthIconSlots(symbol, model)) slots.has(guidKey) || slots.set(guidKey, slot);
      }
      return iconSlotsCache.set(key, slots), slots;
    },
    assets = [],
    assetRefs = new Map();
  let totalBytes = 0;
  const imageRef = (imageHash, nodeId) => {
      const hex = bytesToHex(imageHash);
      if (assetRefs.has(hex)) return assetRefs.get(hex);
      const skip = reason => {
          warn(nodeId, "asset-skipped", reason), assetRefs.set(hex, void 0);
        },
        image = resolveImage(fig, hex);
      if (!image) return skip(`image ${hex.slice(0, ASSET_HASH_LEN)} is not in the .fig; fill dropped`);
      if (!image.raster) return skip(`image ${hex.slice(0, ASSET_HASH_LEN)} is not a recognised raster format (png/jpeg/gif/webp); fill dropped`);
      const mib = bytes => (bytes / (1024 * 1024)).toFixed(1),
        maxBytes = options.assetMaxBytes ?? DEFAULT_ASSET_MAX_BYTES,
        maxTotal = options.assetMaxTotalBytes ?? DEFAULT_ASSET_TOTAL_BYTES;
      if (image.bytes.length > maxBytes) return skip(`image ${image.filename} is ${mib(image.bytes.length)} MiB (per-image budget ${mib(maxBytes)} MiB); fill dropped`);
      if (totalBytes + image.bytes.length > maxTotal) return skip(`image ${image.filename} would exceed the ${mib(maxTotal)} MiB aggregate asset budget; fill dropped`);
      totalBytes += image.bytes.length, assets.push({
        path: `assets/${image.filename}`,
        content: "",
        bytes: image.bytes,
        mime: image.mime
      });
      const ref = `./assets/${image.filename}`;
      return assetRefs.set(hex, ref), ref;
    },
    bgClassCache = new Map(),
    coverRe = new RegExp(`^url\\(\\./assets/([0-9a-f]{${ASSET_HASH_LEN}})\\.\\w+\\) center \\/ cover no-repeat$`),
    urlRe = new RegExp(`url\\(\\./assets/([0-9a-f]{${ASSET_HASH_LEN}})`),
    assetBackground = css => {
      const cached = bgClassCache.get(css);
      if (cached) return cached;
      const coverMatch = coverRe.exec(css),
        hash = urlRe.exec(css)?.[1] ?? "img",
        className = coverMatch ? `fig-asset-${coverMatch[1]}` : `fig-asset-${hash}-${fnv1aHex(css)}`;
      return bgClassCache.set(css, className), className;
    },
    maskClassCache = new Map(),
    assetMask = css => {
      const cached = maskClassCache.get(css);
      if (cached) return cached;
      const className = `fig-mask-${urlRe.exec(css)?.[1] ?? "img"}-${fnv1aHex(css)}`;
      return maskClassCache.set(css, className), className;
    },
    fonts = new Set(),
    ctx = {
      fig: fig,
      tokens: tokens,
      nameOf: nameOf,
      propModelOf: propModelOf,
      textSlotsOf: textSlotsOf,
      iconSlotsOf: iconSlotsOf,
      vectorKeysOf: vectorKeysOf,
      noteFont: font => fonts.add(font),
      imageRef: imageRef,
      assetBackground: assetBackground,
      assetMask: assetMask,
      warn: warn,
      moduleFormat: options.moduleFormat,
      hugWhenUnset: options.hugWhenUnset,
      annotateNodeIds: options.annotateNodeIds,
      layoutMode: options.layoutMode
    },
    queueDeps = mod => {
      if (withDeps) for (const depName of mod.deps) {
        const depGuid = byName.get(depName) ?? byLowerName.get(depName.toLowerCase());
        depGuid && !emitted.has(depName) && selected.push(depGuid);
      }
    };
  for (const frame of frames) {
    curComponent = frame.name;
    const mod = emitRunnable(frame.node, frame.name, ctx);
    emitted.set(frame.name, mod), queueDeps(mod);
  }
  for (; selected.length;) {
    const guid = selected.shift(),
      entry = components.get(guid);
    if (!entry || emitted.has(entry.name)) continue;
    curComponent = entry.name;
    const mod = emitRunnable(entry.node, entry.name, {
      ...ctx,
      synthTextProps: !0
    });
    emitted.set(entry.name, mod), queueDeps(mod);
  }
  const outFiles = [];
  if (options.moduleFormat === "bundle") emitted.size && (outFiles.push(sortModulesByDeps(emitted)), outFiles.push(buildBundleDts(emitted)));else {
    const emittedNames = new Set(emitted.keys()),
      stripDeadImports = content => content.replace(/^import \{ (\w+) \} from '\.\/\1\.jsx';\n/gm, (match, name) => emittedNames.has(name) ? match : "");
    for (const mod of emitted.values()) for (const file of mod.files) outFiles.push(file.path.endsWith(".jsx") ? {
      ...file,
      content: stripDeadImports(file.content)
    } : file);
    if (options.emitIndex !== !1 && emitted.size) {
      const names = [...emitted.keys()].sort();
      outFiles.push({
        path: "index.js",
        content: names.map(name => `export { ${name} } from './${name}.jsx';`).join(`
`) + `
`
      }), outFiles.push({
        path: "index.d.ts",
        content: names.map(name => `export * from './${name}';`).join(`
`) + `
`
      });
    }
  }
  const nodeIds = {};
  for (const [guid, {
    name: name
  }] of components) emitted.has(name) && (nodeIds[name] = guid);
  for (const frame of frames) emitted.has(frame.name) && (nodeIds[frame.name] = frame.guid);
  const assetsCss = bgClassCache.size || maskClassCache.size ? ["/* Generated by fig_materialize — background/mask classes for extracted bitmaps.", " * One rule per line; url()s are relative to this file, so it must stay", " * next to the assets/ directory it references. */", ...[...bgClassCache].sort((entryA, entryB) => entryA[1].localeCompare(entryB[1])).map(([css, className]) => `.${className} { background: ${css}; }`), ...[...maskClassCache].sort((entryA, entryB) => entryA[1].localeCompare(entryB[1])).map(([css, className]) => `.${className} { -webkit-mask: ${css}; mask: ${css}; }`), ""].join(`
`) : void 0;
  return {
    files: outFiles,
    assets: assets,
    assetsCss: assetsCss,
    emitted: [...emitted.keys()],
    frameNames: frames.filter(frame => emitted.has(frame.name)).map(frame => frame.name),
    nodeIds: nodeIds,
    missing: missing,
    fonts: [...fonts].sort(),
    warnings: warnings
  };
}
function styleClassSlug(name) {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned ? /^[0-9]/.test(cleaned) ? `t-${cleaned}` : cleaned : "style";
}
const TYPO_CSS_PROPS = {
    fontFamily: "font-family",
    fontSize: "font-size",
    fontWeight: "font-weight",
    fontStyle: "font-style",
    lineHeight: "line-height",
    letterSpacing: "letter-spacing",
    textAlign: "text-align",
    textDecoration: "text-decoration",
    color: "color"
  },
  KEYWORD_PROPS = new Set(["fontStyle", "textAlign", "textDecoration"]);
function cssValueFor(prop, value) {
  return typeof value == "number" ? Number.isFinite(value) ? prop === "fontSize" ? `${value}px` : String(value) : void 0 : KEYWORD_PROPS.has(prop) ? /^[a-z-]+$/.test(value) ? value : void 0 : prop === "fontFamily" ? /^[A-Za-z0-9 ,."'-]+$/.test(value) ? value : void 0 : /^[A-Za-z0-9 .,%()#-]+$/.test(value) ? value : `"${value.replace(/["\\]/g, "\\$&").replace(/[\r\n\f]/g, " ")}"`;
}
function typographyDecls(style, indent = "  ") {
  const decls = [];
  for (const [prop, value] of Object.entries(style)) {
    const cssProp = TYPO_CSS_PROPS[prop];
    if (!cssProp) continue;
    const css = cssValueFor(prop, value);
    css != null && decls.push(`${indent}${cssProp}: ${css};`);
  }
  return decls.join(`
`);
}
function effectShadowCss(node) {
  const shadows = [];
  for (const effect of node.effects ?? []) {
    if (effect.visible === !1 || !effect.color || !effect.offset) continue;
    const inset = effect.type === "INNER_SHADOW" ? "inset " : "";
    (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") && shadows.push(`${inset}${fmtNum(effect.offset.x)}px ${fmtNum(effect.offset.y)}px ${fmtNum(effect.radius ?? 0)}px ${fmtNum(effect.spread ?? 0)}px ${cssColor(effect.color)}`);
  }
  return shadows.length ? shadows.join(", ") : void 0;
}
function collectStyleClasses(fig) {
  const classes = [],
    seen = new Set(),
    uniqueSlug = base => {
      let candidate = base,
        counter = 2;
      for (; seen.has(candidate);) candidate = `${base}-${counter++}`;
      return seen.add(candidate), candidate;
    };
  for (const node of fig.nodes.values()) {
    if (node.type !== "STYLE") continue;
    const styleType = node.styleType;
    if (styleType === "TEXT") {
      const className = uniqueSlug(styleClassSlug(node.name ?? "text")),
        css = typographyDecls(textStyleProps(node));
      css && classes.push({
        className: className,
        figName: node.name ?? "",
        kind: "text",
        css: css
      });
    } else if (styleType === "EFFECT") {
      const shadow = effectShadowCss(node);
      if (shadow) {
        const className = uniqueSlug(styleClassSlug(node.name ?? "effect"));
        classes.push({
          className: className,
          figName: node.name ?? "",
          kind: "effect",
          css: `  box-shadow: ${shadow};`
        });
      }
    }
  }
  return classes;
}
function styleClassesToCss(classes) {
  if (!classes.length) return `/* No TEXT/EFFECT styles in this file. */
`;
  const lines = ["@layer typography {"];
  for (const cls of classes) {
    const comment = escapeCommentText(cls.figName).replace(/[\r\n\f]/g, " ");
    lines.push(`  /* ${comment} */`, `  .${cls.className} {`, cls.css.replace(/^/gm, "  "), "  }", "");
  }
  return lines.push("}"), lines.join(`
`) + `
`;
}
function mergeFigAssetsCss(incomingCss, existingCss) {
  const classOf = line => /^\s*\.([A-Za-z0-9_-]+)\s*\{/.exec(line)?.[1],
    existingClasses = new Set(existingCss.split(`
`).map(classOf).filter(className => className !== void 0)),
    lines = incomingCss.split(`
`),
    added = [];
  let idx = 0;
  for (; idx < lines.length;) {
    const className = classOf(lines[idx]);
    if (className === void 0) {
      idx++;
      continue;
    }
    const rule = [];
    let depth = 0;
    for (; idx < lines.length; idx++) {
      const line = lines[idx];
      if (rule.push(line), depth += (line.match(/\{/g) ?? []).length, depth -= (line.match(/\}/g) ?? []).length, depth <= 0) {
        idx++;
        break;
      }
    }
    existingClasses.has(className) || added.push(...rule);
  }
  return added.length === 0 ? existingCss : existingCss.trimEnd() + `
` + added.join(`
`) + `
`;
}
function annotateUndeclaredTokens(css, sources, extraCss = [], knownVars = []) {
  const referenced = new Set(knownVars);
  for (const text of [css, ...extraCss]) for (const match of text.matchAll(/var\((--[A-Za-z0-9_-]+)/g)) referenced.add(match[1]);
  for (const source of sources) for (const match of source.matchAll(/:\s*"([^"\n]*var\(--[^"\n]*)"/g)) for (const varMatch of match[1].matchAll(/var\((--[A-Za-z0-9_-]+)/g)) referenced.add(varMatch[1]);
  const defined = new Set([...css.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)].map(match => match[1])),
    missing = [...referenced].filter(varName => !defined.has(varName)).sort();
  return missing.length === 0 ? css : `/* TODO: referenced by the materialized output but not defined here
 * (likely Figma variables aliased from a subscribed library — define
 * them in your design system's own CSS):
` + missing.map(varName => ` *   ${varName}`).join(`
`) + `
 */

` + css;
}
function emitFigSelection(fig, options) {
  const tokens = collectTokens(fig),
    result = copyComponents(fig, tokens, {
      names: options.components ?? [],
      frameGuids: options.frames ?? [],
      includeDeps: !0,
      emitIndex: !1,
      moduleFormat: options.moduleFormat,
      hugWhenUnset: options.hugWhenUnset,
      annotateNodeIds: options.annotateNodeIds,
      assetMaxBytes: options.assetMaxBytes,
      assetMaxTotalBytes: options.assetMaxTotalBytes,
      layoutMode: options.layoutMode
    }),
    styleClasses = options.includeTypography ? collectStyleClasses(fig) : [],
    wantTokens = options.includeTokens === !0 || tokens.tokens.size > 0 && (result.files.some(file => /:\s*"[^"\n]*var\(--/.test(file.content)) || result.assetsCss !== void 0 && /var\(--/.test(result.assetsCss)),
    unresolved = [...tokens.unresolved.values()].sort((entryA, entryB) => entryA.label.localeCompare(entryB.label)),
    tokenWarnings = unresolved.map(entry => ({
      component: "",
      nodeId: "",
      kind: "unresolved-token",
      detail: entry.css ? `Figma variable "${entry.label}" aliases a value not resolvable in this file; the baked literal was emitted instead — bind it manually if theming is needed` : `External Figma variable binding (guid ${entry.label}) couldn't be resolved against this file; the baked literal was emitted instead — bind it manually if theming is needed`
    })),
    unresolvedCss = unresolved.map(entry => entry.css).filter(css => css !== void 0),
    tokensCss = wantTokens ? annotateUndeclaredTokens(tokensToCss(tokens), result.files.map(file => file.content), result.assetsCss !== void 0 ? [result.assetsCss] : [], unresolvedCss) : void 0;
  return {
    files: result.files,
    assets: result.assets,
    assetsCss: result.assetsCss,
    emitted: result.emitted,
    frameNames: result.frameNames,
    missing: result.missing,
    fonts: result.fonts,
    nodeIds: result.nodeIds,
    warnings: [...result.warnings, ...tokenWarnings],
    tokensCss: tokensCss,
    typographyCss: options.includeTypography ? styleClassesToCss(styleClasses) : void 0,
    tokenCount: tokens.tokens.size,
    tokenModes: tokens.modes.map(mode => mode.name),
    textStyleCount: styleClasses.filter(cls => cls.kind === "text").length,
    effectStyleCount: styleClasses.filter(cls => cls.kind === "effect").length
  };
}
export { ASSET_HASH_LEN, FigDocument, FigVfs, RASTER_EXT, annotateUndeclaredTokens, buildPropModel, camel, childPascals, childSlugs, collectMetadata, collectStyleClasses, collectTokens, consumptionMapCss, copyComponents, decodeFig, dedupe, defaultVariantGuid, detectMime, emitFigSelection, emitModule, emitRunnable, findRepeatedRuns, guidStr, mergeFigAssetsCss, metadataMarkdown, normalizeVariantValue, paintVarCss, parseCommandsBlob, pascal, pathToD, pickSplits, renderChildren, renderNode, renderToHtml, resolveImage, scanSymbolHoles, signature, slug, styleClassesToCss, synthIconEnabled, synthIconSlots, synthTextEnabled, synthTextSlots, tokensToCss, weigh, weightMap };
