import type { Compiler } from 'webpack';
declare class Plugin {
    static NS: string;
    apply(compiler: Compiler): void;
}
export default Plugin;
