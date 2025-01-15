module.exports = function silence (logName, exports) {
  const logs = {}
  Object.keys(exports).forEach(key => {
    if (key !== 'error') {
      exports[key] = (...args) => {
        if (!logs[key]) logs[key] = []
        logs[key].push(args)
      }
    }
  })
  exports[logName] = logs
}
