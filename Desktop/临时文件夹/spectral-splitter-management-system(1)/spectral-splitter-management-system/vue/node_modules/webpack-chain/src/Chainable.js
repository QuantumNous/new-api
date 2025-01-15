module.exports = class {
  constructor(parent) {
    this.parent = parent;
  }

  batch(handler) {
    handler(this);
    return this;
  }

  end() {
    return this.parent;
  }
};
