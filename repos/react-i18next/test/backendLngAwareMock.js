export class BackendLngAwareMock {
  constructor(services, options = {}) {
    this.init(services, options);
    this.type = 'backend';
    this.queue = [];
  }

  init(services, options) {
    this.services = services;
    this.options = options;
  }

  read(language, namespace, callback) {
    this.queue.push({ language, namespace, callback });
  }

  flush(what) {
    let q = [...this.queue];
    if (what) {
      const filterFor = [];
      if (what.language) filterFor.push('language');
      if (what.namespace) filterFor.push('namespace');
      if (filterFor.length > 0) {
        q = q.filter((item) => {
          const allOk = filterFor.map((ff) => item[ff] === what[ff]).every((r) => r);
          if (allOk) return true;
          return false;
        });
      }
    }

    q.forEach((item) => {
      this.queue.splice(this.queue.indexOf(item), 1);

      item.callback(null, {
        key1: `${item.language}/${item.namespace} for key1`,
      });
    });
  }
}
