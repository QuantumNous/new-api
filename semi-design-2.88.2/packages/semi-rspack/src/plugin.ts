import { Compiler, RuleSetRule } from 'webpack';
import { applySemiRules } from './rule';
import { SemiWebpackPluginOptions } from './types';

export class SemiRspackPlugin {
    opts: SemiWebpackPluginOptions;

    constructor(options?: SemiWebpackPluginOptions) {
        this.opts = options;
    }

    apply(compiler: Compiler) {
        const rules = applySemiRules(this.opts);
        compiler.options.module.rules.push(...rules);
    }
}
