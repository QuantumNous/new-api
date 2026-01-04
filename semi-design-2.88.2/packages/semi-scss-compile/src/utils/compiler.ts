import sass from 'sass';


const compile = (entryScssPath: string, isMin: boolean = false) => {
    const result = sass.renderSync({
        file: entryScssPath,
        outputStyle: isMin ? 'compressed' : 'expanded',
        charset: false
    });
    return result;
};

export default compile;

