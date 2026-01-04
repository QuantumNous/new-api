const visit = require('unist-util-visit');
const remove = require('unist-util-remove');

module.exports = ({ markdownAST }) => {
    visit(markdownAST, 'paragraph', (node, index, parent) => {
        let imageClass = 'default';
        const hasOnlyImagesNodes = node.children.every(child => {
            if (child.type === 'text' && /\{(.*)\}/.test(child.value.trim())) {
                let matches = child.value.trim().match(/\{(.*)\}/);
                imageClass = matches[1].trim();
            }

            return (
                (child.type === 'html' && child.value.indexOf('gatsby-resp-image-wrapper') >= 0) ||
        (child.type === 'text' && /\{(.*)\}/.test(child.value.trim()))
            );
        });

        if (!hasOnlyImagesNodes) {
            return;
        }

        node.children[0].value = `<div class="image-${imageClass}">${node.children[0].value}</div>`;

        remove(node, 'text');

        parent.children.splice(index, 1, ...node.children);

        return index;
    });
};
