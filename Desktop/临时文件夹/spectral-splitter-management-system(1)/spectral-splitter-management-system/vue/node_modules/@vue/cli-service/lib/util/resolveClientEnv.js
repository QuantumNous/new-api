const getBaseUrl = require('./getBaseUrl')
const prefixRE = /^VUE_APP_/

module.exports = function resolveClientEnv (options, raw) {
  const env = {}
  Object.keys(process.env).forEach(key => {
    if (prefixRE.test(key) || key === 'NODE_ENV') {
      env[key] = process.env[key]
    }
  })
  env.BASE_URL = getBaseUrl(options)

  if (raw) {
    return env
  }

  for (const key in env) {
    env[key] = JSON.stringify(env[key])
  }
  return {
    'process.env': env
  }
}
