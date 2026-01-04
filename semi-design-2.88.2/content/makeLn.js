let exec = require('child_process').exec;
let fs = require('fs');
const executeShell = (command, callback) => {
    exec(command, (error, stdout, stderr) => {
        callback(stdout);
    });
};

executeShell('find * | grep index', out => {
    let fileList = out.split('\n');
    fileList = fileList.map(file => {
        return {
            component: file.split('/')[1] === 'icon' ? 'icons' : file.split('/')[1],
            filename: file.split('/')[2],
            path: '../../../content/' + file,
        };
    });

    const componentCodeList=fs.readdirSync('../packages/semi-ui');
    const componentCodeListLowerCase=componentCodeList.map(dirName=>dirName.toLowerCase());
    fileList.map(item => {
        const index=componentCodeListLowerCase.indexOf(item.component);
        let isExists = index!==-1;
        if (isExists) {
            let cmd = `ln -s -f ${item.path} ../packages/semi-ui/${componentCodeList[index]}/${item.filename}`;
            executeShell(cmd, res => {
                console.log(`exec ${cmd} ${res}`);
            });
        }
    });
});
