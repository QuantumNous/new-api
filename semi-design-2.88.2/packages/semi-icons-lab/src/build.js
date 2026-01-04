const fs = require('fs');
const path = require('path');

const folderPath = './svgs'; // 替换为要读取的文件夹路径

function readSvgFiles(folderPath) {
    const files = fs.readdirSync(folderPath); // 读取文件夹中的所有文件

    const svgFiles = files.filter(file => path.extname(file) === '.svg'); // 筛选出扩展名为 .svg 的文件

    let fileNames = svgFiles.map(file => path.basename(file, '.svg')); // 提取文件名，去除扩展名

    let json = fileNames.map(item => ({ name: item, category: 'common' }));

    console.log(json);
    return json;
}

const svgFileNames = readSvgFiles(folderPath);