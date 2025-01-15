"use strict";
// vue compiler module for transforming `<tag>:<attribute>` to `require`
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const defaultOptions = {
    audio: 'src',
    video: ['src', 'poster'],
    source: 'src',
    img: 'src',
    image: ['xlink:href', 'href'],
    use: ['xlink:href', 'href']
};
exports.default = (userOptions, transformAssetUrlsOption) => {
    const options = userOptions
        ? Object.assign({}, defaultOptions, userOptions)
        : defaultOptions;
    return {
        postTransformNode: (node) => {
            transform(node, options, transformAssetUrlsOption);
        }
    };
};
function transform(node, options, transformAssetUrlsOption) {
    for (const tag in options) {
        if ((tag === '*' || node.tag === tag) && node.attrs) {
            const attributes = options[tag];
            if (typeof attributes === 'string') {
                node.attrs.some(attr => rewrite(attr, attributes, transformAssetUrlsOption));
            }
            else if (Array.isArray(attributes)) {
                attributes.forEach(item => node.attrs.some(attr => rewrite(attr, item, transformAssetUrlsOption)));
            }
        }
    }
}
function rewrite(attr, name, transformAssetUrlsOption) {
    if (attr.name === name) {
        const value = attr.value;
        // only transform static URLs
        if (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
            attr.value = utils_1.urlToRequire(value.slice(1, -1), transformAssetUrlsOption);
            return true;
        }
    }
    return false;
}
