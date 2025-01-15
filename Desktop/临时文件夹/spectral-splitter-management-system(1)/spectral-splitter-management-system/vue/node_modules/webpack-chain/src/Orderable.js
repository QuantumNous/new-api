module.exports = (Class) =>
  class extends Class {
    before(name) {
      if (this.__after) {
        throw new Error(
          `Unable to set .before(${JSON.stringify(
            name,
          )}) with existing value for .after()`,
        );
      }

      this.__before = name;
      return this;
    }

    after(name) {
      if (this.__before) {
        throw new Error(
          `Unable to set .after(${JSON.stringify(
            name,
          )}) with existing value for .before()`,
        );
      }

      this.__after = name;
      return this;
    }

    merge(obj, omit = []) {
      if (obj.before) {
        this.before(obj.before);
      }

      if (obj.after) {
        this.after(obj.after);
      }

      return super.merge(obj, [...omit, 'before', 'after']);
    }
  };
