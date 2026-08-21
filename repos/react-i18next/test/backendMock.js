export class BackendMock {
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
    this.queue.push(callback);
  }

  flush() {
    this.queue.forEach((cb) => {
      cb(null, {
        key1: 'test',
        interpolateKey: 'add {{insert}} {{up, uppercase}}',
      });
    });
  }
}
