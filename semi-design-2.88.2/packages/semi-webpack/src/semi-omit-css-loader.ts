
export default function semiOmitCssLoader(source: string) {
    return source
        .replace(/(import\s+['"][^'"]+\.css['"])/g, '// $1')
        .replace(/(require\(['"][^'"]+\.css['"]\))/g, '// $1');
}