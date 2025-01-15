"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processors = void 0;
const merge = require('merge-source-map');
// .scss/.sass processor
const scss = {
    render(source, map, options) {
        const nodeSass = require('sass');
        const finalOptions = Object.assign({}, options, {
            data: source,
            file: options.filename,
            outFile: options.filename,
            sourceMap: !!map
        });
        try {
            const result = nodeSass.renderSync(finalOptions);
            if (map) {
                return {
                    code: result.css.toString(),
                    map: merge(map, JSON.parse(result.map.toString())),
                    errors: []
                };
            }
            return { code: result.css.toString(), errors: [] };
        }
        catch (e) {
            return { code: '', errors: [e] };
        }
    }
};
const sass = {
    render(source, map, options) {
        return scss.render(source, map, Object.assign({}, options, { indentedSyntax: true }));
    }
};
// .less
const less = {
    render(source, map, options) {
        const nodeLess = require('less');
        let result;
        let error = null;
        nodeLess.render(source, Object.assign({}, options, { syncImport: true }), (err, output) => {
            error = err;
            result = output;
        });
        if (error)
            return { code: '', errors: [error] };
        if (map) {
            return {
                code: result.css.toString(),
                map: merge(map, result.map),
                errors: []
            };
        }
        return { code: result.css.toString(), errors: [] };
    }
};
// .styl
const styl = {
    render(source, map, options) {
        const nodeStylus = require('stylus');
        try {
            const ref = nodeStylus(source);
            Object.keys(options).forEach(key => ref.set(key, options[key]));
            if (map)
                ref.set('sourcemap', { inline: false, comment: false });
            const result = ref.render();
            if (map) {
                return {
                    code: result,
                    map: merge(map, ref.sourcemap),
                    errors: []
                };
            }
            return { code: result, errors: [] };
        }
        catch (e) {
            return { code: '', errors: [e] };
        }
    }
};
exports.processors = {
    less,
    sass,
    scss,
    styl,
    stylus: styl
};
