const fs = require('fs').promises;
const path = require('path');

async function countLinesInFile(filePath) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    return lines.length;
}

async function countTestFilesLines(directoryPath) {
    let totalLines = 0;
    const folderLineCounts = {};

    try {
        const files = await fs.readdir(directoryPath);

        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const stats = await fs.stat(filePath);

            if (stats.isDirectory()) {
                const testDirectoryPath = path.join(filePath, '__test__');
                if (await fs.access(testDirectoryPath).then(() => true).catch(() => false)) {
                    const testFiles = await fs.readdir(testDirectoryPath);
                    let folderLines = 0;

                    for (const testFile of testFiles) {
                        if (testFile.endsWith('.test.js')) {
                            const testFilePath = path.join(testDirectoryPath, testFile);
                            const linesInFile = await countLinesInFile(testFilePath);
                            folderLines += linesInFile;
                        }
                    }

                    if (folderLines > 0) {
                        folderLineCounts[file] = folderLines;
                        totalLines += folderLines;
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${directoryPath}:`, error);
    }

    return { totalLines, folderLineCounts };
}

(async () => {
    const semiUiDirectoryPath = './packages/semi-ui'; // 替换成 semi-ui 文件夹的实际路径
    const { totalLines, folderLineCounts } = await countTestFilesLines(semiUiDirectoryPath);

    console.log(`Total lines in test files: ${totalLines}`);
    console.log('Lines in each folder (sorted):');

    // 将文件夹按行数排序
    const sortedFolders = Object.entries(folderLineCounts).sort(([, linesA], [, linesB]) => linesB - linesA);

    // 输出排序后的结果
    for (const [folder, lines] of sortedFolders) {
        console.log(`  ${folder}: ${lines} lines`);
    }
})();