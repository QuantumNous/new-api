const path = require('path');

module.exports = {
    process(src, filename, config, options) {
        let id = path.basename(filename)
        id = id.split('.')[0];
        const obj = { id };
        return `module.exports = ${JSON.stringify(obj)};`;
    }
};