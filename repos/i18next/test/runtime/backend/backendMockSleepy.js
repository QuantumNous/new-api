class BackendMockSleepy {
  constructor(services, options = {}) {
    this.init(services, options);
  }

  init(services, options) {
    this.services = services;
    this.options = options;
    this.retries = {};
    this.parallelCalls = 0;
    this.parallelCallsHighWaterMark = 0;
  }

  read(language, namespace, callback) {
    this.parallelCalls++;
    if (this.parallelCalls > this.parallelCallsHighWaterMark) {
      this.parallelCallsHighWaterMark = this.parallelCalls;
    }
    setTimeout(() => {
      this.parallelCalls--;
      return callback(null, { status: 'ok' });
    }, 15);
  }
}

export default BackendMockSleepy;
