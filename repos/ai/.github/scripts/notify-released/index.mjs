// @ts-check

import { Octokit } from 'octokit';

const DRY_RUN = process.argv.includes('--dry-run');
const NPM_VERIFY_TIMEOUT_MS = parseInt(
  process.env.NPM_VERIFY_TIMEOUT_MS || '300000',
  10,
);
const NPM_POLL_INTERVAL_MS = 10000;

// --- Step 1: Validate inputs ---

const publishedPackages = JSON.parse(process.env.PUBLISHED_PACKAGES || 'null');
if (!Array.isArray(publishedPackages) || publishedPackages.length === 0) {
  console.log('No published packages found. Exiting.');
  process.exit(0);
}

const pullRequestNumber = parseInt(process.env.PULL_REQUEST_NUMBER, 10);
if (!pullRequestNumber) {
  throw new Error('PULL_REQUEST_NUMBER environment variable is required');
}

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  throw new Error('GITHUB_TOKEN environment variable is required');
}

const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'vercel/ai').split('/');

const octokit = new Octokit({ auth: githubToken });

console.log(
  `Processing release for PR #${pullRequestNumber} with ${publishedPackages.length} packages`,
);
for (const pkg of publishedPackages) {
  console.log(`  - ${pkg.name}@${pkg.version}`);
}

// --- Step 2: Verify all packages exist on npm ---

console.log('\nVerifying packages on npm...');

async function verifyPackageOnNpm(name, version) {
  const url = `https://registry.npmjs.org/${name}/${version}`;
  const response = await fetch(url);
  return response.ok;
}

const startTime = Date.now();
let allVerified = false;

while (Date.now() - startTime < NPM_VERIFY_TIMEOUT_MS) {
  const results = await Promise.all(
    publishedPackages.map(async pkg => ({
      ...pkg,
      exists: await verifyPackageOnNpm(pkg.name, pkg.version),
    })),
  );

  const missing = results.filter(r => !r.exists);
  if (missing.length === 0) {
    allVerified = true;
    console.log('All packages verified on npm.');
    break;
  }

  console.log(
    `Waiting for ${missing.length} package(s) to appear on npm: ${missing.map(m => `${m.name}@${m.version}`).join(', ')}`,
  );
  await new Promise(resolve => setTimeout(resolve, NPM_POLL_INTERVAL_MS));
}

if (!allVerified) {
  const results = await Promise.all(
    publishedPackages.map(async pkg => ({
      ...pkg,
      exists: await verifyPackageOnNpm(pkg.name, pkg.version),
    })),
  );
  const missing = results.filter(r => !r.exists);
  throw new Error(
    `Timed out waiting for packages on npm: ${missing.map(m => `${m.name}@${m.version}`).join(', ')}`,
  );
}

// --- Step 3: Parse release PR body to find commits ---

console.log(`\nFetching PR #${pullRequestNumber} body...`);

const { data: pr } = await octokit.rest.pulls.get({
  owner,
  repo,
  pull_number: pullRequestNumber,
});

if (!pr.body) {
  throw new Error(`PR #${pullRequestNumber} has no body`);
}

// Match direct changes: `-   <7-char-hash>: <message>`
const directCommitPattern = /^-\s+([0-9a-f]{7,}):\s/gm;
// Match dependency updates: `Updated dependencies [<7-char-hash>]`
const depUpdatePattern = /Updated dependencies \[([0-9a-f]{7,})\]/g;

const commitHashes = new Set();

for (const match of pr.body.matchAll(directCommitPattern)) {
  commitHashes.add(match[1]);
}
for (const match of pr.body.matchAll(depUpdatePattern)) {
  commitHashes.add(match[1]);
}

if (commitHashes.size === 0) {
  console.log('No commit hashes found in PR body. Exiting.');
  process.exit(0);
}

console.log(`Found ${commitHashes.size} unique commit hash(es):`);
for (const hash of commitHashes) {
  console.log(`  - ${hash}`);
}

// --- Step 4: Find PRs and closed issues for each commit ---

console.log('\nQuerying GitHub for associated PRs and issues...');

const commitAliases = [...commitHashes]
  .map(
    hash => `
    c_${hash}: object(expression: "${hash}") {
      ... on Commit {
        oid
        associatedPullRequests(first: 10) {
          nodes {
            number
            state
            mergeCommit { oid }
            repository { nameWithOwner }
            closingIssuesReferences(first: 50) {
              nodes {
                number
                repository { nameWithOwner }
              }
            }
          }
        }
      }
    }`,
  )
  .join('\n');

const query = `
  query($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      ${commitAliases}
    }
  }
`;

const graphqlResult = await octokit.graphql(query, { owner, name: repo });

const repoFullName = `${owner}/${repo}`;
const prNumbers = new Set();
const issueNumbers = new Set();

for (const hash of commitHashes) {
  const commitData = graphqlResult.repository[`c_${hash}`];
  if (!commitData?.associatedPullRequests?.nodes) continue;

  const commitOid = commitData.oid;

  for (const prNode of commitData.associatedPullRequests.nodes) {
    // Skip PRs from other repositories
    if (prNode.repository.nameWithOwner !== repoFullName) continue;
    // Skip the release PR itself
    if (prNode.number === pullRequestNumber) continue;
    // Only consider the PR that actually introduced this commit. GitHub's
    // associatedPullRequests also returns open PRs whose head branch happens
    // to contain the commit via base-branch ancestry (e.g. sibling backport
    // PRs branched off the same release branch after the commit landed).
    if (prNode.state !== 'MERGED') continue;
    if (prNode.mergeCommit?.oid !== commitOid) continue;

    prNumbers.add(prNode.number);

    if (prNode.closingIssuesReferences?.nodes) {
      for (const issueNode of prNode.closingIssuesReferences.nodes) {
        // Skip issues from other repositories
        if (issueNode.repository.nameWithOwner !== repoFullName) continue;
        issueNumbers.add(issueNode.number);
      }
    }
  }
}

console.log(
  `\nFound ${prNumbers.size} PR(s): ${[...prNumbers].join(', ') || '(none)'}`,
);
console.log(
  `Found ${issueNumbers.size} issue(s): ${[...issueNumbers].join(', ') || '(none)'}`,
);

// --- Step 5: Post comments ---

const packageTable = publishedPackages
  .map(pkg => {
    const tag = `${pkg.name}@${pkg.version}`;
    const githubReleaseUrl = `https://github.com/${owner}/${repo}/releases/tag/${encodeURIComponent(tag)}`;
    const npmUrl = `https://www.npmjs.com/package/${encodeURIComponent(pkg.name)}/v/${pkg.version}`;
    return `| \`${pkg.name}\` | ${pkg.version} [github](${githubReleaseUrl}) [npm](${npmUrl}) |`;
  })
  .join('\n');

const commentBody = `:rocket: Published in:

| Package | Version |
| --- | --- |
${packageTable}`;

const allNumbers = [...prNumbers, ...issueNumbers];

if (allNumbers.length === 0) {
  console.log('\nNo PRs or issues to comment on. Done.');
  process.exit(0);
}

console.log(`\nPosting comments on ${allNumbers.length} PR(s)/issue(s)...`);

for (const issueNumber of allNumbers) {
  if (DRY_RUN) {
    console.log(
      `[dry-run] Would comment on #${issueNumber}:\n${commentBody}\n`,
    );
    continue;
  }

  try {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: commentBody,
    });
    console.log(`Commented on #${issueNumber}`);
  } catch (error) {
    console.error(`Failed to comment on #${issueNumber}: ${error.message}`);
  }
}

console.log('\nDone.');
