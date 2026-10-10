const fs = require('fs');
const path = require('path');
const VChart = require('@visactor/vchart');
const Canvas = require('canvas');
const fse = require('fs-extra');
const package = require('../../packages/vchart/package.json');
const minimist = require('minimist');


const examplesDirectory = path.resolve(__dirname, '../assets/examples');
const previewDirectory = path.resolve(__dirname, '../public/vchart/preview');
const failListName = 'failedPreviewLists.json';
const languages = ['zh', 'en'];

const version = package.version;

const failedPreviewLists = [];

function getPreviewName(fullPath) {
  return `${fullPath.replaceAll('/', '-')}_${version}.png`;
}

function createImage(spec, fullPath) {
  let cs = null;
  try {
    spec.width = 640;
    spec.height = 480;
    cs = new VChart.default(spec, {
      // 声明使用的渲染环境以及传染对应的渲染环境参数
      mode: 'node',
      modeParams: Canvas,
      dpr: 1,
      animation: false
    });

    cs.renderSync();

    const buffer = cs.getImageBuffer();
    fs.writeFileSync(path.resolve(previewDirectory, getPreviewName(fullPath)), buffer);
    console.log(`Create preview for ${fullPath}`);
  } catch (error) {
    console.log(`Error when create preview for ${fullPath}`, error);
    return false;
  }
  try {
    cs?.release();
  } catch (error) {
    console.log(`Error when releasing for ${fullPath}`);
  }
  return true;
}

function getCodeFromMd(mdString) {
  const jsPattern = /```([a-z]+)(\s+[a-z]+)?\n([\s\S]*?)\n```/g;
  // match code block in demo content
  const demoCodeBlocks = [];
  let match;
  while ((match = jsPattern.exec(mdString)) !== null) {
    demoCodeBlocks.push(match[3]);
  }

  return getSpecFromCode(demoCodeBlocks[0] + '\n');
}

function getSpecFromCode(codeString) {
  try {
    const fun = new Function('VCHART_MODULE', `
      ${codeString.substr(0, codeString.indexOf('const vchart = new V'))};
      return spec;
  `);
    return fun(VChart);
  } catch (error) {
    return null;
  }
}

function writePreviewToExample(fullPath) {
  const previewLink = `/vchart/preview/${getPreviewName(fullPath)}`;
  for (const language of languages) {
    const examplePath = path.resolve(examplesDirectory, language, `${fullPath}.md`);
    let example = fs.readFileSync(examplePath, { encoding: 'utf-8' });
    if (example.match(/cover:.*\n/)) {
      example = example.replace(/cover:.*\n/, `cover: ${previewLink}\n`);
    } else if (example.startsWith('---')) {
      example = example.replace(
        '---',
        `---
cover: ${previewLink}
---`
      );
    } else {
      example =
        `---
cover: ${previewLink}
---` + example;
    }
    fs.writeFileSync(examplePath, example, { encoding: 'utf-8' });
  }
}

function readExampleMenu() {
  const data = fs.readFileSync(path.resolve(examplesDirectory, 'menu.json'), { encoding: 'utf-8' });
  return JSON.parse(data);
}

async function previewMenuItem(menuItem, parentPath, options) {
  const fullPath = parentPath === '' ? menuItem.path : `${parentPath}/${menuItem.path}`;
  if (menuItem.children) {
    for (const childMenuItem of menuItem.children) {
      await previewMenuItem(childMenuItem, fullPath, options);
    }
  } else {
    const example = fs.readFileSync(path.resolve(examplesDirectory, 'zh', `${fullPath}.md`), { encoding: 'utf-8' });
    const code = getCodeFromMd(example);
    let isFail = false;

    if (code) {
      if (options && options.onlyEmpty) {
        if (!/cover:([ ])*(\S)+\n/.exec(example)) {
          // no cover now
          isFail = !createImage(code, fullPath)
          writePreviewToExample(fullPath);
        }
      } else {
        isFail = !createImage(code, fullPath)
        writePreviewToExample(fullPath);
      }
      

    } else {
      isFail = true;
    }
    
    if (isFail) {
      failedPreviewLists.push(fullPath);
    }
  }
}

async function preview() {
  const argv = require('minimist')(process.argv.slice(2));
  const onlyEmpty = !!(argv.e || argv.empty);
  
  // create previews for all files
  const examplesMenu = readExampleMenu();

  if (!onlyEmpty) {
    fse.emptyDirSync(previewDirectory);
  }
  for (const menuItem of examplesMenu.children) {
    await previewMenuItem(menuItem, '', { onlyEmpty });
  }

  const failPath = path.resolve(previewDirectory, failListName);
  console.log(`Failure count: ${failedPreviewLists.length}, failed list written to ${failPath}`);
  fs.writeFileSync(failPath, JSON.stringify(failedPreviewLists, null, 2));
  console.log('Preview done.');
}

preview();
