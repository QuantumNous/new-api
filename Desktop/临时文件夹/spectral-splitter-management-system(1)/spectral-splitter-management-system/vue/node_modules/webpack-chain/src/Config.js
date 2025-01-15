const ChainedMap = require('./ChainedMap');
const ChainedSet = require('./ChainedSet');
const Resolve = require('./Resolve');
const ResolveLoader = require('./ResolveLoader');
const Output = require('./Output');
const DevServer = require('./DevServer');
const Plugin = require('./Plugin');
const Module = require('./Module');
const Optimization = require('./Optimization');
const Performance = require('./Performance');

module.exports = class extends ChainedMap {
  constructor() {
    super();
    this.devServer = new DevServer(this);
    this.entryPoints = new ChainedMap(this);
    this.module = new Module(this);
    this.node = new ChainedMap(this);
    this.optimization = new Optimization(this);
    this.output = new Output(this);
    this.performance = new Performance(this);
    this.plugins = new ChainedMap(this);
    this.resolve = new Resolve(this);
    this.resolveLoader = new ResolveLoader(this);
    this.extend([
      'amd',
      'bail',
      'cache',
      'context',
      'devtool',
      'externals',
      'loader',
      'mode',
      'name',
      'parallelism',
      'profile',
      'recordsInputPath',
      'recordsPath',
      'recordsOutputPath',
      'stats',
      'target',
      'watch',
      'watchOptions',
    ]);
  }

  static toString(config, { verbose = false, configPrefix = 'config' } = {}) {
    // eslint-disable-next-line global-require
    const { stringify } = require('javascript-stringify');

    return stringify(
      config,
      (value, indent, stringify) => {
        // improve plugin output
        if (value && value.__pluginName) {
          const prefix = `/* ${configPrefix}.${value.__pluginType}('${value.__pluginName}') */\n`;
          const constructorExpression = value.__pluginPath
            ? // The path is stringified to ensure special characters are escaped
              // (such as the backslashes in Windows-style paths).
              `(require(${stringify(value.__pluginPath)}))`
            : value.__pluginConstructorName;

          if (constructorExpression) {
            // get correct indentation for args by stringifying the args array and
            // discarding the square brackets.
            const args = stringify(value.__pluginArgs).slice(1, -1);
            return `${prefix}new ${constructorExpression}(${args})`;
          }
          return (
            prefix +
            stringify(
              value.__pluginArgs && value.__pluginArgs.length
                ? { args: value.__pluginArgs }
                : {},
            )
          );
        }

        // improve rule/use output
        if (value && value.__ruleNames) {
          const ruleTypes = value.__ruleTypes;
          const prefix = `/* ${configPrefix}.module${value.__ruleNames
            .map(
              (r, index) => `.${ruleTypes ? ruleTypes[index] : 'rule'}('${r}')`,
            )
            .join('')}${
            value.__useName ? `.use('${value.__useName}')` : ``
          } */\n`;
          return prefix + stringify(value);
        }

        if (value && value.__expression) {
          return value.__expression;
        }

        // shorten long functions
        if (typeof value === 'function') {
          if (!verbose && value.toString().length > 100) {
            return `function () { /* omitted long function */ }`;
          }
        }

        return stringify(value);
      },
      2,
    );
  }

  entry(name) {
    return this.entryPoints.getOrCompute(name, () => new ChainedSet(this));
  }

  plugin(name) {
    return this.plugins.getOrCompute(name, () => new Plugin(this, name));
  }

  toConfig() {
    const entryPoints = this.entryPoints.entries() || {};

    return this.clean(
      Object.assign(this.entries() || {}, {
        node: this.node.entries(),
        output: this.output.entries(),
        resolve: this.resolve.toConfig(),
        resolveLoader: this.resolveLoader.toConfig(),
        devServer: this.devServer.toConfig(),
        module: this.module.toConfig(),
        optimization: this.optimization.toConfig(),
        plugins: this.plugins.values().map((plugin) => plugin.toConfig()),
        performance: this.performance.entries(),
        entry: Object.keys(entryPoints).reduce(
          (acc, key) =>
            Object.assign(acc, { [key]: entryPoints[key].values() }),
          {},
        ),
      }),
    );
  }

  toString(options) {
    return module.exports.toString(this.toConfig(), options);
  }

  merge(obj = {}, omit = []) {
    const omissions = [
      'node',
      'output',
      'resolve',
      'resolveLoader',
      'devServer',
      'optimization',
      'performance',
      'module',
    ];

    if (!omit.includes('entry') && 'entry' in obj) {
      Object.keys(obj.entry).forEach((name) =>
        this.entry(name).merge([].concat(obj.entry[name])),
      );
    }

    if (!omit.includes('plugin') && 'plugin' in obj) {
      Object.keys(obj.plugin).forEach((name) =>
        this.plugin(name).merge(obj.plugin[name]),
      );
    }

    omissions.forEach((key) => {
      if (!omit.includes(key) && key in obj) {
        this[key].merge(obj[key]);
      }
    });

    return super.merge(obj, [...omit, ...omissions, 'entry', 'plugin']);
  }
};
