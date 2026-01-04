import { SemiWebpackPluginOptions } from './types';

export function stringifyVariableRecord(map: SemiWebpackPluginOptions['variables'] = {}) {
    let ret = '';
    for (const [k, v] of Object.entries(map)) {
        ret += `${k}: ${v};\n`;
    }
    return ret;
}
