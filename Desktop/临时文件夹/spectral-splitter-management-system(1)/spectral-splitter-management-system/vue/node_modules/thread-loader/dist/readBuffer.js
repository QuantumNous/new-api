"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = readBuffer;

function readBuffer(pipe, length, callback) {
  if (length === 0) {
    callback(null, Buffer.alloc(0));
    return;
  }

  let remainingLength = length;
  const buffers = [];

  const readChunk = () => {
    const onChunk = arg => {
      let chunk = arg;
      let overflow;

      if (chunk.length > remainingLength) {
        overflow = chunk.slice(remainingLength);
        chunk = chunk.slice(0, remainingLength);
        remainingLength = 0;
      } else {
        remainingLength -= chunk.length;
      }

      buffers.push(chunk);

      if (remainingLength === 0) {
        pipe.removeListener('data', onChunk);
        pipe.pause();

        if (overflow) {
          pipe.unshift(overflow);
        }

        callback(null, Buffer.concat(buffers, length));
      }
    };

    pipe.on('data', onChunk);
    pipe.resume();
  };

  readChunk();
}