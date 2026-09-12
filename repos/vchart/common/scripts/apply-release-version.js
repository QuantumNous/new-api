const writePrereleaseVersion = require('./set-prerelease-version');
const checkAndUpdateNextBump = require('./version-policies');
const parseVersion = require('./parse-version');


function run() {
  const preReleaseName = process.argv.slice(2)[0];
  const nextVersionOrNextBump = process.argv.slice(2)[1];
  const buildName = process.argv.slice(2)[2];
  const nextBump = checkAndUpdateNextBump(nextVersionOrNextBump);
  const parsedNextVersion = nextVersionOrNextBump ? parseVersion(nextVersionOrNextBump) : null;
  const nextVersion = parsedNextVersion ? `${parsedNextVersion.major}.${parsedNextVersion.minor}.${parsedNextVersion.patch}`: null;

  console.log('[apply prerelease version]: ', preReleaseName, nextBump, nextVersion);

  writePrereleaseVersion(nextBump, preReleaseName, nextVersion, buildName);
}

run()
