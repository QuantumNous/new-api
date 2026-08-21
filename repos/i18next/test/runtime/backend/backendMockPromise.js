class BackendMockPromise {
  constructor(services, options = {}) {
    this.init(services, options);
  }

  init(services, options) {
    this.services = services;
    this.options = options;
    this.created = {};
  }

  read(language, namespace) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ status: 'ok', language, namespace });
      }, 15);
    });
  }
  // async read(language, namespace) {
  //   const r = await new Promise((resolve) => {
  //     setTimeout(() => {
  //       resolve({ status: 'ok', language, namespace });
  //     }, 15);
  //   })
  //   return r
  // }

  create(languages, namespace, key, fallbackValue, options) {
    languages.forEach((l) => {
      this.created[l] = this.created[l] || {};
      this.created[l][namespace] = this.created[l][namespace] || {};
      this.created[l][namespace][key] = {
        fallbackValue,
        options,
      };
    });
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 15);
    });
  }
}

export default BackendMockPromise;
