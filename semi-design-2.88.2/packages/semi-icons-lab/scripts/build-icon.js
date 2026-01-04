/**
 * Convert svg elements into React components
 */

const { resolve } = require('path');
const build = require('../../../scripts/build-svg');

// Semi Icon
const entryDir = resolve(__dirname, '../src/svgs');
const outDir = resolve(__dirname, '../src/icons');

const customTemplate = ({ template }, opts, { imports, interfaces, componentName, props, jsx, exports }) => {
    const plugins = ['jsx'];
    if (opts.typescript) {
        plugins.push('typescript');
    }
    const typeScriptTpl = template.smart({ plugins });
    return typeScriptTpl.ast`${imports}
import { convertIcon } from '../components/Icon';

${interfaces}
function ${componentName}(${props}) {
  return ${jsx};
}

const IconComponent = convertIcon(${componentName}, '${opts.iconType}');

export default IconComponent;
`;
};

const svgoPlugins = [
    // {
    //     name: 'convertColors',
    //     params: { currentColor: /^(?!url|none)./ },
    // },
    {
        name: 'convertPathData',
        params: {
            floatPrecision: 2
        }
    },
    {
        name: 'cleanupListOfValues',
        active: true,
    },
    {
        name: 'removeStyleElement',
        active: true,
    },
    {
        name: 'removeViewBox',
        active: false,
    },
    {
        name: 'removeDimensions',
        active: true,
    },
];

// Semi icon library decolor
build(entryDir, outDir, 'Icon', '', svgoPlugins, { typescript: true, icon: true, template: customTemplate });