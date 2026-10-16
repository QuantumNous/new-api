/* eslint-disable @typescript-eslint/no-require-imports */
const { Extractor, ExtractorConfig } = require('@microsoft/api-extractor');
const fs = require('fs');
const path = require('path');

/**
 * Command which developers need to run to generate an updated API report.
 */
const API_EXTRACTOR_YARN_COMMAND = 'pnpm api-extractor:build';

const config = loadExtractorConfig();
checkReportMatchesApi(config);
checkNoErrorsAndWarnings(config);
checkLineEndings(config);

/**
 * Runs the API Extractor to check if the API report matches the API.
 * Exits with status code 1 if it does not match.
 * @param config {ExtractorConfig}
 */
function checkReportMatchesApi(config) {
  const result = Extractor.invoke(config, {
    localBuild: false, // validate report, fail on warnings or errors
    messageCallback: (message) => {
      // suppress all error or warnings
      message.handled = true;
    },
  });

  if (result.apiReportChanged) {
    exit(
      `The API Extractor report does not match the exported API.`,
      `Please run \`${API_EXTRACTOR_YARN_COMMAND}\` to generate an`,
      `updated report and commit it.`,
    );
  }
}

/**
 * Runs the API Extractor.
 * Exits with status code 1 if API Extractor reports any warnings or errors.
 * @param config {ExtractorConfig}
 */
function checkNoErrorsAndWarnings(config) {
  const result = Extractor.invoke(config, {
    localBuild: false, // validate report, fail on warnings or errors,
  });

  if (!result.succeeded) {
    exit(
      `API Extractor completed with ${result.errorCount} errors and`,
      `${result.warningCount} warnings.`,
    );
  }
}

/**
 * Checks the line endings of the API extractor report.
 * Exits with status code 1 if the line endings don't match the
 * API Extractor config.
 * @param config {ExtractorConfig}
 */
function checkLineEndings(config) {
  const report = fs.readFileSync(config.reportFilePath);

  const LF = '\n';
  const CRLF = '\r\n';

  const containsLf = report.includes(LF);
  const containsCrLf = report.includes(CRLF);

  const relativeReportPath = path.relative(
    process.cwd(),
    config.reportFilePath,
  );

  if (config.newlineKind === LF && containsCrLf) {
    exit(
      `${relativeReportPath} contains CRLF.`,
      `Please convert its line endings to LF.`,
    );
  }
  if (config.newlineKind === CRLF && containsLf && !containsCrLf) {
    exit(
      `${relativeReportPath} contains LF.`,
      `Please convert its line endings to CRLF.`,
    );
  }
}

/**
 * Finds and loads the API Extractor config relative to the
 * current working directory.
 * @returns {ExtractorConfig}
 */
function loadExtractorConfig() {
  const rawConfig = ExtractorConfig.tryLoadForFolder({
    startingFolder: process.cwd(),
  });
  if (!rawConfig) {
    exit(
      `No API Extractor config could be found for the`,
      `current working directory.`,
    );
  }
  return ExtractorConfig.prepare(rawConfig);
}

/**
 * Surrounds the message with control characters to display red text on a
 * terminal.
 * See {@link https://www.lihaoyi.com/post/BuildyourownCommandLinewithANSIescapecodes.html}
 * @param message {string}
 */
function red(message) {
  return `\u001b[31m${message}\u001b[0m`;
}

/**
 * Prints a failure reason and exits the process with status code 1.
 * @param message {string}
 */
function exit(...message) {
  /* eslint-disable-next-line no-console */
  console.log(`${red('FAILURE REASON')} ${message.join(' ')}`);
  process.exit(1);
}
