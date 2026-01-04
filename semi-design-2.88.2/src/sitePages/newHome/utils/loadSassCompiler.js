
let compiler = null;
const loadSassCompiler = () => new Promise((resolve) => {
    if (compiler) {
        resolve(compiler);
        return;
    }
    const scriptEle = document.createElement("script");
    scriptEle.type = "text/javascript";
    scriptEle.src = "/sass.js";
    scriptEle.onload = () => {
        // @ts-ignore
        const { Sass } = window;
        compiler = new Sass();
        compiler.writeFilePromisify = (...args) => {
            return new Promise((resolve, reject) => {
                compiler.writeFile(...args, (result) => {
                    if (result) {
                        console.log("writed", args);
                        resolve();
                    } else {
                        reject();
                    }
                });
            });
        };
        resolve(compiler);
    };
    document.head.appendChild(scriptEle);
});

export default loadSassCompiler;
