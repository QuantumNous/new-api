const merge = require('deepmerge');
const ChainedMap = require('./ChainedMap');
const Orderable = require('./Orderable');

module.exports = Orderable(
  class extends ChainedMap {
    constructor(parent, name) {
      super(parent);
      this.name = name;
      this.extend(['loader', 'options']);
    }

    tap(f) {
      this.options(f(this.get('options')));
      return this;
    }

    merge(obj, omit = []) {
      if (!omit.includes('loader') && 'loader' in obj) {
        this.loader(obj.loader);
      }

      if (!omit.includes('options') && 'options' in obj) {
        this.options(merge(this.store.get('options') || {}, obj.options));
      }

      return super.merge(obj, [...omit, 'loader', 'options']);
    }

    toConfig() {
      const config = this.clean(this.entries() || {});

      Object.defineProperties(config, {
        __useName: { value: this.name },
        __ruleNames: { value: this.parent && this.parent.names },
        __ruleTypes: { value: this.parent && this.parent.ruleTypes },
      });

      return config;
    }
  },
);
