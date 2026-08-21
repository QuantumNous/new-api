import fs from 'node:fs/promises';

const BYPASS_LABELS = ['minor', 'major'];

const CODE_EXTENSIONS = /\.(ts|tsx|js|jsx|mts|mjs|cts|cjs)$/;
const TEST_FILE_PATTERNS =
  /\.(test|spec)\.(ts|tsx|js|jsx|mts|mjs|cts|cjs)$|\.test-d\.ts$/;

function getChangedFiles(value) {
  return (value || '').trim().split(/\s+/).filter(Boolean);
}

function isCodeFile(path) {
  if (!path.startsWith('packages/')) return false;
  if (TEST_FILE_PATTERNS.test(path)) return false;
  if (path.endsWith('.md')) return false;
  return CODE_EXTENSIONS.test(path);
}

async function readChangeset(path, readFile, lstat) {
  // ignore README.md file
  if (path === '.changeset/README.md') return null;

  // Check if the file is a .changeset file
  if (!/^\.changeset\/[a-z0-9-]+\.md/.test(path)) {
    throw Object.assign(new Error(`Invalid file - not a .changeset file`), {
      path,
    });
  }

  // Reject symlinks to prevent arbitrary file reads (CWE-59)
  const filePath = `../../../../${path}`;
  const stat = await lstat(filePath);
  if (stat.isSymbolicLink()) {
    throw Object.assign(
      new Error(`Invalid .changeset file - symlinks are not allowed`),
      { path },
    );
  }

  // find frontmatter
  const content = await readFile(filePath, 'utf-8');
  const result = content.match(/---\n([\s\S]+?)\n---/);
  if (!result) {
    throw Object.assign(
      new Error(`Invalid .changeset file - no frontmatter found`),
      { path },
    );
  }

  const [frontmatter] = result;

  // Find version bump by package. `frontmatter` looks like this:
  //
  // ```yaml
  // 'ai': patch
  // '@ai-sdk/provider': patch
  // ```
  const lines = frontmatter.split('\n').slice(1, -1);
  const versionBumps = {};
  for (const line of lines) {
    const [rawPackageName, versionBump] = line.split(':').map(s => s.trim());
    const packageName = rawPackageName.replace(/^['"]|['"]$/g, '');
    if (!packageName || !versionBump) {
      throw Object.assign(
        new Error(`Invalid .changeset file - invalid frontmatter`),
        { path, frontmatter },
      );
    }

    // Check if packageName is already set
    if (versionBumps[packageName]) {
      throw Object.assign(
        new Error(
          `Invalid .changeset file - duplicate package name "${packageName}"`,
        ),
        { path, frontmatter },
      );
    }

    versionBumps[packageName] = versionBump;
  }

  return { frontmatter, path, versionBumps };
}

// check if current file is the entry point
if (import.meta.url.endsWith(process.argv[1])) {
  // https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
  const pullRequestEvent = JSON.parse(
    await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf-8'),
  );

  try {
    const message = await verifyChangesets(
      pullRequestEvent,
      process.env,
      fs.readFile,
      fs.lstat,
    );
    await fs.writeFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Changeset verification passed ✅\n\n${message || ''}`,
    );
  } catch (error) {
    // write error to summary
    console.error(error.message);
    await fs.writeFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Changeset verification failed ❌

${error.message}`,
    );

    if (error.path) {
      await fs.appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        `\n\nFile: \`${error.path}\``,
      );
    }

    if (error.frontmatter) {
      await fs.appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        `\n\n\`\`\`yaml\n${error.frontmatter}\n\`\`\``,
      );
    }

    process.exit(1);
  }
}

export async function verifyChangesets(
  event,
  env = process.env,
  readFile = fs.readFile,
  lstat = fs.lstat,
) {
  // Skip check if pull request has "minor" or "major" label
  const byPassLabel = event.pull_request.labels.find(label =>
    BYPASS_LABELS.includes(label.name),
  );
  if (byPassLabel) {
    return `Skipping changeset verification - "${byPassLabel.name}" label found`;
  }

  // Check if pre-release mode is active (.changeset/pre.json exists)
  let isPreRelease = false;
  try {
    await readFile('../../../../.changeset/pre.json', 'utf-8');
    isPreRelease = true;
  } catch {
    // pre.json doesn't exist
  }

  const changesets = [];

  // Iterate through all changed .changeset/*.md files
  for (const path of getChangedFiles(env.CHANGED_FILES)) {
    const changeset = await readChangeset(path, readFile, lstat);
    if (changeset == null) continue;
    changesets.push(changeset);

    const allowedBumps = isPreRelease ? ['patch', 'minor', 'major'] : ['patch'];

    const invalidVersionBumps = Object.entries(changeset.versionBumps).filter(
      ([, versionBump]) => !allowedBumps.includes(versionBump),
    );

    if (invalidVersionBumps.length > 0) {
      throw Object.assign(
        new Error(
          `Invalid .changeset file - invalid version bump (only "patch" is allowed, see https://ai-sdk.dev/docs/migration-guides/versioning). To bypass, add one of the following labels: ${BYPASS_LABELS.join(', ')}`,
        ),

        { path, frontmatter: changeset.frontmatter },
      );
    }
  }

  // Check that all packages with code changes are covered by a changeset.
  const codeFiles = getChangedFiles(env.CHANGED_PACKAGE_FILES).filter(
    isCodeFile,
  );
  if (codeFiles.length === 0) return;

  const packageDirs = [
    ...new Set(codeFiles.map(path => path.split('/').slice(0, 2).join('/'))),
  ];

  const changedPackageNames = [];
  for (const dir of packageDirs) {
    try {
      const pkgJson = JSON.parse(
        await readFile(`../../../../${dir}/package.json`, 'utf-8'),
      );
      if (pkgJson.name && !pkgJson.private) {
        changedPackageNames.push(pkgJson.name);
      }
    } catch {
      // skip if package.json cannot be read
    }
  }

  if (changedPackageNames.length === 0) return;

  if (changesets.length === 0) {
    throw new Error(
      `Missing changeset - packages were modified but no .changeset/*.md file was found. Run 'pnpm changeset' to create one.`,
    );
  }

  const coveredPackages = new Set(
    changesets.flatMap(changeset => Object.keys(changeset.versionBumps)),
  );
  const missingPackages = changedPackageNames.filter(
    name => !coveredPackages.has(name),
  );

  if (missingPackages.length > 0) {
    throw new Error(
      `Missing changeset entries for packages: ${missingPackages.join(', ')}. Make sure all modified packages are listed in a .changeset/*.md file.`,
    );
  }
}
