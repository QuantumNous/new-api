const order = [
    'introduction',
    'getting-started',
    'react19',
    'customize-theme',
    'design-to-code',
    'dark-mode',
    'accessibility',
    'internationalization',
    'design-source',
    'overview',
    'faq',
    "tailwind",
    "web-components",
    'content-guidelines',
    'changelog',
    'update-to-v2',
    'tokens',
    'layout',
    'grid',
    'resizable',
    'button',
    'floatbutton',
    'typography',
    'divider',
    'icon',
    'space',
    'chat',
    'codehighlight',
    "markdownrender",
    "dragMove",
    "jsonviewer",
    'hotkeys',
    "lottie",
    'autocomplete',
    'cascader',
    'checkbox',
    'colorpicker',
    'datepicker',
    'form',
    'input',
    'inputnumber',
    'pincode',
    'radio',
    'rating',
    'select',
    'slider',
    'switch',
    'taginput',
    'timepicker',
    'transfer',
    'treeselect',
    'upload',
    'anchor',
    'backtop',
    'breadcrumb',
    'navigation',
    'pagination',
    'steps',
    'tabs',
    'tree',
    'avatar',
    'badge',
    'calendar',
    'card',
    'carousel',
    'collapse',
    'collapsible',
    'descriptions',
    'dropdown',
    'empty',
    'highlight',
    'image',
    'cropper',
    'list',
    'modal',
    'overflowlist',
    'popover',
    'scrolllist',
    'sidesheet',
    'table',
    'tag',
    'timeline',
    'tooltip',
    'userGuide',
    'chart',
    'banner',
    'notification',
    'feedback',
    'popconfirm',
    'progress',
    'skeleton',
    'spin',
    'toast',
    'configprovider',
    'locale',
    'jsonviewer',
    'audioPlayer',
    'videoPlayer',
    'aiComponent',
    'aiChatInput',
    'aiChatDialogue',
];
let { exec } = require('child_process');
let fs = require('fs');
const executeShell = (command, callback) => {
    exec(command, (error, stdout, stderr) => {
        callback(stdout);
    });
};
module.exports = () => {
    const reOrderSingleMdx = (mdxPath, order) => {
        let data = fs.readFileSync(mdxPath, { encoding: 'utf-8' });
        let dataArray = data.split('---');
        let yaml = dataArray[1];
        const yamlArray = yaml.split('\n');
        let done = false;
        let localeDone = false;
        //    let title=null;
        //    let titleIndex=null;
        for (let index in yamlArray) {
            let info = yamlArray[index];

            //  //
            //  if(info.indexOf('subTitle')!==-1){
            //     title=info.split(':')[1];
            //     if(titleIndex){
            //         yamlArray[titleIndex]=`title: ${title}`;
            //     }
            //  }
            //  if(info.match(/title: /)){
            //     if(title){
            //         yamlArray[index]=`title: ${title}`;
            //     }else{
            //         titleIndex=index;
            //     }
            //  }
            //  //

            let localeResult = info.match(/localeCode: /);
            if (localeResult) {
                localeDone = true;
            }

            let result = info.match(/order: \d/);
            if (result) {
                yamlArray[index] = `order: ${order}`;
                done = true;
            }
        }
        if (!done) {
            yamlArray.splice(1, 0, `order: ${order}`);
        }
        if (!localeDone) {
            const localCode = mdxPath.indexOf('en-US') !== -1 ? 'en-US' : 'zh-CN';
            yamlArray.splice(1, 0, `localeCode: ${localCode}`);
            console.log(`add localCode ${localCode} into ${mdxPath}'s yaml.`);
        }
        dataArray[1] = yamlArray.join('\n');
        const orderedData = dataArray.join('---');
        fs.writeFileSync(mdxPath, orderedData);
    };
    executeShell(`find ${process.cwd()}/content/* | grep index`, fileListStr => {
        let mdxFileList = fileListStr.split('\n').filter(filePath => {
            let res = filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
            if (!res && filePath) {
                console.error(`ERROR: ${filePath} not found or it's not a file.`);
            }
            return res;
        });
        mdxFileList.map(filePath => {
            const pathArray = filePath.split('/');
            const itemName = pathArray[pathArray.length - 2];
            const newOrder = order.indexOf(itemName) + 1;
            if (newOrder !== -1) {
                reOrderSingleMdx(filePath, newOrder);
            } else {
                console.error(`${itenName} not in order Array. Check your order.js or markdown folder name.`);
            }
            // console.log(`set ${itemName} to order ${newOrder}`)
        });
        console.log('ordered mdx');
    });
};
