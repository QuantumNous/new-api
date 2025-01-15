"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (service, txtQuery) => {
    if (txtQuery === undefined)
        return true;
    let serviceTxt = service.txt;
    let query = Object.entries(txtQuery)
        .map(([key, value]) => {
        let queryValue = serviceTxt[key];
        if (queryValue === undefined)
            return false;
        if (value != queryValue)
            return false;
        return true;
    });
    if (query.length == 0)
        return true;
    if (query.includes(false))
        return false;
    return true;
};
//# sourceMappingURL=filter-service.js.map