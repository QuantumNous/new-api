import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import valueParser from 'postcss-value-parser';
import stylelint from 'stylelint';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const defaultThemePath = path.join(currentDirectory, '../../docs/src/css/index.css');

const ruleName = 'base-ui/no-unknown-demo-colors';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (color) =>
    `Unexpected demo color "${color}". In CSS Modules demos, use raw color values defined in docs/src/css/index.css @theme.`,
});

const allowedKeywords = new Set([
  'auto',
  'currentcolor',
  'inherit',
  'initial',
  'none',
  'revert',
  'revert-layer',
  'transparent',
  'unset',
]);

const colorFunctionNames = new Set([
  'color',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'rgb',
  'rgba',
]);

const namedColors = new Set([
  'aliceblue',
  'antiquewhite',
  'aqua',
  'aquamarine',
  'azure',
  'beige',
  'bisque',
  'black',
  'blanchedalmond',
  'blue',
  'blueviolet',
  'brown',
  'burlywood',
  'cadetblue',
  'chartreuse',
  'chocolate',
  'coral',
  'cornflowerblue',
  'cornsilk',
  'crimson',
  'cyan',
  'darkblue',
  'darkcyan',
  'darkgoldenrod',
  'darkgray',
  'darkgreen',
  'darkgrey',
  'darkkhaki',
  'darkmagenta',
  'darkolivegreen',
  'darkorange',
  'darkorchid',
  'darkred',
  'darksalmon',
  'darkseagreen',
  'darkslateblue',
  'darkslategray',
  'darkslategrey',
  'darkturquoise',
  'darkviolet',
  'deeppink',
  'deepskyblue',
  'dimgray',
  'dimgrey',
  'dodgerblue',
  'firebrick',
  'floralwhite',
  'forestgreen',
  'fuchsia',
  'gainsboro',
  'ghostwhite',
  'gold',
  'goldenrod',
  'gray',
  'green',
  'greenyellow',
  'grey',
  'honeydew',
  'hotpink',
  'indianred',
  'indigo',
  'ivory',
  'khaki',
  'lavender',
  'lavenderblush',
  'lawngreen',
  'lemonchiffon',
  'lightblue',
  'lightcoral',
  'lightcyan',
  'lightgoldenrodyellow',
  'lightgray',
  'lightgreen',
  'lightgrey',
  'lightpink',
  'lightsalmon',
  'lightseagreen',
  'lightskyblue',
  'lightslategray',
  'lightslategrey',
  'lightsteelblue',
  'lightyellow',
  'lime',
  'limegreen',
  'linen',
  'magenta',
  'maroon',
  'mediumaquamarine',
  'mediumblue',
  'mediumorchid',
  'mediumpurple',
  'mediumseagreen',
  'mediumslateblue',
  'mediumspringgreen',
  'mediumturquoise',
  'mediumvioletred',
  'midnightblue',
  'mintcream',
  'mistyrose',
  'moccasin',
  'navajowhite',
  'navy',
  'oldlace',
  'olive',
  'olivedrab',
  'orange',
  'orangered',
  'orchid',
  'palegoldenrod',
  'palegreen',
  'paleturquoise',
  'palevioletred',
  'papayawhip',
  'peachpuff',
  'peru',
  'pink',
  'plum',
  'powderblue',
  'purple',
  'rebeccapurple',
  'red',
  'rosybrown',
  'royalblue',
  'saddlebrown',
  'salmon',
  'sandybrown',
  'seagreen',
  'seashell',
  'sienna',
  'silver',
  'skyblue',
  'slateblue',
  'slategray',
  'slategrey',
  'snow',
  'springgreen',
  'steelblue',
  'tan',
  'teal',
  'thistle',
  'tomato',
  'turquoise',
  'violet',
  'wheat',
  'white',
  'whitesmoke',
  'yellow',
  'yellowgreen',
]);

const hexColorRegex = /^#[\da-f]{3,8}$/i;
const themeColorsCache = new Map();

function normalizeColor(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ');
}

function readThemeColors(themePath) {
  const cachedThemeColors = themeColorsCache.get(themePath);

  if (cachedThemeColors) {
    return cachedThemeColors;
  }

  const themeCss = fs.readFileSync(themePath, 'utf8');
  const themeBlock = /@theme\s*{([\s\S]*?)}/.exec(themeCss)?.[1] ?? '';
  const values = new Set();
  const colorDeclarationRegex = /--color-([\w-]+|\*)\s*:\s*([^;]+);/g;

  for (const match of themeBlock.matchAll(colorDeclarationRegex)) {
    const [, name, rawValue] = match;
    const normalizedValue = normalizeColor(rawValue);

    if (name !== '*' && normalizedValue !== 'initial') {
      values.add(normalizedValue);
    }
  }

  const themeColors = { values };

  themeColorsCache.set(themePath, themeColors);

  return themeColors;
}

function shouldScanNamedColors(property) {
  const normalizedProperty = property.toLowerCase();

  return (
    normalizedProperty !== 'print-color-adjust' &&
    !normalizedProperty.includes('radius') &&
    (normalizedProperty === 'color' ||
      normalizedProperty.endsWith('-color') ||
      normalizedProperty === 'column-rule' ||
      normalizedProperty === 'fill' ||
      normalizedProperty === 'filter' ||
      normalizedProperty === 'stroke' ||
      /^(?:background|border|outline|text-decoration)(?:-|$)/.test(normalizedProperty) ||
      /(?:^|-)(?:shadow)$/.test(normalizedProperty))
  );
}

function isStrictColorProperty(property) {
  const normalizedProperty = property.toLowerCase();

  return (
    normalizedProperty === 'color' ||
    normalizedProperty.endsWith('-color') ||
    normalizedProperty === 'fill' ||
    normalizedProperty === 'stroke'
  );
}

function stripColorMixPercentage(value) {
  return value
    .trim()
    .replace(/\s+(?:\d*\.?\d+%|calc\([^)]*\))$/i, '')
    .trim();
}

function getColorMixArguments(nodes) {
  const args = [];
  let currentArg = [];

  for (const node of nodes) {
    if (node.type === 'div' && node.value === ',') {
      args.push(currentArg);
      currentArg = [];
    } else {
      currentArg.push(node);
    }
  }

  args.push(currentArg);

  // The first argument is the interpolation method: `in oklch`.
  return args.slice(1).map((arg) => stripColorMixPercentage(valueParser.stringify(arg)));
}

function walkColorUsages(value, property, onUsage) {
  const hasFunction = value.includes('(');
  const hasHex = value.includes('#');
  const hasCssVariable = value.includes('var(');
  const hasWord = /[a-z]/i.test(value);
  const scanNamedColors = hasWord && shouldScanNamedColors(property);
  const scanBareWords = hasWord && isStrictColorProperty(property);
  const scanCssVariables = hasCssVariable && (scanNamedColors || scanBareWords);

  if (!hasFunction && !hasHex && !scanCssVariables && !scanNamedColors && !scanBareWords) {
    return;
  }

  const parsedValue = valueParser(value);

  parsedValue.walk((node, _index, nodes) => {
    if (node.type === 'function') {
      const functionName = node.value.toLowerCase();

      if (functionName === 'url') {
        return false;
      }

      if (functionName === 'var') {
        if (scanCssVariables) {
          onUsage(valueParser.stringify(node));
        }

        return false;
      }

      if (functionName === 'color-mix') {
        for (const colorArgument of getColorMixArguments(node.nodes)) {
          if (colorArgument) {
            onUsage(colorArgument);
          }
        }

        return false;
      }

      if (colorFunctionNames.has(functionName)) {
        onUsage(valueParser.stringify(node));

        return false;
      }

      return undefined;
    }

    if (node.type !== 'word') {
      return undefined;
    }

    const word = node.value.toLowerCase();

    if (hasHex && hexColorRegex.test(word)) {
      onUsage(node.value);

      return undefined;
    }

    if (!scanNamedColors || nodes !== parsedValue.nodes) {
      return undefined;
    }

    if (namedColors.has(word) || (scanBareWords && /^[a-z-]+$/i.test(word))) {
      onUsage(word);
    }

    return undefined;
  });
}

function isTokenDerivedRgb(value, themeValues) {
  const match = /rgba?\((.*)\)/i.exec(value);

  if (!match) {
    return false;
  }

  const hasAlpha = /\//.test(match[1]) || /^rgba\(/i.test(value);

  if (!hasAlpha) {
    return false;
  }

  const [red, green, blue] = match[1]
    .replace(/\s*\/.*$/, '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((component) => Number.parseFloat(component));

  return (
    (red === 0 && green === 0 && blue === 0 && themeValues.has('black')) ||
    (red === 255 && green === 255 && blue === 255 && themeValues.has('white'))
  );
}

function isAllowedColor(value, themeColors) {
  const normalizedValue = normalizeColor(value);

  if (allowedKeywords.has(normalizedValue)) {
    return true;
  }

  if (themeColors.values.has(normalizedValue)) {
    return true;
  }

  if (/^rgba?\(/i.test(normalizedValue)) {
    return isTokenDerivedRgb(normalizedValue, themeColors.values);
  }

  return false;
}

const plugin = stylelint.createPlugin(ruleName, (primary, secondaryOptions = {}) => {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true, false],
    });

    if (!validOptions || primary === false) {
      return;
    }

    const themePath = secondaryOptions.themePath ?? defaultThemePath;
    const themeColors = readThemeColors(themePath);

    root.walkDecls((declaration) => {
      const reportedValues = new Set();

      walkColorUsages(declaration.value, declaration.prop, (color) => {
        const normalizedValue = normalizeColor(color);

        if (reportedValues.has(normalizedValue) || isAllowedColor(color, themeColors)) {
          return;
        }

        reportedValues.add(normalizedValue);

        stylelint.utils.report({
          message: messages.rejected(color),
          node: declaration,
          result,
          ruleName,
          word: color,
        });
      });
    });
  };
});

plugin.ruleName = ruleName;
plugin.messages = messages;

export { messages, ruleName };
export default plugin;
