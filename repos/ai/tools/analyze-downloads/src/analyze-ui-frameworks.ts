#!/usr/bin/env tsx

/**
 * Extracts the major version number from a version string.
 */
function getMajorVersion(version: string): number {
  const [versionPart] = version.split('-');
  const [major] = versionPart.split('.');
  return parseInt(major, 10);
}

/**
 * Gets the last N major versions from a list of versions.
 */
function getLastNMajorVersions(
  downloads: Record<string, number>,
  n: number,
): Set<number> {
  const majorVersions = new Set<number>();
  for (const version of Object.keys(downloads)) {
    majorVersions.add(getMajorVersion(version));
  }
  const sorted = Array.from(majorVersions).sort((a, b) => b - a);
  return new Set(sorted.slice(0, n));
}

/**
 * Aggregates download counts, only including the last N major releases.
 */
function aggregateDownloadsForLastNMajorReleases(
  downloads: Record<string, number>,
  n: number,
): number {
  const allowedMajors = getLastNMajorVersions(downloads, n);
  let total = 0;
  for (const [version, count] of Object.entries(downloads)) {
    if (allowedMajors.has(getMajorVersion(version))) {
      total += count;
    }
  }
  return total;
}

/**
 * Main execution function.
 */
async function main() {
  const packages = [
    '@ai-sdk/react',
    '@ai-sdk/svelte',
    '@ai-sdk/vue',
    '@ai-sdk/angular',
    '@ai-sdk/rsc',
  ];

  const results: Array<{
    package: string;
    'past week': number;
    '%': string;
  }> = [];

  console.log('Fetching download stats for UI framework packages...');
  console.log('Note: Only including the last 2 major releases.\n');

  try {
    for (const pkg of packages) {
      console.log(
        `Fetching stats from https://api.npmjs.org/versions/${pkg}/last-week ...`,
      );
      const response = await fetchWithRetry(
        `https://api.npmjs.org/versions/${encodeURIComponent(pkg)}/last-week`,
      );
      const data = await response.json();
      const filteredDownloads = aggregateDownloadsForLastNMajorReleases(
        data.downloads || {},
        2,
      );

      results.push({
        package: pkg,
        'past week': filteredDownloads,
        '%': '0%', // Initial placeholder
      });
    }

    // Calculate total downloads
    const totalDownloads = results.reduce(
      (sum, item) => sum + item['past week'],
      0,
    );

    // Update percentages
    results.forEach(item => {
      const percentage =
        totalDownloads > 0 ? (item['past week'] / totalDownloads) * 100 : 0;
      item['%'] = `${percentage.toFixed(1)}%`;
    });

    // Sort results by past week in descending order
    results.sort((a, b) => b['past week'] - a['past week']);

    console.log(
      `\nTotal downloads (last 2 major releases): ${totalDownloads.toLocaleString()}\n`,
    );
    console.table(results);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();

function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  backoff = 3000,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const attemptFetch = (n: number) => {
      fetch(url, options)
        .then(response => {
          if (!response.ok) {
            if (n > 0) {
              console.warn(
                `Fetch failed for ${url}. Retrying in ${backoff}ms... (${n} retries left)`,
              );
              setTimeout(() => attemptFetch(n - 1), backoff);
            } else {
              reject(
                new Error(`Failed to fetch ${url} after multiple attempts.`),
              );
            }
          } else {
            setTimeout(() => resolve(response), 1000);
          }
        })
        .catch(err => {
          if (n > 0) {
            console.warn(
              `Fetch error for ${url}: ${err}. Retrying in ${backoff}ms... (${n} retries left)`,
            );
            setTimeout(() => attemptFetch(n - 1), backoff);
          } else {
            reject(
              new Error(`Failed to fetch ${url} after multiple attempts.`),
            );
          }
        });
    };
    attemptFetch(retries);
  });
}
