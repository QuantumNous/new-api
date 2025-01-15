// copied from @vue/babel-preset-app

const { semver } = require('@vue/cli-shared-utils')
const { default: getTargets } = require('@babel/helper-compilation-targets')

// See the result at <https://github.com/babel/babel/blob/v7.13.15/packages/babel-compat-data/data/native-modules.json>
const allModuleTargets = getTargets(
  { esmodules: true },
  { ignoreBrowserslistConfig: true }
)

function getIntersectionTargets (targets, constraintTargets) {
  const intersection = Object.keys(constraintTargets).reduce(
    (results, browser) => {
      // exclude the browsers that the user does not need
      if (!targets[browser]) {
        return results
      }

      // if the user-specified version is higher the minimum version that supports esmodule, than use it
      results[browser] = semver.gt(
        semver.coerce(constraintTargets[browser]),
        semver.coerce(targets[browser])
      )
        ? constraintTargets[browser]
        : targets[browser]

      return results
    },
    {}
  )

  return intersection
}

function getModuleTargets (targets) {
  // use the intersection of modern mode browsers and user defined targets config
  return getIntersectionTargets(targets, allModuleTargets)
}

function doAllTargetsSupportModule (targets) {
  const browserList = Object.keys(targets)

  return browserList.every(browserName => {
    if (!allModuleTargets[browserName]) {
      return false
    }

    return semver.gte(
      semver.coerce(targets[browserName]),
      semver.coerce(allModuleTargets[browserName])
    )
  })
}

// get browserslist targets in current working directory
const projectTargets = getTargets()
const projectModuleTargets = getModuleTargets(projectTargets)
const allProjectTargetsSupportModule = doAllTargetsSupportModule(projectTargets)

module.exports = {
  getTargets,
  getModuleTargets,
  getIntersectionTargets,
  doAllTargetsSupportModule,

  projectTargets,
  projectModuleTargets,
  allProjectTargetsSupportModule
}
