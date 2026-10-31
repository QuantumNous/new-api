const fs = require('fs')
const path = require('path')

function setChangelogOfHarmny() {
  const nextVersion = process.argv.slice(2)[0];
  const changelogContent = process.argv.slice(2)[1];
  const changelogPath = path.join(__dirname, '../../packages/harmony_vchart/library/CHANGELOG.md');
  let fileContent = fs.readFileSync(changelogPath, { encoding: 'utf-8' });

  fileContent = `
## ${nextVersion}

${changelogContent}

${fileContent}
`;

 fs.writeFileSync(fileContent, changelogPath)
}

module.exports = setChangelogOfHarmny;