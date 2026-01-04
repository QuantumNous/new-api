const semver = require('semver');


const findLatestVersion = (versionSet) => {
    return [...versionSet].find(v => v === semver.coerce(v).raw);
};

const getAlphaVersion = (versionSet) => {
    // 1. 找到最新的正式版（不带 pre-release 的）
    const arr = Array.isArray(versionSet) ? versionSet : [...versionSet];
    const validVersions = arr.filter(v => semver.valid(v));
    validVersions.sort(semver.rcompare);
    const latestStable = validVersions.find(v => !semver.prerelease(v));
    // 2. 计算下一个 minor 的 alpha.0
    const nextMinor = semver.inc(latestStable, 'minor');
    let nextAlpha = `${nextMinor}-alpha.0`;
    // 3. 如果已存在，则递增 alpha 号
    while (versionSet.has(nextAlpha)) {
        // 取当前 alpha 号，递增
        nextAlpha = semver.inc(nextAlpha, 'prerelease', 'alpha');
    }
    return nextAlpha;
};

const getBetaVersion = (versionSet) => {
    const latestVersion = findLatestVersion(versionSet);
    let nextVersion = semver.inc(latestVersion, 'preminor', 'beta');
    while (versionSet.has(nextVersion)) {
        nextVersion = semver.inc(nextVersion, 'prerelease', 'beta');
    }
    return nextVersion;
};

const getHotfixVersion = (versionSet) => {
    const latestVersion = findLatestVersion(versionSet);
    let nextVersion = semver.inc(latestVersion, 'prepatch', 'beta');
    while (versionSet.has(nextVersion)) {
        nextVersion = semver.inc(nextVersion, 'prerelease', 'beta');
    }
    return nextVersion;
};

const getMinorVersion = (versionSet) => {
    const latestVersion = findLatestVersion(versionSet);
    const nextVersion = semver.inc(latestVersion, 'minor');
    return nextVersion;
};

const getPatchVersion = (versionSet) => {
    const latestVersion = findLatestVersion(versionSet);
    const nextVersion = semver.inc(latestVersion, 'patch');
    return nextVersion;
};


const generateVersions = (versionSet, releaseType) => {
    switch (releaseType) {
        case "minor":
            return getMinorVersion(versionSet);
        case "patch":
            return getPatchVersion(versionSet);
        case "alpha":
            return getAlphaVersion(versionSet);
        case "beta":
            return getBetaVersion(versionSet);
        case "hotfix":
            return getHotfixVersion(versionSet);
        default:
            return '';
    }
};


function main() {
    const versionList = JSON.parse(process.env.VERSION_LIST);
    const releaseType = process.env.RELEASE_TYPE;
    const sortedVersionList = versionList.sort(semver.rcompare);
    const sortedVersionSet = new Set(sortedVersionList);
    return generateVersions(sortedVersionSet, releaseType);
}

console.log(main());
