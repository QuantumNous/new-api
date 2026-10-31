#!/usr/bin/env tsx

/**
 * Main execution function.
 */
async function main() {
  // Map of group name to list of npm packages
  const packageGroups: Record<string, string[]> = {
    'AI SDK': ['ai'],
    OpenAI: ['openai'],
    Anthropic: ['@anthropic-ai/sdk'],
    LangChain: ['@langchain/core'],
    'AWS Bedrock': ['@aws-sdk/client-bedrock-runtime'],
    Google: [
      '@google/generative-ai',
      '@google/genai',
      '@google-cloud/vertexai',
    ],
    Transformers: ['@xenova/transformers'],
    Mistral: ['@mistralai/mistralai'],
    LlamaIndex: ['llamaindex'],
    Instructor: ['@instructor-ai/instructor'],
    TogetherAI: ['together-ai'],
    'Effect AI': ['@effect/ai'],
    'TanStack AI': ['@tanstack/ai'],
    xsai: [
      '@xsai/generate-text',
      '@xsai/generate-object',
      '@xsai/generate-image',
      '@xsai/generate-speech',
      '@xsai/generate-transcription',
      '@xsai/stream-text',
      '@xsai/stream-object',
      '@xsai/stream-transcription',
      '@xsai/embed',
    ],
    'pi-ai': ['@mariozechner/pi-ai'],
    OpenRouter: ['@openrouter/sdk'],
    Mastra: ['@mastra/core'],
  };

  // Helper for flattened package to group map
  const packageToGroup: Record<string, string> = {};
  for (const [group, pkgs] of Object.entries(packageGroups)) {
    for (const pkg of pkgs) packageToGroup[pkg] = group;
  }

  type Row = {
    group: string;
    'past week': number;
    previous: number;
    diff: number;
    '%': string;
    'previous %': string;
    'diff %': string;
  };

  const rows: Row[] = [];

  // timestamps
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterdayTimestamp = d.toISOString().split('T')[0];
  d.setDate(d.getDate() - 6);
  const sevenDaysAgoTimestamp = d.toISOString().split('T')[0];
  d.setDate(d.getDate() - 1);
  const eightDaysAgoTimestamp = d.toISOString().split('T')[0];
  d.setDate(d.getDate() - 6);
  const fourteenDaysAgoTimestamp = d.toISOString().split('T')[0];

  console.log(
    `Fetching download stats from ${sevenDaysAgoTimestamp} to ${yesterdayTimestamp} and ${fourteenDaysAgoTimestamp} to ${eightDaysAgoTimestamp}...`,
  );

  try {
    // Map from group to download sums etc.
    const groupStats: Record<
      string,
      {
        'past week': number;
        previous: number;
        packages: string[];
      }
    > = {};

    for (const [group, pkgs] of Object.entries(packageGroups)) {
      let pastWeekSum = 0;
      let prevWeekSum = 0;
      for (const pkg of pkgs) {
        const responseLastWeek = await fetchWithRetry(
          `https://api.npmjs.org/downloads/point/${sevenDaysAgoTimestamp}:${yesterdayTimestamp}/${pkg}`,
        );
        const dataLastWeek = await responseLastWeek.json();
        const responsePrevWeek = await fetchWithRetry(
          `https://api.npmjs.org/downloads/point/${fourteenDaysAgoTimestamp}:${eightDaysAgoTimestamp}/${pkg}`,
        );
        const dataPrevWeek = await responsePrevWeek.json();
        pastWeekSum += dataLastWeek.downloads || 0;
        prevWeekSum += dataPrevWeek.downloads || 0;
      }
      groupStats[group] = {
        'past week': pastWeekSum,
        previous: prevWeekSum,
        packages: pkgs,
      };
    }

    // Calculate totals
    const totalPast = Object.values(groupStats).reduce(
      (sum, v) => sum + v['past week'],
      0,
    );
    const totalPrev = Object.values(groupStats).reduce(
      (sum, v) => sum + v.previous,
      0,
    );

    // Compose row objects
    for (const [group, stat] of Object.entries(groupStats)) {
      const diff = stat['past week'] - stat.previous;
      const pastWeekPct =
        totalPast > 0 ? (stat['past week'] / totalPast) * 100 : 0;
      const prevPct = totalPrev > 0 ? (stat.previous / totalPrev) * 100 : 0;
      const diffPct = pastWeekPct - prevPct;
      rows.push({
        group,
        'past week': stat['past week'],
        previous: stat.previous,
        diff,
        '%': `${pastWeekPct.toFixed(1)}%`,
        'previous %': `${prevPct.toFixed(1)}%`,
        'diff %': `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%`,
      });
    }

    // Sort by latest week downloads descending
    rows.sort((a, b) => b['past week'] - a['past week']);

    console.table(rows);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();

function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 5,
  backoff = 10000,
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
            resolve(response);
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
