import { gateway } from 'ai';
import { run } from '../lib/run';

run(async () => {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Query spend grouped by day for the last 30 days
  console.log(`\n--- Spend by day (${thirtyDaysAgo} to ${today}) ---\n`);
  const byDay = await gateway.getSpendReport({
    startDate: thirtyDaysAgo,
    endDate: today,
  });

  for (const row of byDay.results) {
    console.log(
      `${row.day}: $${row.totalCost.toFixed(4)} (${row.requestCount ?? 0} requests)`,
    );
  }

  // Query spend grouped by model
  console.log(`\n--- Spend by model ---\n`);
  const byModel = await gateway.getSpendReport({
    startDate: thirtyDaysAgo,
    endDate: today,
    groupBy: 'model',
  });

  for (const row of byModel.results) {
    console.log(
      `${row.model}: $${row.totalCost.toFixed(4)} (${row.inputTokens ?? 0} in / ${row.outputTokens ?? 0} out)`,
    );
  }

  // Query spend filtered by the tags written by stream-text-with-tags example
  console.log(`\n--- Spend filtered by tag "feature:reporting-test" ---\n`);
  const byTag = await gateway.getSpendReport({
    startDate: thirtyDaysAgo,
    endDate: today,
    groupBy: 'tag',
    tags: ['feature:reporting-test'],
  });

  if (byTag.results.length === 0) {
    console.log(
      'No results. Run stream-text-with-tags.ts first to generate tagged data.',
    );
  }

  for (const row of byTag.results) {
    console.log(
      `${row.tag}: $${row.totalCost.toFixed(4)} (${row.requestCount ?? 0} requests)`,
    );
  }
});
