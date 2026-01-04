/* eslint-disable max-depth */
const fs = require('fs-extra');
const path = require('path');
const marked = require('marked');
const get = require('lodash/get');
const isString = require('lodash/isString');
const capitalize = require('lodash/capitalize');
const { COMPONENT_LIST } = require('./componentList'); 

const TYPE_MAP = {
    feat: 'feature',
    perf: 'performance',
    doc: 'docs',
    styles: 'style',
};

const SUPPORT_TYPES = new Set(['feat', 'feature', 'performance', 'style', 'new component', 'chore', 'docs', 'fix', 'refactor', 'breaking change', 'design token']);

const UNKNOWN_COMPONENT_NAME = 'Other';
const UNKNOWN_TYPE_NAME = 'chore';

function resolve(dir) {
    return path.join(__dirname, dir);
}

function readFile(filename) {
    return fs.readFileSync(resolve(filename), { encoding: 'utf-8' });
}

function getVersion(str) {
    const versionReg = /.*((\d{1,2}\.){2}\d{1,2}(-\w+\.\d+)?)/;
    let result = versionReg.exec(str);
    return get(result, '1', '').trim().toLowerCase();
}

function getType(str) {
    const typeReg = /【([a-z\s]*)】|\[([a-z\s]*)\]/i;
    let result = typeReg.exec(str);
    let type;
    if (result) {
        type = result[1] || result[2];
    }
    type = isString(type) && type.trim().toLowerCase();
    if (!SUPPORT_TYPES.has(type)) {
        type = UNKNOWN_TYPE_NAME;
    }
    return type;
}

function getIndent(str) {
    return /(\s*).*/.exec(str)[1].length;
}

function getChangeLog(str) {
    const changeLogReg = /\s*-\s*(.*)/;
    const changeLog = changeLogReg.exec(str)[1];
    const indent = getIndent(str);
    return [changeLog.trim(), indent];
}

function getComponent(str) {
    const componentReg = new RegExp(`\\b(${COMPONENT_LIST.join('|')})\\b`, 'i');
    let result = componentReg.exec(str);
    if (result) {
        return capitalize(result[1]);
    } else {
        return null;
    }
}

function formatData(data) {
    // feat => feature
    // perf => performance
    // doc => docs
    const newData = data.map(item => {
        const { type, component } = item;
        if (type in TYPE_MAP) {
            // console.log(type);
            item.type = TYPE_MAP[type];
        }
        if (!SUPPORT_TYPES.has(item.type)) {
            console.warn('changelog not support type', item.type);
        }
        if (!component) {
            item.component = UNKNOWN_COMPONENT_NAME;
        }
        return item;
    });
    return newData;
}

function getChangeLogList(rawMarkdown) {
    const lines = rawMarkdown.split('\n');
    const output = [];
    let version, type, parentComponent, prevLevel, level, prevIndent;
    let parentIndent = 0;
    let intent2Level = new Map();
    for (let line of lines) {
        // is version line, eg. #### 🎉 1.24.4 (2021-06-21)
        if (line.startsWith('####')) {
            version = getVersion(line);
            intent2Level = new Map();
            continue;
        }
        // is type line, eg. - 【Fix】
        if (/-\s*[【】\[\]]/.test(line)) {
            type = getType(line);
            prevIndent = 0;
            level = 0;
            prevLevel = 0;
            continue;
        }
        // is changelog line
        if (version && /\s*-\s*.*/.test(line)) {
            let [content, indent] = getChangeLog(line);
            let component = getComponent(content);
            // process level
            const _level = intent2Level.get(indent); // align to same value indent
            if (_level) {
                level = _level;
                prevIndent = indent;
                prevLevel = level;
            } else {
                if (indent > prevIndent) {
                    level = ++prevLevel;
                } else if (indent < prevIndent) {
                    level = --prevLevel;
                } else {
                    level = prevLevel;
                }
                intent2Level.set(indent, level);
            }
            // process component is none
            if ((prevIndent && (indent > prevIndent)) || ((indent === prevIndent) && level !== 1)) {
                if (!component) {
                    component = indent > parentIndent ? parentComponent : UNKNOWN_COMPONENT_NAME;
                }
            }
            // update parent parameter
            if (level === 1 || indent < prevIndent) {
                parentComponent = component;
                parentIndent = indent;
            }
            prevIndent = indent; // record prev indent
            const contentToHTML = marked(content).replace(/(<p>)|(<\/p>)/g, '').trim();
            const currentChangeLog = { version, type, content: contentToHTML, component, level };
            output.push(currentChangeLog);
        }
    }
    return formatData(output);
}

function main() {
    // eslint-disable-next-line no-unused-vars
    const [_, __, savePath] = process.argv;
    const output = '../static/changeLog.json';
    try {
        const changelogZN = readFile('../content/start/changelog/index.md');
        const changelogEN = readFile('../content/start/changelog/index-en-US.md');
        const changelogZNList = getChangeLogList(changelogZN);
        const changelogENList = getChangeLogList(changelogEN);
        const changelogJSON = {
            'zh-CN': changelogZNList,
            'en-US': changelogENList,
        };
        fs.writeFileSync(savePath || resolve(output), JSON.stringify(changelogJSON));
        console.info(`🎉 save changeLog.json to ${savePath || resolve(output)}`);
    } catch (err) {
        console.error('changelog build error: ', err.message, err.stack);
    }
}

main();
