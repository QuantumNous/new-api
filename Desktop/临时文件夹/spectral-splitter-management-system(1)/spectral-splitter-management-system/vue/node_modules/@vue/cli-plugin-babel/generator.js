module.exports = api => {
  // Most likely you want to overwrite the whole config to ensure it's working
  // without conflicts, e.g. for a project that used Jest without Babel.
  // It should be rare for the user to have their own special babel config
  // without using the Babel plugin already.
  delete api.generator.files['babel.config.js']

  api.extendPackage({
    babel: {
      presets: ['@vue/cli-plugin-babel/preset']
    },
    vue: {
      transpileDependencies: true
    },
    dependencies: {
      'core-js': '^3.8.3'
    }
  })
}
