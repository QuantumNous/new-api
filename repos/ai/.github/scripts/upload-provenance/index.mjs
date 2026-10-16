// @ts-check

// Attaches SLSA provenance to each freshly published package's GitHub Release
// as an `*.intoto.jsonl` asset.
//
// We already publish every package to npm with provenance enabled
// (`publishConfig.provenance: true`), so the npm registry hosts a Sigstore
// bundle containing the SLSA provenance attestation for each package version.
// However, the OSSF Scorecard "Signed-Releases" check only inspects GitHub
// Release assets (looking for files such as `*.intoto.jsonl`); it does not read
// npm registry attestations. This script bridges that gap by downloading the
// attestations npm already generated and re-attaching them to the matching
// GitHub Release so the check can find them.
//
// This is best-effort: a failure to attach provenance for a package never fails
// the release. Problems are logged and summarized at the end.

import { Octokit } from 'octokit';

const DRY_RUN = process.argv.includes('--dry-run');
// npm publishes the package tarball and its attestation separately, so the
// attestation can lag slightly behind the package being installable.
const ATTESTATION_TIMEOUT_MS = parseInt(
  process.env.ATTESTATION_TIMEOUT_MS || '300000',
  10,
);
const ATTESTATION_POLL_INTERVAL_MS = 10000;
// Changesets creates the GitHub Releases as part of the publish step, but the
// release for a given tag may not be queryable the instant this script runs.
const RELEASE_LOOKUP_TIMEOUT_MS = parseInt(
  process.env.RELEASE_LOOKUP_TIMEOUT_MS || '120000',
  10,
);
const RELEASE_POLL_INTERVAL_MS = 5000;

// --- Validate inputs ---

const publishedPackages = JSON.parse(process.env.PUBLISHED_PACKAGES || 'null');
if (!Array.isArray(publishedPackages) || publishedPackages.length === 0) {
  console.log('No published packages found. Exiting.');
  process.exit(0);
}

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  throw new Error('GITHUB_TOKEN environment variable is required');
}

const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'vercel/ai').split('/');

const octokit = new Octokit({ auth: githubToken });

console.log(
  `Attaching provenance for ${publishedPackages.length} published package(s)`,
);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch the Sigstore attestation bundles npm generated for a package version
 * and turn them into in-toto JSON Lines. Each line is one DSSE envelope, which
 * is the format Scorecard / slsa-verifier expect from an `*.intoto.jsonl` file.
 *
 * @returns {Promise<string | null>} the `.intoto.jsonl` contents, or null if no
 * attestation is available before the timeout.
 */
async function fetchProvenanceJsonl(name, version) {
  const url = `https://registry.npmjs.org/-/npm/v1/attestations/${name}@${version}`;
  const startTime = Date.now();

  while (Date.now() - startTime < ATTESTATION_TIMEOUT_MS) {
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      const envelopes = (data.attestations || [])
        .map(a => a?.bundle?.dsseEnvelope)
        .filter(Boolean);

      if (envelopes.length > 0) {
        return envelopes.map(env => JSON.stringify(env)).join('\n') + '\n';
      }
    }

    console.log(
      `  Waiting for attestation of ${name}@${version} to appear on npm...`,
    );
    await sleep(ATTESTATION_POLL_INTERVAL_MS);
  }

  return null;
}

/**
 * Look up the GitHub Release for a changesets tag (`<name>@<version>`),
 * retrying until it exists or the timeout elapses.
 *
 * @returns {Promise<{ id: number, html_url: string, assets: Array<{ name: string }> } | null>}
 */
async function findReleaseByTag(tag) {
  const startTime = Date.now();

  while (Date.now() - startTime < RELEASE_LOOKUP_TIMEOUT_MS) {
    try {
      const { data } = await octokit.rest.repos.getReleaseByTag({
        owner,
        repo,
        tag,
      });
      return data;
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    await sleep(RELEASE_POLL_INTERVAL_MS);
  }

  return null;
}

// --- Process each package ---

const failures = [];

for (const pkg of publishedPackages) {
  const tag = `${pkg.name}@${pkg.version}`;
  // Scoped names contain a slash; flatten it for the asset filename.
  const assetName = `${pkg.name.replace(/[@/]/g, '-').replace(/^-/, '')}-${pkg.version}.intoto.jsonl`;
  console.log(`\n${tag}`);

  const jsonl = await fetchProvenanceJsonl(pkg.name, pkg.version);
  if (!jsonl) {
    console.warn(`  No attestation found within timeout. Skipping.`);
    failures.push(`${tag} (no attestation)`);
    continue;
  }

  const release = await findReleaseByTag(tag);
  if (!release) {
    console.warn(`  No GitHub Release found for tag within timeout. Skipping.`);
    failures.push(`${tag} (no release)`);
    continue;
  }

  if (release.assets.some(asset => asset.name === assetName)) {
    console.log(`  Provenance asset already attached. Skipping.`);
    continue;
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] Would upload ${assetName} to ${release.html_url}`);
    continue;
  }

  try {
    await octokit.rest.repos.uploadReleaseAsset({
      owner,
      repo,
      release_id: release.id,
      name: assetName,
      // Octokit accepts a string body for the asset data.
      data: jsonl,
      headers: {
        'content-type': 'application/jsonl',
        'content-length': Buffer.byteLength(jsonl),
      },
    });
    console.log(`  Uploaded ${assetName}`);
  } catch (error) {
    console.warn(`  Failed to upload asset: ${error.message}`);
    failures.push(`${tag} (upload failed)`);
  }
}

// --- Summary ---

if (failures.length > 0) {
  console.warn(
    `\nProvenance not attached for ${failures.length} package(s):\n  ${failures.join('\n  ')}`,
  );
} else {
  console.log('\nProvenance attached to all published releases.');
}

// Best-effort: never fail the release because of provenance upload issues.
process.exit(0);
