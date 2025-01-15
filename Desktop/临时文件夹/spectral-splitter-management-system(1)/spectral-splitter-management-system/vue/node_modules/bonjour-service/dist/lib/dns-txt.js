'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.DnsTxt = void 0;
class DnsTxt {
    constructor(opts = {}) {
        this.binary = opts ? opts.binary : false;
    }
    encode(data = {}) {
        return Object.entries(data)
            .map(([key, value]) => {
            let item = `${key}=${value}`;
            return Buffer.from(item);
        });
    }
    decode(buffer) {
        var data = {};
        try {
            let format = buffer.toString();
            let parts = format.split(/=(.+)/);
            let key = parts[0];
            let value = parts[1];
            data[key] = value;
        }
        catch (_) { }
        return data;
    }
    decodeAll(buffer) {
        return buffer
            .filter(i => i.length > 1)
            .map(i => this.decode(i))
            .reduce((prev, curr) => {
            var obj = prev;
            let [key] = Object.keys(curr);
            let [value] = Object.values(curr);
            obj[key] = value;
            return obj;
        }, {});
    }
}
exports.DnsTxt = DnsTxt;
exports.default = DnsTxt;
//# sourceMappingURL=dns-txt.js.map