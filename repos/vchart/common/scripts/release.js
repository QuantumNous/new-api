/**
 * release
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const checkAndUpdateNextBump = require('./version-policies');

function getPackageJson(pkgJsonPath) {
  const pkgJson = fs.readFileSync(pkgJsonPath, { encoding: 'utf-8' })
  return JSON.parse(pkgJson)
}

function run() {
  let releaseVersion = process.argv.slice(2)[0];
  const cwd = process.cwd();

  // 0. update `nextBump`
  checkAndUpdateNextBump(releaseVersion);

  // 1. update version of package.json, this operation will remove the common/changes
  spawnSync('sh', ['-c', `rush version --bump`], {
    stdio: 'inherit',
    shell: false,
  });

  // 2. build all the packages
  spawnSync('sh', ['-c', `rush build --only tag:package`], {
    stdio: 'inherit',
    shell: false,
  });
  spawnSync('sh', ['-c', `rush build --only @visactor/lark-vchart`], {
    stdio: 'inherit',
    shell: false,
  });

  // 3. publish to npm
  spawnSync('sh', ['-c', 'rush publish --publish --include-all'], {
    stdio: 'inherit',
    shell: false,
  });

  // 4. update version of local packages to shrinkwrap
  spawnSync('sh', ['-c', `rush update`], {
    stdio: 'inherit',
    shell: false,
  });

  const rushJson = getPackageJson(path.join(__dirname, '../../rush.json'));
  const package = rushJson.projects.find((project) => project.name === '@visactor/vchart');

  if (package) {
    const pkgJsonPath = path.join( __dirname, '../../', project.projectFolder, 'package.json')
    const pkgJson = getPackageJson(pkgJsonPath)

    // 5. add tag
    spawnSync('sh', ['-c', `git tag v${pkgJson.versopn}`], {
      stdio: 'inherit',
      shell: false,
    });

    // 6. add all the changes
    spawnSync('sh', ['-c', `git add --all`], {
      stdio: 'inherit',
      shell: false,
    });

    // 7. commit all the changes
    spawnSync('sh', ['-c', `git commit -m "build: publish version ${pkgJson.version}"`], {
      stdio: 'inherit',
      shell: false,
    });

    // 8. push tag to origin
    spawnSync('sh', ['-c', `git push origin v${pkgJson.version}`], {
      stdio: 'inherit',
      shell: false,
    });
  }
}

run()
