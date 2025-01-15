const Resolve = require('./Resolve');
const ChainedSet = require('./ChainedSet');

module.exports = class extends Resolve {
  constructor(parent) {
    super(parent);
    this.moduleExtensions = new ChainedSet(this);
    this.packageMains = new ChainedSet(this);
  }

  toConfig() {
    return this.clean({
      moduleExtensions: this.moduleExtensions.values(),
      packageMains: this.packageMains.values(),
      ...super.toConfig(),
    });
  }

  merge(obj, omit = []) {
    const omissions = ['moduleExtensions', 'packageMains'];

    omissions.forEach((key) => {
      if (!omit.includes(key) && key in obj) {
        this[key].merge(obj[key]);
      }
    });

    return super.merge(obj, [...omit, ...omissions]);
  }
};
