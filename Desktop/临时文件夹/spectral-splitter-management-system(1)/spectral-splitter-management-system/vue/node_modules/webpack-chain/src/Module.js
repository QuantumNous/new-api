const ChainedMap = require('./ChainedMap');
const Rule = require('./Rule');

module.exports = class extends ChainedMap {
  constructor(parent) {
    super(parent);
    this.rules = new ChainedMap(this);
    this.defaultRules = new ChainedMap(this);
    this.extend(['noParse', 'strictExportPresence']);
  }

  defaultRule(name) {
    return this.defaultRules.getOrCompute(
      name,
      () => new Rule(this, name, 'defaultRule'),
    );
  }

  rule(name) {
    return this.rules.getOrCompute(name, () => new Rule(this, name, 'rule'));
  }

  toConfig() {
    return this.clean(
      Object.assign(this.entries() || {}, {
        defaultRules: this.defaultRules.values().map((r) => r.toConfig()),
        rules: this.rules.values().map((r) => r.toConfig()),
      }),
    );
  }

  merge(obj, omit = []) {
    if (!omit.includes('rule') && 'rule' in obj) {
      Object.keys(obj.rule).forEach((name) =>
        this.rule(name).merge(obj.rule[name]),
      );
    }

    if (!omit.includes('defaultRule') && 'defaultRule' in obj) {
      Object.keys(obj.defaultRule).forEach((name) =>
        this.defaultRule(name).merge(obj.defaultRule[name]),
      );
    }

    return super.merge(obj, ['rule', 'defaultRule']);
  }
};
