"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _child_process = _interopRequireDefault(require("child_process"));

var _queue = _interopRequireDefault(require("neo-async/queue"));

var _mapSeries = _interopRequireDefault(require("neo-async/mapSeries"));

var _readBuffer = _interopRequireDefault(require("./readBuffer"));

var _WorkerError = _interopRequireDefault(require("./WorkerError"));

var _serializer = require("./serializer");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable no-console */
const workerPath = require.resolve('./worker');

let workerId = 0;

class PoolWorker {
  constructor(options, onJobDone) {
    this.disposed = false;
    this.nextJobId = 0;
    this.jobs = Object.create(null);
    this.activeJobs = 0;
    this.onJobDone = onJobDone;
    this.id = workerId;
    workerId += 1; // Empty or invalid node args would break the child process

    const sanitizedNodeArgs = (options.nodeArgs || []).filter(opt => !!opt);
    this.worker = _child_process.default.spawn(process.execPath, [].concat(sanitizedNodeArgs).concat(workerPath, options.parallelJobs), {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe']
    });
    this.worker.unref(); // This prevents a problem where the worker stdio can be undefined
    // when the kernel hits the limit of open files.
    // More info can be found on: https://github.com/webpack-contrib/thread-loader/issues/2

    if (!this.worker.stdio) {
      throw new Error(`Failed to create the worker pool with workerId: ${workerId} and ${''}configuration: ${JSON.stringify(options)}. Please verify if you hit the OS open files limit.`);
    }

    const [,,, readPipe, writePipe] = this.worker.stdio;
    this.readPipe = readPipe;
    this.writePipe = writePipe;
    this.listenStdOutAndErrFromWorker(this.worker.stdout, this.worker.stderr);
    this.readNextMessage();
  }

  listenStdOutAndErrFromWorker(workerStdout, workerStderr) {
    if (workerStdout) {
      workerStdout.on('data', this.writeToStdout);
    }

    if (workerStderr) {
      workerStderr.on('data', this.writeToStderr);
    }
  }

  ignoreStdOutAndErrFromWorker(workerStdout, workerStderr) {
    if (workerStdout) {
      workerStdout.removeListener('data', this.writeToStdout);
    }

    if (workerStderr) {
      workerStderr.removeListener('data', this.writeToStderr);
    }
  }

  writeToStdout(data) {
    if (!this.disposed) {
      process.stdout.write(data);
    }
  }

  writeToStderr(data) {
    if (!this.disposed) {
      process.stderr.write(data);
    }
  }

  run(data, callback) {
    const jobId = this.nextJobId;
    this.nextJobId += 1;
    this.jobs[jobId] = {
      data,
      callback
    };
    this.activeJobs += 1;
    this.writeJson({
      type: 'job',
      id: jobId,
      data
    });
  }

  warmup(requires) {
    this.writeJson({
      type: 'warmup',
      requires
    });
  }

  writeJson(data) {
    const lengthBuffer = Buffer.alloc(4);
    const messageBuffer = Buffer.from(JSON.stringify(data, _serializer.replacer), 'utf-8');
    lengthBuffer.writeInt32BE(messageBuffer.length, 0);
    this.writePipe.write(lengthBuffer);
    this.writePipe.write(messageBuffer);
  }

  writeEnd() {
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeInt32BE(0, 0);
    this.writePipe.write(lengthBuffer);
  }

  readNextMessage() {
    this.state = 'read length';
    this.readBuffer(4, (lengthReadError, lengthBuffer) => {
      if (lengthReadError) {
        console.error(`Failed to communicate with worker (read length) ${lengthReadError}`);
        return;
      }

      this.state = 'length read';
      const length = lengthBuffer.readInt32BE(0);
      this.state = 'read message';
      this.readBuffer(length, (messageError, messageBuffer) => {
        if (messageError) {
          console.error(`Failed to communicate with worker (read message) ${messageError}`);
          return;
        }

        this.state = 'message read';
        const messageString = messageBuffer.toString('utf-8');
        const message = JSON.parse(messageString, _serializer.reviver);
        this.state = 'process message';
        this.onWorkerMessage(message, err => {
          if (err) {
            console.error(`Failed to communicate with worker (process message) ${err}`);
            return;
          }

          this.state = 'soon next';
          setImmediate(() => this.readNextMessage());
        });
      });
    });
  }

  onWorkerMessage(message, finalCallback) {
    const {
      type,
      id
    } = message;

    switch (type) {
      case 'job':
        {
          const {
            data,
            error,
            result
          } = message;
          (0, _mapSeries.default)(data, (length, callback) => this.readBuffer(length, callback), (eachErr, buffers) => {
            const {
              callback: jobCallback
            } = this.jobs[id];

            const callback = (err, arg) => {
              if (jobCallback) {
                delete this.jobs[id];
                this.activeJobs -= 1;
                this.onJobDone();

                if (err) {
                  jobCallback(err instanceof Error ? err : new Error(err), arg);
                } else {
                  jobCallback(null, arg);
                }
              }

              finalCallback();
            };

            if (eachErr) {
              callback(eachErr);
              return;
            }

            let bufferPosition = 0;

            if (result.result) {
              result.result = result.result.map(r => {
                if (r.buffer) {
                  const buffer = buffers[bufferPosition];
                  bufferPosition += 1;

                  if (r.string) {
                    return buffer.toString('utf-8');
                  }

                  return buffer;
                }

                return r.data;
              });
            }

            if (error) {
              callback(this.fromErrorObj(error), result);
              return;
            }

            callback(null, result);
          });
          break;
        }

      case 'loadModule':
        {
          const {
            request,
            questionId
          } = message;
          const {
            data
          } = this.jobs[id]; // eslint-disable-next-line no-unused-vars

          data.loadModule(request, (error, source, sourceMap, module) => {
            this.writeJson({
              type: 'result',
              id: questionId,
              error: error ? {
                message: error.message,
                details: error.details,
                missing: error.missing
              } : null,
              result: [source, sourceMap // TODO: Serialize module?
              // module,
              ]
            });
          });
          finalCallback();
          break;
        }

      case 'resolve':
        {
          const {
            context,
            request,
            options,
            questionId
          } = message;
          const {
            data
          } = this.jobs[id];

          if (options) {
            data.getResolve(options)(context, request, (error, result) => {
              this.writeJson({
                type: 'result',
                id: questionId,
                error: error ? {
                  message: error.message,
                  details: error.details,
                  missing: error.missing
                } : null,
                result
              });
            });
          } else {
            data.resolve(context, request, (error, result) => {
              this.writeJson({
                type: 'result',
                id: questionId,
                error: error ? {
                  message: error.message,
                  details: error.details,
                  missing: error.missing
                } : null,
                result
              });
            });
          }

          finalCallback();
          break;
        }

      case 'emitWarning':
        {
          const {
            data
          } = message;
          const {
            data: jobData
          } = this.jobs[id];
          jobData.emitWarning(this.fromErrorObj(data));
          finalCallback();
          break;
        }

      case 'emitError':
        {
          const {
            data
          } = message;
          const {
            data: jobData
          } = this.jobs[id];
          jobData.emitError(this.fromErrorObj(data));
          finalCallback();
          break;
        }

      default:
        {
          console.error(`Unexpected worker message ${type} in WorkerPool.`);
          finalCallback();
          break;
        }
    }
  }

  fromErrorObj(arg) {
    let obj;

    if (typeof arg === 'string') {
      obj = {
        message: arg
      };
    } else {
      obj = arg;
    }

    return new _WorkerError.default(obj, this.id);
  }

  readBuffer(length, callback) {
    (0, _readBuffer.default)(this.readPipe, length, callback);
  }

  dispose() {
    if (!this.disposed) {
      this.disposed = true;
      this.ignoreStdOutAndErrFromWorker(this.worker.stdout, this.worker.stderr);
      this.writeEnd();
    }
  }

}

class WorkerPool {
  constructor(options) {
    this.options = options || {};
    this.numberOfWorkers = options.numberOfWorkers;
    this.poolTimeout = options.poolTimeout;
    this.workerNodeArgs = options.workerNodeArgs;
    this.workerParallelJobs = options.workerParallelJobs;
    this.workers = new Set();
    this.activeJobs = 0;
    this.timeout = null;
    this.poolQueue = (0, _queue.default)(this.distributeJob.bind(this), options.poolParallelJobs);
    this.terminated = false;
    this.setupLifeCycle();
  }

  isAbleToRun() {
    return !this.terminated;
  }

  terminate() {
    if (this.terminated) {
      return;
    }

    this.terminated = true;
    this.poolQueue.kill();
    this.disposeWorkers(true);
  }

  setupLifeCycle() {
    process.on('exit', () => {
      this.terminate();
    });
  }

  run(data, callback) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    this.activeJobs += 1;
    this.poolQueue.push(data, callback);
  }

  distributeJob(data, callback) {
    // use worker with the fewest jobs
    let bestWorker;

    for (const worker of this.workers) {
      if (!bestWorker || worker.activeJobs < bestWorker.activeJobs) {
        bestWorker = worker;
      }
    }

    if (bestWorker && (bestWorker.activeJobs === 0 || this.workers.size >= this.numberOfWorkers)) {
      bestWorker.run(data, callback);
      return;
    }

    const newWorker = this.createWorker();
    newWorker.run(data, callback);
  }

  createWorker() {
    // spin up a new worker
    const newWorker = new PoolWorker({
      nodeArgs: this.workerNodeArgs,
      parallelJobs: this.workerParallelJobs
    }, () => this.onJobDone());
    this.workers.add(newWorker);
    return newWorker;
  }

  warmup(requires) {
    while (this.workers.size < this.numberOfWorkers) {
      this.createWorker().warmup(requires);
    }
  }

  onJobDone() {
    this.activeJobs -= 1;

    if (this.activeJobs === 0 && isFinite(this.poolTimeout)) {
      this.timeout = setTimeout(() => this.disposeWorkers(), this.poolTimeout);
    }
  }

  disposeWorkers(fromTerminate) {
    if (!this.options.poolRespawn && !fromTerminate) {
      this.terminate();
      return;
    }

    if (this.activeJobs === 0 || fromTerminate) {
      for (const worker of this.workers) {
        worker.dispose();
      }

      this.workers.clear();
    }
  }

}

exports.default = WorkerPool;