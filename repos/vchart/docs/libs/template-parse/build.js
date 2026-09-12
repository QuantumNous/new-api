/* Adapted from echarts-doc by Apache ECharts
 * https://github.com/apache/echarts-doc
 * Licensed under the Apache-2.0 license

 * url: https://github.com/apache/echarts-doc/blob/master/build.js
 * License: https://github.com/apache/echarts-doc/blob/master/LICENSE
 * @license
 */

const md2json = require('./md2json');
const { extractDesc } = require('./schemaHelper');
const fs = require('fs');
const fse = require('fs-extra');
const chalk = require('chalk');
const argv = require('yargs').argv;
const path = require('path');
const assert = require('assert');
const chokidar = require('chokidar');
const { debounce } = require('lodash');
const menu = require('../../menu.json');

function initEnv() {
  let envType = argv.env;
  let isDev = argv.dev != null || argv.debug != null || argv.env === 'dev';

  if (isDev) {
    console.warn('=============================');
    console.warn('!!! THIS IS IN DEV MODE !!!');
    console.warn('=============================');
    envType = 'dev';
  }

  if (!envType) {
    throw new Error('--env MUST be specified');
  }

  let config = {
    releaseDestDir: path.resolve(__dirname, '../../public/documents')
  };

  config.envType = envType;

  return config;
}

const config = initEnv();

const languages = ['zh', 'en'];

config.gl = config.gl || {};
for (let key in config) {
  if (key !== 'gl' && !config.gl.hasOwnProperty(key)) {
    config.gl[key] = config[key];
  }
}

async function md2jsonAsync(opt) {
  var newOpt = Object.assign(
    {
      path: path.resolve(__dirname, opt.assetPath, opt.language, '**/*.md'),
      tplEnv: Object.assign({}, config),
      imageRoot: config.imagePath
    },
    opt
  );

  function run(cb) {
    md2json(newOpt)
      .then(schema => {
        writeSingleSchemaPartioned(schema, opt.language, opt.entry, false);
        console.log(chalk.green('generated: ' + opt.language + '/' + opt.entry));
        cb && cb();
      })
      .catch(e => {
        console.log(e);
      });
  }

  var runDebounced = debounce(run, 500, {
    leading: false,
    trailing: true
  });
  return await new Promise((resolve, reject) => {
    run(resolve);

    if (argv.watch) {
      chokidar
        .watch(path.resolve(__dirname, opt.assetPath, opt.language), {
          ignoreInitial: true
        })
        .on('all', (event, path) => {
          console.log(path, event);
          runDebounced();
        });
    }
  });
}

async function run() {
  for (const menuItem of menu) {
    if (menuItem.type !== 'markdown-template') {
      continue;
    }
    for (const language of languages) {
      await md2jsonAsync({
        sectionsAnyOf: menuItem.sections,
        entry: menuItem.entry,
        assetPath: `../../assets/${menuItem.menu}/`,
        language
      });
    }
  }

  console.log('Build doc done.');

  console.log('All done.');
}

function writeSingleSchemaPartioned(schema, language, docName, format) {
  const { outline, descriptions } = extractDesc(schema, docName);

  const outlineBasename = `outline.json`;
  const outlineDestPath = path.resolve(config.releaseDestDir, `${docName}/${language}/${outlineBasename}`);
  fse.ensureDirSync(path.dirname(outlineDestPath));
  fse.outputFileSync(outlineDestPath, format ? JSON.stringify(outline, null, 2) : JSON.stringify(outline), 'utf-8');

  function copyUIControlConfigs(source, target) {
    for (let key in source) {
      if (target[key]) {
        if (source[key].uiControl && !target[key].uiControl) {
          target[key].uiControl = source[key].uiControl;
        }
        if (source[key].exampleBaseOptions && !target[key].exampleBaseOptions) {
          target[key].exampleBaseOptions = source[key].exampleBaseOptions;
        }
      } else {
        // console.error(`Unmatched option path ${key}`);
      }
    }
  }

  function readOptionDesc(language, partKey) {
    const descBasename = `${partKey}.json`;
    const descDestPath = path.resolve(config.releaseDestDir, `${docName}/${language}/${descBasename}`);
    try {
      const text = fs.readFileSync(descDestPath, 'utf-8');
      return JSON.parse(text);
    } catch (e) {
      return;
    }
  }

  function writeOptionDesc(language, partKey, json) {
    const descBasename = `${partKey}.json`;
    const descDestPath = path.resolve(config.releaseDestDir, `${docName}/${language}/${descBasename}`);
    fse.ensureDirSync(path.dirname(descDestPath));
    fse.outputFileSync(descDestPath, format ? JSON.stringify(json, null, 2) : JSON.stringify(json), 'utf-8');
  }

  for (let partKey in descriptions) {
    let partDescriptions = descriptions[partKey];

    // Copy ui control config from zh to english.
    if (language === 'zh') {
      languages.forEach(function (otherLang) {
        if (otherLang === 'zh') {
          return;
        }
        const json = readOptionDesc(otherLang, partKey);
        if (json) {
          copyUIControlConfigs(partDescriptions, json);
          writeOptionDesc(otherLang, partKey, json);
        }
      });
    } else {
      const json = readOptionDesc('zh', partKey);
      if (json) {
        copyUIControlConfigs(json, partDescriptions);
      }
    }

    writeOptionDesc(language, partKey, partDescriptions);
    // console.log(chalk.green('generated: ' + descDestPath));
  }
}

run();
