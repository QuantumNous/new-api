const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');




const compileWorker = async ()=>{
    const workerEntry = path.join(__dirname, "..", "core/src/worker/json.worker.ts");

    const result = await esbuild.build({
        entryPoints: [workerEntry],
        bundle: true,
        write: false,
    });
    return result.outputFiles[0].text;
};


const buildMain = async ()=>{
    const mainEntry = path.join(__dirname, "..", "core/src/index.ts");

    const result = await esbuild.build({
        entryPoints: [mainEntry],
        bundle: true,
        packages: 'external',
        write: false,
        format: 'esm'
    });
    return result.outputFiles[0].text;

};



const compile = async ()=>{
    const workerRaw = await compileWorker();

    const mainRaw = await buildMain();

    const finalRaw = mainRaw.replaceAll("%WORKER_RAW%", encodeURIComponent(workerRaw));

    const saveDir = path.join(__dirname, "..", "core/lib");

    if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir);
    }
    fs.writeFileSync(path.join(saveDir, "index.js"), finalRaw, 'utf8');
};

compile();
