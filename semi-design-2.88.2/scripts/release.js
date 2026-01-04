const fs = require('fs');
const _ = require('lodash');
const github = require('@actions/github');
const { Octokit } = require('@octokit/rest');
const core = require('@actions/core');
const { info, error } = core;

const pathArr = process.env.CHANGELOG_PATH.replace(/ /g, '').split(',');

const { owner, repo } = github.context.repo;
const { ref: version } = github.context.payload;
const versionNo = version.substr(1); // 'v1.0.0' -> '1.0.0'

const genVersionChangeLog = (path, targetVersion) => {
    const changelogRaw = fs.readFileSync(path, 'utf-8');

    const lines = changelogRaw.split('\n');
    let changeLogLines = [];
    const stopPattern = /^#### /; // 前一个版本
    let begin = false;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (begin && stopPattern.test(line)) {
            break;
        }
        if (begin) {
            changeLogLines.push(line);
        }
        if (!begin) {
            if (line.startsWith('####')) {
                const versionReg = /.*((\d{1,2}\.){2}\d{1,2}(-\w+\.\d+)?)/;
                let result = versionReg.exec(line);
                begin = _.get(result, '1', '').trim().toLowerCase() === targetVersion;
            }
        }
    }
    return changeLogLines.join('\n');
};

async function main() {
    try {
        const versionChangelog = pathArr.map((path) => {
            let changelog = genVersionChangeLog(path, versionNo);
            return changelog;
        }).join('\n---\n');
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

        await octokit.repos.createRelease({
            owner,
            repo,
            tag_name: version,
            name: version,
            body: versionChangelog,
            prerelease: version.includes('beta'),
        });
        info(`${version} released`);
    } catch (err) {
        error(err);
    }
}

main();
