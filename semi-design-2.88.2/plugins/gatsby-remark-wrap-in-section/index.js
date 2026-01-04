module.exports = ({ markdownAST }) => {

    const headingsIndexArr = [];
    let newTree = [];


    const allImports = markdownAST.children.filter(item => item.type === 'import');
    const allExports = markdownAST.children.filter(item => item.type === 'export');

    let noImportExport = markdownAST.children.filter(item => !(item.type === 'import' || item.type === 'export'));

    noImportExport.forEach((node, index) => {
        if (node.type === 'heading' && node.depth === 2) {
            headingsIndexArr.push(index);
        }
    });

    if (headingsIndexArr.length > 0) {
        if (headingsIndexArr[0] !== 0) {
            newTree = noImportExport.slice(0, headingsIndexArr[0]);
        }



        headingsIndexArr.forEach((currentIndex, i) => {
            const startPoint = currentIndex;
            const endPoint = i === headingsIndexArr.length - 1 ? noImportExport.length : headingsIndexArr[i + 1];

            const children = noImportExport.slice(startPoint, endPoint);


            if (children.length) {
                const wrapperNode = {
                    type: 'custom',
                    children,
                    data: { hName: 'section' },
                };

                newTree.push(wrapperNode);
            }
        });


        markdownAST.children = [...allImports, ...newTree, ...allExports];
    }

    return markdownAST;

};
