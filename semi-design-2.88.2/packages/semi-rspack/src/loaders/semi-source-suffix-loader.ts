import { LoaderContext } from 'webpack';

export default function semiSourceSuffixLoader(this: LoaderContext<void>, source: string) {
    return source.replace(/(import\s+)['"]([^'"]+)(\.css)['"]/g, '$1\'$2.scss\'');
}

