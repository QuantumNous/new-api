"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toType = exports.toString = void 0;
const Prefix = (name) => {
    return '_' + name;
};
const AllowedProp = (key) => {
    let keys = ['name', 'protocol', 'subtype'];
    return keys.includes(key);
};
const toString = (data) => {
    let formatted = {
        name: data.name,
        protocol: data.protocol,
        subtype: data.subtype
    };
    let entries = Object.entries(formatted);
    return entries
        .filter(([key, val]) => AllowedProp(key) && val !== undefined)
        .reduce((prev, [key, val]) => {
        switch (typeof val) {
            case 'object':
                val.map((i) => prev.push(Prefix(i)));
                break;
            default:
                prev.push(Prefix(val));
                break;
        }
        return prev;
    }, [])
        .join('.');
};
exports.toString = toString;
const toType = (string) => {
    let parts = string.split('.');
    let subtype;
    for (let i in parts) {
        if (parts[i][0] !== '_')
            continue;
        parts[i] = parts[i].slice(1);
    }
    if (parts.includes('sub')) {
        subtype = parts.shift();
        parts.shift();
    }
    return {
        name: parts.shift(),
        protocol: parts.shift() || null,
        subtype: subtype
    };
};
exports.toType = toType;
//# sourceMappingURL=service-types.js.map