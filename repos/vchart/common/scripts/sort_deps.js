/**
 * sort `dependencies` `devDependencies` `peerDependencies` field in package.json
 * 
 * NOTE: you should install prettier global `npm i -g prettier`
 * 
 * usage: `node common/scripts/sort_deps.js [project_relative_path]`
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

function getPackageJson(pkgJsonPath) {
  const pkgJson = fs.readFileSync(pkgJsonPath, { encoding: 'utf-8' })
  return JSON.parse(pkgJson)
}

function updatePackageJson(pkgJsonPath, data) {
  fs.writeFileSync(path.resolve(pkgJsonPath, 'package.json'), data, { encoding: 'utf-8' })
}

function isPlainObject(value) {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype
}

function sortObjectByKeyNameList(object, sortWith) {
  let keys
  let sortFn

  if (typeof sortWith === 'function') {
    sortFn = sortWith
  } else {
    keys = sortWith
  }

  const objectKeys = Object.keys(object)
  return (keys || []).concat(objectKeys.sort(sortFn)).reduce(function(total, key) {
    if (objectKeys.indexOf(key) !== -1) {
      total[key] = object[key]
    }
    return total
  }, Object.create(null))
}

const onObject
  = (fn) =>
    (x, ...args) =>
      isPlainObject(x) ? fn(x, ...args) : x

const sortObjectBy = (comparator, deep) => {
  const over = onObject((object) => {
    object = sortObjectByKeyNameList(object, comparator)
    if (deep) {
      for (const [key, value] of Object.entries(object)) {
        object[key] = over(value)
      }
    }
    return object
  })

  return over
}

const sortObject = sortObjectBy()

function sortDeps(data) {
  if (data.dependencies) {
    data.dependencies = sortObject(data.dependencies)
  }
  if (data.devDependencies) {
    data.devDependencies = sortObject(data.devDependencies)
  }

  if (data.peerDependencies) {
    data.peerDependencies = sortObject(data.peerDependencies)
  }
}

function run() {
  const targetDir = process.argv.slice(2)[0]
  const cwd = process.cwd();

  if (typeof targetDir === 'string') {
    const pkgJsonPath = path.resolve(targetDir, 'package.json')
    const pkgJson = getPackageJson(pkgJsonPath)
    sortDeps(pkgJson)
    updatePackageJson(targetDir, JSON.stringify(pkgJson))

    spawnSync('sh', ['-c', `prettier -w ${pkgJsonPath}`], {
      stdio: 'inherit',
      shell: false,
    })
  } else {
    const rushJson = getPackageJson(`${cwd}/rush.json`)

    rushJson.projects.forEach((project) => {
      const pkgJsonPath = path.resolve(project.projectFolder, 'package.json')
      const pkgJson = getPackageJson(pkgJsonPath)

      sortDeps(pkgJson)
      updatePackageJson(project.projectFolder, JSON.stringify(pkgJson))

      spawnSync('sh', ['-c', `prettier -w ${pkgJsonPath}`], {
        stdio: 'inherit',
        shell: false,
      }) 
    });
  }
}

run()

