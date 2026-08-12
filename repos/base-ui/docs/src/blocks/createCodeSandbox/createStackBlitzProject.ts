import { DemoFile } from 'docs/src/blocks/Demo';
import * as CRA from './CreateReactApp';
import { packDemo } from './packDemo';
import { addHiddenInput } from './addHiddenInput';

export function createStackBlitzProject(options: createStackBlitzProject.Options) {
  const { files, dependencies, devDependencies } = createRequestPayload(options);
  const initialFile = Object.keys(files)[0];

  const form = document.createElement('form');
  form.method = 'POST';
  form.target = '_blank';
  form.action = `https://stackblitz.com/run?file=${initialFile}`;

  addHiddenInput(form, 'project[template]', 'create-react-app');
  addHiddenInput(form, 'project[title]', options.title);
  addHiddenInput(form, 'project[description]', `# ${options.title}\n${options.description}`);
  addHiddenInput(form, 'project[dependencies]', JSON.stringify(dependencies));
  addHiddenInput(form, 'project[devDependencies]', JSON.stringify(devDependencies));

  Object.keys(files).forEach((key) => {
    const value = files[key];
    addHiddenInput(form, `project[files][${key}]`, value);
  });

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

export namespace createStackBlitzProject {
  export interface Options {
    /**
     * The title of the sandbox.
     */
    title: string;
    /**
     * The natural language of the sandbox (to be placed in the `html` lang attribute).
     */
    naturalLanguage?: string;
    /**
     * The description of the sandbox.
     */
    description?: string;
    /**
     * The demo files to be included in the sandbox.
     */
    demoFiles: DemoFile[];
    /**
     * The language of the entry point file.
     */
    demoLanguage: 'js' | 'ts';
    /**
     * The dependencies to be included in the sandbox.
     * They are added on top of dependencies found in the demo files.
     */
    dependencies: Record<string, string>;
    /**
     * The dev dependencies to be included in the sandbox.
     */
    devDependencies?: Record<string, string>;
    /**
     * A function to resolve dependencies versions.
     * By default, it resolves to the `latest` version.
     */
    dependencyResolver?: (importPath: string) => Record<string, string>;
    /**
     * Additional content to be placed in the `head` tag of the `index.html` file.
     */
    additionalHtmlHeadContent?: string;
    /**
     * The custom index (JS/TS) file content.
     */
    customIndexFile?: string;
    /**
     * A function to customize the files to be included in the sandbox.
     * It is called for each of the demo files with its name and content.
     * It expects a tuple with the new file name and content or `null` to apply standard rules
     * (place the file in the `src` directory).
     */
    onAddingFile?: (fileName: string, content: string) => [string, string] | null;
  }
}

function createRequestPayload(options: createStackBlitzProject.Options) {
  const {
    title,
    naturalLanguage = 'en',
    customIndexFile,
    demoFiles,
    demoLanguage,
    additionalHtmlHeadContent,
    onAddingFile,
  } = options;

  const packagedDemo = packDemo(demoFiles);
  const indexExtension = demoLanguage === 'ts' ? '.tsx' : '.js';

  const demoFilesToInclude = transformDemoFiles(packagedDemo.processedFiles, onAddingFile);

  const files: Record<string, string> = {
    ...demoFilesToInclude,
    [`src/index${indexExtension}`]: customIndexFile ?? CRA.getRootIndex(demoLanguage === 'ts'),
    'public/index.html': CRA.getHtml({
      title,
      language: naturalLanguage,
      additionalHeadContent: additionalHtmlHeadContent,
    }),
  };

  if (demoLanguage === 'ts') {
    files['tsconfig.json'] = CRA.getTsconfig();
  }

  return {
    files,
    dependencies: getDependencies(options, packagedDemo.externalImports),
    devDependencies: options.devDependencies ?? {},
  };
}

function defaultDependencyResolver(importPath: string) {
  return {
    [importPath]: 'latest',
  };
}

function getDependencies(options: createStackBlitzProject.Options, sourceDependencies: string[]) {
  const { dependencies: hardcodedDependencies, dependencyResolver = defaultDependencyResolver } =
    options;
  const dependencies = new Map<string, string>();

  sourceDependencies.forEach((dependency) => {
    const resolvedDependencies = dependencyResolver(dependency);
    Object.entries(resolvedDependencies).forEach(([name, version]) => {
      dependencies.set(name, version);
    });
  });

  Object.entries(hardcodedDependencies).forEach(([name, version]) => {
    dependencies.set(name, version);
  });

  return Object.fromEntries(dependencies);
}

function transformDemoFiles(
  files: Record<string, string>,
  onAddingFile: ((fileName: string, content: string) => [string, string] | null) | undefined,
) {
  const processedFiles: Record<string, string> = {};
  Object.keys(files).forEach((file) => {
    const customProcessed = onAddingFile?.(file, files[file]);
    if (customProcessed) {
      processedFiles[customProcessed[0]] = customProcessed[1];
    } else {
      processedFiles[`src/${file}`] = files[file];
    }
  });

  return processedFiles;
}
