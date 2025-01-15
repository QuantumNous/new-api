"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getPool = getPool;

var _os = _interopRequireDefault(require("os"));

var _WorkerPool = _interopRequireDefault(require("./WorkerPool"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const workerPools = Object.create(null);

function calculateNumberOfWorkers() {
  // There are situations when this call will return undefined so
  // we are fallback here to 1.
  // More info on: https://github.com/nodejs/node/issues/19022
  const cpus = _os.default.cpus() || {
    length: 1
  };
  return Math.max(1, cpus.length - 1);
}

function getPool(options) {
  const workerPoolOptions = {
    name: options.name || '',
    numberOfWorkers: options.workers || calculateNumberOfWorkers(),
    workerNodeArgs: options.workerNodeArgs,
    workerParallelJobs: options.workerParallelJobs || 20,
    poolTimeout: options.poolTimeout || 500,
    poolParallelJobs: options.poolParallelJobs || 200,
    poolRespawn: options.poolRespawn || false
  };
  const tpKey = JSON.stringify(workerPoolOptions);
  workerPools[tpKey] = workerPools[tpKey] || new _WorkerPool.default(workerPoolOptions);
  return workerPools[tpKey];
} // eslint-disable-line import/prefer-default-export