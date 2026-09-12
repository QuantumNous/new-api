console.log('load bundle cjs');

module.exports.getPayload = async function getPayload() {
  const path = await import('node:path');

  // Check that queueMicrotask is available inside the loaded CJS bundle.
  return `${path.basename('/tmp/index.js')}:${typeof queueMicrotask}`;
};
