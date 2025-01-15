import type { Compiler } from 'webpack';
declare class VueLoaderPlugin {
    static NS: string;
    apply(compiler: Compiler): void;
}
export default VueLoaderPlugin;
