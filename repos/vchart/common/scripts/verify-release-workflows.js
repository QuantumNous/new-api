const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '..', '..');
const workflowsDir = path.join(root, '.github', 'workflows');

function loadWorkflow(fileName) {
  const filePath = path.join(workflowsDir, fileName);
  const content = fs.readFileSync(filePath, 'utf8');
  return {
    fileName,
    content,
    data: yaml.load(content)
  };
}

function getOn(workflow) {
  return workflow.data.on || workflow.data['on'];
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function assertArrayIncludes(array, expected, context) {
  assert(Array.isArray(array), `${context} must be an array`);
  expected.forEach(item => {
    assert(array.includes(item), `${context} must include ${item}`);
  });
}

function getStep(workflow, jobName, stepName) {
  const steps = workflow.data.jobs[jobName].steps || [];
  return steps.find(step => step.name === stepName);
}

function getSteps(workflow, jobName) {
  return workflow.data.jobs[jobName].steps || [];
}

function assertUsesPublishablePackageSet(step, context) {
  assert(step && typeof step.run === 'string', `${context} step must exist`);
  assert(step.run.includes("JSON.parse(fs.readFileSync('rush.json', 'utf8'))"), `${context} must read rush.json`);
  assert(step.run.includes('project.shouldPublish'), `${context} must check every publishable Rush project`);
  assert(step.run.includes('Partial npm publish detected'), `${context} must fail on partial npm publication`);
  assert(step.run.includes('${missing[*]}'), `${context} must report missing packages`);
  assert(step.run.includes('${existing[*]}'), `${context} must report existing packages`);
}

function assertFallbackGhToken(step, context) {
  assert(step && step.env && step.env.GH_TOKEN === '${{ secrets.CREATE_TAG_RELEASE_TOKEN || github.token }}', `${context} must use PAT fallback GH_TOKEN`);
}

function assertStepIfIncludes(step, expected, context) {
  assert(step, `${context} step must exist`);
  assert(typeof step.if === 'string' && step.if.includes(expected), `${context} if must include ${expected}`);
}

function assertRunIncludes(step, expected, context) {
  assert(step && typeof step.run === 'string', `${context} step must exist`);
  assert(step.run.includes(expected), `${context} must include ${expected}`);
}

function run() {
  const release = loadWorkflow('release.yml');
  const postRelease = loadWorkflow('post-release.yml');
  const syncMain = loadWorkflow('sync-main-to-develop.yml');
  const developDispatch = loadWorkflow('develop-synced-dispatch.yml');

  const releaseOn = getOn(release);
  assert(hasOwn(releaseOn, 'workflow_dispatch'), 'release.yml must support workflow_dispatch for manual recovery');
  assert(
    release.data.jobs.release.if &&
      release.data.jobs.release.if.includes("github.event_name == 'workflow_dispatch'") &&
      release.data.jobs.release.if.includes("startsWith(github.ref_name, 'release/')") &&
      release.data.jobs.release.if.includes("startsWith(github.ref_name, 'hotfix/')") &&
      release.data.jobs.release.if.includes("startsWith(github.ref_name, 'pre-release/')"),
    'release.yml release job must allow manual recovery and guard automatic runs to release/hotfix/pre-release branches'
  );
  assertArrayIncludes(
    releaseOn.push.branches,
    ['release/**', 'hotfix/**', 'pre-release/**'],
    'release.yml push branches'
  );
  const validateBranchStep = getStep(release, 'release', 'Validate release branch name');
  assert(validateBranchStep && typeof validateBranchStep.run === 'string', 'release.yml must validate release branch names in the job');
  assert(
    validateBranchStep.run.includes('^release/[0-9]+\\.[0-9]+\\.[0-9]+$') &&
      validateBranchStep.run.includes('^hotfix/[0-9]+\\.[0-9]+\\.[0-9]+$') &&
      validateBranchStep.run.includes('^pre-release/[0-9]+\\.[0-9]+\\.[0-9]+-(alpha|beta|rc|hotfix)\\.[0-9]+$') &&
      validateBranchStep.run.includes('For workflow_dispatch recovery'),
    'release.yml branch validation must enforce documented semver branch names and explain manual recovery refs'
  );
  assert(
    release.data.jobs.release.strategy.matrix['node-version'].length === 1 &&
      release.data.jobs.release.strategy.matrix['node-version'][0] === '22.x',
    'release.yml must use Node 22.x for npm trusted publishing'
  );
  const updateNpmStep = getStep(release, 'release', 'Update npm');
  assert(
    updateNpmStep && updateNpmStep.run === 'npm install -g npm@^11.5.1',
    'release.yml must use the npm 11 line required for trusted publishing'
  );
  assert(getStep(release, 'release', 'Check npm version (release)'), 'release.yml must check npm before stable publish');
  assertUsesPublishablePackageSet(getStep(release, 'release', 'Check npm version (release)'), 'release npm check');
  assertUsesPublishablePackageSet(getStep(release, 'release', 'Check npm version (hotfix)'), 'hotfix npm check');
  assertUsesPublishablePackageSet(getStep(release, 'release', 'Check npm version (pre-release)'), 'pre-release npm check');
  assertStepIfIncludes(
    getStep(release, 'release', 'Publish to npm (release)'),
    "steps.npm_version_release.outputs.skip_publish != 'true'",
    'release.yml stable publish'
  );
  assertStepIfIncludes(
    getStep(release, 'release', 'Publish to npm (hotfix)'),
    "steps.npm_version_hotfix.outputs.skip_publish != 'true'",
    'release.yml hotfix publish'
  );
  assertStepIfIncludes(
    getStep(release, 'release', 'Publish to npm (pre-release)'),
    "steps.npm_version_prerelease.outputs.skip_publish != 'true'",
    'release.yml pre-release publish'
  );
  const releasePolicyStep = getStep(release, 'release', 'Check version-policy version (release)');
  assertRunIncludes(releasePolicyStep, "common/config/rush/version-policies.json", 'release.yml version-policy check');
  assertRunIncludes(releasePolicyStep, 'skip_next_bump', 'release.yml version-policy check');
  assertStepIfIncludes(
    getStep(release, 'release', 'update nextBump (release)'),
    "steps.release_version_policy.outputs.skip_next_bump != 'true'",
    'release.yml update nextBump'
  );
  assertRunIncludes(
    getStep(release, 'release', 'Reset version-policy base version (release)'),
    "packages/vchart/package.json",
    'release.yml reset version-policy base'
  );
  assert(
    release.content.includes('rm -rf .changelog') && release.content.includes("find docs/assets/changelog -name '*.bak' -delete"),
    'release.yml must delete temporary changelog files before committing'
  );

  const postReleaseOn = getOn(postRelease);
  assertArrayIncludes(postReleaseOn.repository_dispatch.types, ['develop-synced'], 'post-release.yml repository_dispatch types');
  assert(hasOwn(postReleaseOn, 'workflow_dispatch'), 'post-release.yml must keep workflow_dispatch recovery');
  assert(
    postRelease.content.includes('PAYLOAD_VERSION') && postRelease.content.includes('INPUT_VERSION'),
    'post-release.yml must read version from repository_dispatch payload or workflow_dispatch input'
  );
  assertRunIncludes(
    getStep(postRelease, 'post_release', 'Read version from event payload or workflow_dispatch input'),
    '^[0-9]+\\.[0-9]+\\.[0-9]+$',
    'post-release.yml version input validation'
  );
  getSteps(postRelease, 'post_release')
    .filter(step => step.env && Object.prototype.hasOwnProperty.call(step.env, 'GH_TOKEN'))
    .forEach(step => assertFallbackGhToken(step, `post-release ${step.name}`));
  assert(!postRelease.content.includes('GH_PAT'), 'post-release.yml must not keep PAT-only GH_PAT paths');
  assert(
    postRelease.content.includes('tag_exists=${TAG_EXISTS}') &&
      postRelease.content.includes('release_exists=${RELEASE_EXISTS}') &&
      postRelease.content.includes('Create missing tag and GitHub Release'),
    'post-release.yml must allow release creation when the tag already exists'
  );
  const postReleaseExistStep = getStep(postRelease, 'post_release', 'Check existing tag and release');
  assertRunIncludes(postReleaseExistStep, 'MAIN_SHA="$(git rev-parse origin/main)"', 'post-release.yml existing tag check');
  assertRunIncludes(postReleaseExistStep, 'TAG_SHA="$(git rev-list -n 1 "${TAG}")"', 'post-release.yml existing tag check');
  assertRunIncludes(postReleaseExistStep, 'Existing tag ${TAG} points to', 'post-release.yml existing tag check');

  const syncOn = getOn(syncMain);
  assert(hasOwn(syncOn, 'workflow_dispatch'), 'sync-main-to-develop.yml must support workflow_dispatch recovery');
  assert(
    syncMain.data.jobs.sync_main_to_develop.if &&
      syncMain.data.jobs.sync_main_to_develop.if.includes("github.event_name == 'workflow_dispatch'"),
    'sync-main-to-develop.yml job must allow workflow_dispatch'
  );
  const syncCheckout = getStep(syncMain, 'sync_main_to_develop', 'Checkout');
  assert(syncCheckout && syncCheckout.with && syncCheckout.with.ref === 'main', 'sync-main-to-develop.yml must checkout main explicitly');
  assertFallbackGhToken(getStep(syncMain, 'sync_main_to_develop', 'Configure git remote for workflow-created branches'), 'sync-main remote setup');
  assertRunIncludes(
    getStep(syncMain, 'sync_main_to_develop', 'Compute sync branch name and check existence'),
    '^[0-9]+\\.[0-9]+\\.[0-9]+$',
    'sync-main-to-develop.yml version validation'
  );
  const syncPrStep = getStep(syncMain, 'sync_main_to_develop', 'Create Pull Request to develop');
  assertFallbackGhToken(syncPrStep, 'sync-main PR creation');
  assert(!syncPrStep.if, 'sync-main PR creation must run even when the sync branch already exists');

  const dispatchOn = getOn(developDispatch);
  assert(hasOwn(dispatchOn, 'workflow_dispatch'), 'develop-synced-dispatch.yml must support workflow_dispatch recovery');
  assert(
    developDispatch.content.includes('PAYLOAD_VERSION') || developDispatch.content.includes('INPUT_VERSION'),
    'develop-synced-dispatch.yml must support an explicit dispatch version'
  );
  assertRunIncludes(
    getStep(developDispatch, 'dispatch_develop_synced', 'Resolve version from input or sync branch'),
    '^[0-9]+\\.[0-9]+\\.[0-9]+$',
    'develop-synced-dispatch.yml version validation'
  );
  assertRunIncludes(
    getStep(developDispatch, 'dispatch_develop_synced', 'Send repository_dispatch develop-synced'),
    'JSON.stringify',
    'develop-synced-dispatch.yml dispatch payload'
  );
  assert(developDispatch.content.includes('--fail-with-body'), 'develop-synced-dispatch.yml dispatch curl must fail on HTTP errors');
  assertFallbackGhToken(getStep(developDispatch, 'dispatch_develop_synced', 'Send repository_dispatch develop-synced'), 'develop-synced dispatch');

  console.log('Release workflow checks passed.');
}

run();
