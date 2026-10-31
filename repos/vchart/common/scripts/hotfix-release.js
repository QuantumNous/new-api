/**
 * prelease
 */

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const checkAndUpdateNextBump = require('./version-policies');
const getPackageJson = require('./get-package-json');
const writePrereleaseVersion = require('./set-prerelease-version');
const parseVersion = require('./parse-version');


function run() {
  let hotfixName = process.argv.slice(2)[0];
  let hotfixType = '';
  const cwd = process.cwd();
  const rushJson = getPackageJson(path.join(__dirname, '../../rush.json'));
  const package = rushJson.projects.find((project) => project.packageName === '@visactor/vchart');
  
  if (!package) {
    return;
  }
  const pkgJsonPath = path.join( __dirname, '../../', package.projectFolder, 'package.json')
  const pkgJson = getPackageJson(pkgJsonPath)
  const currentVersion = pkgJson.version;
  const preReleaseName = '';
  let regRes = null;

  if (typeof hotfixName === 'string' && hotfixName && (regRes = /^((hotfix)(?:\.(?:0|[1-9]))*)$/.exec(hotfixName))) {
    hotfixType = regRes[2];
    regRes = parseVersion(currentVersion);

  } else if (!hotfixName) {
    regRes = parseVersion(currentVersion)

    if (regRes.buildName) {
      hotfixType = regRes.buildType;

      if (regRes.hotfixName !== hotfixType) {
        hotfixName = `${hotfixType}.${parseInt(regRes.buildName, 10) + 1}`;
      } else {
        hotfixName = `${hotfixType}.0`;
      }

      console.log(`\x1b[31m[warning]\x1b[0m no hotfix-name supply, auto calculate hotfix-name \x1b[31m${hotfixName}\x1b[0m`);
    } else {
      hotfixName = `hotfix.0`;
      hotfixType = 'hotfix';

      console.log('\x1b[31m[warning]\x1b[0m no hotfix-name supply, default to \x1b[31m alpha.0\x1b[0m')
    }
  } else {
    console.log(`\x1b[31m[error]\x1b[0m hotfixName: \x1b[31m ${hotfixName} \x1b[0m 不符合规范，只允许 alpha.0 , beta.1, rc.3 类似的格式 `)
  }

  if (hotfixName && hotfixType) {

    // 1. apply version and update version of package.json
    writePrereleaseVersion('', '', currentVersion, hotfixName)

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
    spawnSync('sh', ['-c', `rush publish --publish --include-all --tag ${hotfixType}`], {
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
      spawnSync('sh', ['-c', `git commit -m "build: hotfix version ${pkgJson.version}"`], {
        stdio: 'inherit',
        shell: false,
      });
    }
  }
}

run()
