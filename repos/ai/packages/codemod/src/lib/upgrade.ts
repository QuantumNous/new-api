import debug from 'debug';
import { transform, type TransformErrors } from './transform';
import type { TransformOptions } from './transform-options';
import { SingleBar, Presets } from 'cli-progress';

const bundle = [
  'v4/remove-ai-stream-methods-from-stream-text-result',
  'v4/remove-anthropic-facade',
  'v4/remove-await-streamobject',
  'v4/remove-await-streamtext',
  'v4/remove-deprecated-provider-registry-exports',
  'v4/remove-experimental-ai-fn-exports',
  'v4/remove-experimental-message-types',
  'v4/remove-experimental-streamdata',
  'v4/remove-experimental-tool',
  'v4/remove-experimental-useassistant',
  'v4/remove-google-facade',
  'v4/remove-isxxxerror',
  'v4/remove-metadata-with-headers',
  'v4/remove-mistral-facade',
  'v4/remove-openai-facade',
  'v4/rename-format-stream-part',
  'v4/rename-parse-stream-part',
  'v4/replace-baseurl',
  'v4/replace-continuation-steps',
  'v4/replace-langchain-toaistream',
  'v4/replace-nanoid',
  'v4/replace-roundtrips-with-maxsteps',
  'v4/replace-token-usage-types',
  'v4/rewrite-framework-imports',
  'v5/flatten-streamtext-file-properties',
  'v5/import-LanguageModelV2-from-provider-package',
  'v5/migrate-to-data-stream-protocol-v2',
  'v5/move-image-model-maxImagesPerCall',
  'v5/move-langchain-adapter',
  'v5/move-maxsteps-to-stopwhen',
  'v5/move-provider-options',
  'v5/move-react-to-ai-sdk',
  'v5/move-ui-utils-to-ai',
  'v5/remove-experimental-wrap-language-model',
  'v5/remove-get-ui-text',
  'v5/remove-openai-compatibility',
  'v5/remove-sendExtraMessageFields',
  'v5/rename-converttocoremessages-to-converttomodelmessages',
  'v5/rename-core-message-to-model-message',
  'v5/rename-datastream-methods-to-uimessage',
  'v5/rename-datastream-transform-stream',
  'v5/rename-IDGenerator-to-IdGenerator',
  'v5/replace-datastream-to-uimessagestream',
  'v5/rename-languagemodelv1providermetadata',
  'v5/rename-max-tokens-to-max-output-tokens',
  'v5/rename-message-to-ui-message',
  'v5/rename-mime-type-to-media-type',
  'v5/rename-pipedatastreamtoresponse-to-pipeuimessagestreamtoresponse',
  'v5/rename-reasoning-properties',
  'v5/rename-reasoning-to-reasoningText',
  'v5/rename-request-options',
  'v5/rename-todatastreamresponse-to-touimessagestreamresponse',
  'v5/rename-tool-parameters-to-inputschema',
  'v5/replace-bedrock-snake-case',
  'v5/replace-fal-snake-case',
  'v5/replace-content-with-parts',
  'v5/replace-experimental-provider-metadata',
  'v5/replace-image-type-with-file-type',
  'v5/replace-llamaindex-adapter',
  'v5/replace-oncompletion-with-onfinal',
  'v5/replace-provider-metadata-with-provider-options',
  'v5/replace-rawresponse-with-response',
  'v5/replace-redacted-reasoning-type',
  'v5/replace-simulate-streaming',
  'v5/replace-textdelta-with-text',
  'v5/replace-usage-token-properties',
  'v5/replace-usechat-api-with-transport',
  'v5/replace-usechat-input-with-state',
  'v5/replace-zod-import-with-v3',
  'v5/require-createIdGenerator-size-argument',
  'v5/restructure-file-stream-parts',
  'v5/restructure-source-stream-parts',
  'v5/rsc-package',
  'v5/move-tool-invocations-to-parts',
  'v5/not-implemented/pattern',
  'v5/rename-addtoolresult-to-addtooloutput',
  'v6/rename-text-embedding-to-embedding',
  'v6/rename-mock-v2-to-v3',
  'v6/rename-tool-call-options-to-tool-execution-options',
  'v6/rename-core-message-to-model-message',
  'v6/rename-converttocoremessages-to-converttomodelmessages',
  'v6/rename-vertex-provider-metadata-key',
  'v6/wrap-tomodeloutput-parameter',
  'v6/add-await-converttomodelmessages',
  'v7/remove-experimental-custom-provider',
  'v7/remove-experimental-generate-image',
  'v7/replace-experimental-output-with-output',
  'v7/remove-experimental-prepare-step',
  'v7/replace-cached-input-tokens',
  'v7/replace-reasoning-tokens',
  'v7/remove-experimental-active-tools',
  'v7/remove-tool-call-options-type',
  'v7/remove-is-tool-or-dynamic-tool-uipart',
  'v7/remove-media-content-part-type',
  'v7/replace-anthropic-cache-creation-input-tokens',
  'v7/rename-experimental-transcribe',
  'v7/rename-experimental-generate-speech',
  'v7/rename-call-settings-type',
  'v7/rename-step-count-is',
  'v7/rename-system-to-instructions',
  'v7/rename-experimental-on-start-to-on-start',
  'v7/rename-experimental-on-step-start-to-on-step-start',
  'v7/rename-on-finish-to-on-end',
  'v7/rename-on-step-finish-to-on-step-end',
  'v7/rename-experimental-on-finish-to-on-end',
  'v7/rename-experimental-telemetry-to-telemetry',
  'v7/rename-on-rerank-finish-to-on-rerank-end',
  'v7/rename-on-embed-finish-to-on-embed-end',
  'v7/rename-full-stream-to-stream',
  'v7/move-include-raw-chunks-to-include',
  'v7/rename-experimental-include-to-include',
  'v7/rename-experimental-on-tool-call-start-to-on-tool-execution-start',
  'v7/rename-experimental-on-tool-call-finish-to-on-tool-execution-end',
  'v7/rename-experimental-context-to-context',
  'v7/rename-google-generative-ai-to-google',
  'v7/replace-image-message-part-with-file',
];

const log = debug('codemod:upgrade');
const error = debug('codemod:upgrade:error');

// Extract versioned codemods from the bundle
const v4Bundle = bundle.filter(codemod => codemod.startsWith('v4/'));
const v5Bundle = bundle.filter(codemod => codemod.startsWith('v5/'));
const v6Bundle = bundle.filter(codemod => codemod.startsWith('v6/'));
const v7Bundle = bundle.filter(codemod => codemod.startsWith('v7/'));

function runCodemods(
  codemods: string[],
  options: TransformOptions,
  versionLabel: string,
) {
  const cwd = process.cwd();
  log(`Starting ${versionLabel} codemods...`);
  const modCount = codemods.length;
  const bar = new SingleBar(
    {
      format: 'Progress |{bar}| {percentage}% | ETA: {eta}s || {codemod}',
      hideCursor: true,
    },
    Presets.shades_classic,
  );
  bar.start(modCount, 0, { codemod: 'Starting...' });
  const allErrors: TransformErrors = [];
  let notImplementedAvailable = false;
  for (const [_index, codemod] of codemods.entries()) {
    const { errors, notImplementedErrors } = transform(codemod, cwd, options, {
      logStatus: false,
    });
    allErrors.push(...errors);
    if (notImplementedErrors.length > 0) {
      notImplementedAvailable = true;
    }
    bar.increment(1, { codemod });
  }
  bar.stop();

  if (allErrors.length > 0) {
    log(
      `Some ${versionLabel} codemods did not apply successfully to all files. Details:`,
    );
    allErrors.forEach(({ transform, filename, summary }) => {
      error(`codemod=${transform}, path=${filename}, summary=${summary}`);
    });
  }

  if (notImplementedAvailable) {
    log(
      `Some ${versionLabel} codemods require manual changes. Please search your codebase for \`FIXME(@ai-sdk-upgrade-v5): \` comments and follow the instructions to complete the upgrade.`,
    );
  }

  log(`${versionLabel} codemods complete.`);
}

export function upgradeV4(options: TransformOptions) {
  runCodemods(v4Bundle, options, 'v4');
}

export function upgradeV5(options: TransformOptions) {
  runCodemods(v5Bundle, options, 'v5');
}

export function upgradeV6(options: TransformOptions) {
  runCodemods(v6Bundle, options, 'v6');
}

export function upgradeV7(options: TransformOptions) {
  runCodemods(v7Bundle, options, 'v7');
}

export function upgrade(options: TransformOptions) {
  const cwd = process.cwd();
  log('Starting upgrade...');
  const modCount = bundle.length;
  const bar = new SingleBar(
    {
      format: 'Progress |{bar}| {percentage}% | ETA: {eta}s || {codemod}',
      hideCursor: true,
    },
    Presets.shades_classic,
  );
  bar.start(modCount, 0, { codemod: 'Starting...' });
  const allErrors: TransformErrors = [];
  let notImplementedAvailable = false;
  for (const [_index, codemod] of bundle.entries()) {
    const { errors, notImplementedErrors } = transform(codemod, cwd, options, {
      logStatus: false,
    });
    allErrors.push(...errors);
    if (notImplementedErrors.length > 0) {
      notImplementedAvailable = true;
    }
    bar.increment(1, { codemod });
  }
  bar.stop();

  if (allErrors.length > 0) {
    log('Some codemods did not apply successfully to all files. Details:');
    allErrors.forEach(({ transform, filename, summary }) => {
      error(`codemod=${transform}, path=${filename}, summary=${summary}`);
    });
  }

  if (notImplementedAvailable) {
    log(
      'Some codemods require manual changes. Please search your codebase for `FIXME(@ai-sdk-upgrade-v5): ` comments and follow the instructions to complete the upgrade.',
    );
  }

  log('Upgrade complete.');
}
