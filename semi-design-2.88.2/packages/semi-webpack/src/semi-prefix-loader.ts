import loaderUtils from 'loader-utils';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';

export default function semiPrefixLoader(source: string) {
    const query = loaderUtils.getOptions(this);
    const ast = parse(source, {
        sourceType: 'module'
    });
    traverse(ast, {
        VariableDeclarator(path) {
            const { node } = path;
            const replacerKeys = Object.keys(query.replacers);
            if (replacerKeys.includes((node.id as any).name)) {
                (node.init as any).value = query.replacers[(node.id as any).name];
            }
        }
    });
    return generate(ast).code;
}
