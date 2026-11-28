const fs = require("fs-extra");
const path = require("path");

function copyDistToModule(source, target) {
  return fs.copy(source, target, { overwrite: true });
}
function getModulePath(packageName, root) {
  return path.join(root, "node_modules", packageName);
}

function isModulePathExists(modulePath) {
  return fs.existsSync(modulePath);
}

function createPackageInNodeModules(packageName, root) {
  const modulePath = getModulePath(packageName, root);

  if (!isModulePathExists(modulePath)) {
    fs.mkdirSync(modulePath, { recursive: true });
    fs.writeJSONSync(`${modulePath}/package.json`, {
      name: packageName,
      version: "0.0.1",
      main: "index.ts",
    });
    fs.symlinkSync(`${root}/src/index.ts`, `${modulePath}/index.ts`);
    console.log(`Created package: ${packageName} in node_modules`);
  }
}
/**
 * @type {Partial<import('../../src/logic/config').Config>}
 */
module.exports = {
  name: "qux",
  formats: ["cjs", "es", "umd"],
  // formats: ["es"],
  sourceDir: "source",
  external: (rawPackageJson) => Object.keys(rawPackageJson.dependencies),
  outputDir: {
    es: "es",
    cjs: "cjs",
    umd: "umd",
  },
  noEmitOnError: true,
  rollupOptions: {
    cache: true,
  },
  envs: {
    __DEV__: JSON.stringify(true),
  },
  copy: ["png", "css"],
  preTasks: {
    "Create Module": (_config, projectRoot, rawPackageJson) => {
      createPackageInNodeModules(rawPackageJson.name, projectRoot);
      return Promise.resolve();
    },
  },
  umdOutputFilename: 'index',
  postTasks: {
    "Copy dist": (config, projectRoot, rawPackageJson) => {
      if (config.formats.includes("umd")) {
        return copyDistToModule(
          path.resolve(projectRoot, config.outputDir.umd),
          `${getModulePath(rawPackageJson.name, projectRoot)}/dist`,
        );
      }

      return Promise.resolve();
    },
  },
};
