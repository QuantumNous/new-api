/**
 * prelease
 */

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const checkAndUpdateNextBump = require('./version-policies');
const getPackageJson = require('./get-package-json');
const writePrereleaseVersion = require('./set-prerelease-version');

const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta|rc|hotfix)(?:\.(?:(0|[1-9])))*)$/;

const preReleaseNameReg = /^((alpha|beta|rc|hotfix)(?:\.(?:0|[1-9]))*)$/;

function run() {
  let preReleaseName = process.argv.slice(2)[0];
  let preReleaseType = '';
  const cwd = process.cwd();
  const rushJson = getPackageJson(path.join(__dirname, '../../rush.json'));
  const package = rushJson.projects.find((project) => project.packageName === '@visactor/vchart');
  let regRes = null;

  if (typeof preReleaseName === 'string' && preReleaseName && (regRes = preReleaseNameReg.exec(preReleaseName))) {
    preReleaseType = regRes[2];
  } else if (!preReleaseName) {
    if (package) {
      const pkgJsonPath = path.join( __dirname, '../../', package.projectFolder, 'package.json')
      const pkgJson = getPackageJson(pkgJsonPath)
      const currentVersion = pkgJson.version;

      if ((regRes = semverRegex.exec(currentVersion))) {
        preReleaseType = regRes[4];

        if (regRes[5]) {
          preReleaseName = `${preReleaseType}.${parseInt(regRes[5], 10) + 1}`;
        } else {
          preReleaseName = `${preReleaseType}.0`;
        }

        console.log(`\x1b[31m[warning]\x1b[0m no prerelease-name supply, auto calculate prerelease-name \x1b[31m${preReleaseName}\x1b[0m`);
      } else {
        preReleaseName = `alpha.0`;
        preReleaseType = 'alpha';

        console.log('\x1b[31m[warning]\x1b[0m no prerelease-name supply, default to \x1b[31m alpha.0\x1b[0m')
      }
    }
  } else {
    console.log(`\x1b[31m[error]\x1b[0m preReleaseName: \x1b[31m ${preReleaseName} \x1b[0m 不符合规范，只允许 alpha.0 , beta.1, rc.3, hotfix.0 类似的格式 `)
  }

  if (preReleaseName && preReleaseType) {

    // 1. apply version and update version of package.json
    writePrereleaseVersion(checkAndUpdateNextBump(process.argv.slice(2)[1]), preReleaseName)

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
    spawnSync('sh', ['-c', `rush publish --publish --include-all --tag ${preReleaseType}`], {
      stdio: 'inherit',
      shell: false,
    });

    // 4. update version of local packages to shrinkwrap
    spawnSync('sh', ['-c', `rush update`], {
      stdio: 'inherit',
      shell: false,
    });

    if (package) {
      const pkgJsonPath = path.join( __dirname, '../../', package.projectFolder, 'package.json')
      const pkgJson = getPackageJson(pkgJsonPath)

      // 5. add the the changes
      spawnSync('sh', ['-c', `git add --all`], {
        stdio: 'inherit',
        shell: false,
      });

      // 6. commit all the changes
      spawnSync('sh', ['-c', `git commit -m "build: prerelease version ${pkgJson.version}"`], {
        stdio: 'inherit',
        shell: false,
      });
    }
  }
}

run()
