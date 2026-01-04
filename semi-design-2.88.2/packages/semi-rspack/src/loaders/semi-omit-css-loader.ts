import { LoaderContext } from 'webpack';

export default function semiOmitCssLoader(this: LoaderContext<void>, source: string) {
    return source
        .replace(/(import\s+['"][^'"]+\.css['"])/g, '// $1')
        .replace(/(require\(['"][^'"]+\.css['"]\))/g, '// $1');
}
