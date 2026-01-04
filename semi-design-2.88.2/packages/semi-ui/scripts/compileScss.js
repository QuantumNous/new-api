const { compile } = require('@douyinfe/semi-scss-compile');
const path = require('path');

function resolve(dir) {
    return path.join(__dirname, '../..', dir);
}

compile({
    foundationPath: resolve('semi-foundation/'),
    themePath: resolve('semi-theme-default/'),
    iconPath: resolve('semi-icons/'),
    /* REACT_18_START */
    outputPath: resolve('semi-ui/dist/css/semi.min.css'),
    /* REACT_18_END */
    /* REACT_19_START */
    // outputPath: resolve('semi-ui-19/dist/css/semi.min.css'),
    /* REACT_19_END */
    isMin: true
});

compile({
    foundationPath: resolve('semi-foundation/'),
    themePath: resolve('semi-theme-default/'),
    iconPath: resolve('semi-icons/'),
    /* REACT_18_START */
    outputPath: resolve('semi-ui/dist/css/semi.css'),
    /* REACT_18_END */
    /* REACT_19_START */
    // outputPath: resolve('semi-ui-19/dist/css/semi.css'),
    /* REACT_19_END */
    isMin: false
});


