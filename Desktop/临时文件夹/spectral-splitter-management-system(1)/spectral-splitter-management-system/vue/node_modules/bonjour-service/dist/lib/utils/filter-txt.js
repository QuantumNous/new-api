"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (data) => Object.keys(data)
    .filter((key) => !key.includes('binary'))
    .reduce((cur, key) => { return Object.assign(cur, { [key]: data[key] }); }, {});
//# sourceMappingURL=filter-txt.js.map