const fs = require('fs');
const packageJsonPath = __dirname + '/../package.json';
const nightlyPackageName = 'zrender-nightly';

function updateVersion(version) {
    const isNext = process.argv.includes('--next');
    const parts = /(\d+)\.(\d+)\.(\d+)($|\-)/.exec(version);
    if (!parts) {
        throw new Error(`Invalid version number ${version}`);
    }
    // Add date to version.
    const major = +parts[1];
    let minor = +parts[2];
    let patch = +parts[3];
    const isStable = !parts[4];
    if (isStable) {
        // It's previous stable version. Dev version should be higher.
        if (isNext) {
            // Increase minor version for next branch.
            minor++;
            patch = 0;
        }
        else {
            // Increase main version for master branch.
            patch++;
        }
    }

    const date = new Date().toISOString().replace(/:|T|\.|-/g, '').slice(0, 8);
    return `${major}.${minor}.${patch}-dev.${date}`;
}


const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
packageJson.name = nightlyPackageName;
packageJson.version = updateVersion(packageJson.version);

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');