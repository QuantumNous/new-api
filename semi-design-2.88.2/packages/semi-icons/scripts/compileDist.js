const webpack = require('webpack');
const getWebpackConfig = require('../webpack.config');

function compile() {
    return new Promise((resolve, reject) => {
        console.log('compile jsx start', process.env);
        const config = getWebpackConfig({ minimize: false });
        webpack(config, (err, stats) => {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }
            
            const info = stats.toJson();
        
            if (stats.hasErrors()) {
                (info.errors || []).forEach(error => {
                    console.error(error);
                });
                reject(err);
                return;
            }
            console.log('compile jsx success');
            resolve();
        });
    });
}

function compileMin() {
    return new Promise((resolve, reject) => {
        console.log('compile jsx with minimize start');
        const config = getWebpackConfig({ minimize: true });
        webpack(config, (err, stats) => {
            if (err) {
                console.error(err);
                reject(err);
            }
            
            const info = stats.toJson();
        
            if (stats.hasErrors()) {
                (info.errors || []).forEach(error => {
                    console.error(error);
                    reject(err);
                });
            }
            console.log('compile jsx with minimize success');
            resolve();
        });
    });
}

async function main() {
    await compile();
    await compileMin();
}

main();