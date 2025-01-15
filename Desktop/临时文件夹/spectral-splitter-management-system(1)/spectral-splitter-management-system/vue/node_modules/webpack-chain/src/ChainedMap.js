const merge = require('deepmerge');
const Chainable = require('./Chainable');

module.exports = class extends Chainable {
  constructor(parent) {
    super(parent);
    this.store = new Map();
  }

  extend(methods) {
    this.shorthands = methods;
    methods.forEach((method) => {
      this[method] = (value) => this.set(method, value);
    });
    return this;
  }

  clear() {
    this.store.clear();
    return this;
  }

  delete(key) {
    this.store.delete(key);
    return this;
  }

  order() {
    const entries = [...this.store].reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
    const names = Object.keys(entries);
    const order = [...names];

    names.forEach((name) => {
      if (!entries[name]) {
        return;
      }

      const { __before, __after } = entries[name];

      if (__before && order.includes(__before)) {
        order.splice(order.indexOf(name), 1);
        order.splice(order.indexOf(__before), 0, name);
      } else if (__after && order.includes(__after)) {
        order.splice(order.indexOf(name), 1);
        order.splice(order.indexOf(__after) + 1, 0, name);
      }
    });

    return { entries, order };
  }

  entries() {
    const { entries, order } = this.order();

    if (order.length) {
      return entries;
    }

    return undefined;
  }

  values() {
    const { entries, order } = this.order();

    return order.map((name) => entries[name]);
  }

  get(key) {
    return this.store.get(key);
  }

  getOrCompute(key, fn) {
    if (!this.has(key)) {
      this.set(key, fn());
    }
    return this.get(key);
  }

  has(key) {
    return this.store.has(key);
  }

  set(key, value) {
    this.store.set(key, value);
    return this;
  }

  merge(obj, omit = []) {
    Object.keys(obj).forEach((key) => {
      if (omit.includes(key)) {
        return;
      }

      const value = obj[key];

      if (
        (!Array.isArray(value) && typeof value !== 'object') ||
        value === null ||
        !this.has(key)
      ) {
        this.set(key, value);
      } else {
        this.set(key, merge(this.get(key), value));
      }
    });

    return this;
  }

  clean(obj) {
    return Object.keys(obj).reduce((acc, key) => {
      const value = obj[key];

      if (value === undefined) {
        return acc;
      }

      if (Array.isArray(value) && !value.length) {
        return acc;
      }

      if (
        Object.prototype.toString.call(value) === '[object Object]' &&
        !Object.keys(value).length
      ) {
        return acc;
      }

      acc[key] = value;

      return acc;
    }, {});
  }

  when(
    condition,
    whenTruthy = Function.prototype,
    whenFalsy = Function.prototype,
  ) {
    if (condition) {
      whenTruthy(this);
    } else {
      whenFalsy(this);
    }

    return this;
  }
};
