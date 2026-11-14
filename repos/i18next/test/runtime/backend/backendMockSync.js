class BackendMockSync {
  constructor(services, options = {}) {
    this.init(services, options);
  }

  init(services, options) {
    this.services = services;
    this.options = options;
    this.created = {};
  }

  read(language, namespace) {
    return { status: 'ok', language, namespace };
  }

  create(languages, namespace, key, fallbackValue, options) {
    languages.forEach((l) => {
      this.created[l] = this.created[l] || {};
      this.created[l][namespace] = this.created[l][namespace] || {};
      this.created[l][namespace][key] = {
        fallbackValue,
        options,
      };
    });
  }
}

export default BackendMockSync;
