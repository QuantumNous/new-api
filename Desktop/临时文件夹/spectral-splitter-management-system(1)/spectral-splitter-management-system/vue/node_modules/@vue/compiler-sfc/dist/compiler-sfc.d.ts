import { LazyResult } from 'postcss';
import { ParserPlugin } from '@babel/parser';

declare interface AssetURLOptions {
    [name: string]: string | string[];
}

declare type ASTAttr = {
    name: string;
    value: any;
    dynamic?: boolean;
    start?: number;
    end?: number;
};

declare type ASTDirective = {
    name: string;
    rawName: string;
    value: string;
    arg: string | null;
    isDynamicArg: boolean;
    modifiers: ASTModifiers | null;
    start?: number;
    end?: number;
};

declare type ASTElement = {
    type: 1;
    tag: string;
    attrsList: Array<ASTAttr>;
    attrsMap: {
        [key: string]: any;
    };
    rawAttrsMap: {
        [key: string]: ASTAttr;
    };
    parent: ASTElement | void;
    children: Array<ASTNode>;
    start?: number;
    end?: number;
    processed?: true;
    static?: boolean;
    staticRoot?: boolean;
    staticInFor?: boolean;
    staticProcessed?: boolean;
    hasBindings?: boolean;
    text?: string;
    attrs?: Array<ASTAttr>;
    dynamicAttrs?: Array<ASTAttr>;
    props?: Array<ASTAttr>;
    plain?: boolean;
    pre?: true;
    ns?: string;
    component?: string;
    inlineTemplate?: true;
    transitionMode?: string | null;
    slotName?: string | null;
    slotTarget?: string | null;
    slotTargetDynamic?: boolean;
    slotScope?: string | null;
    scopedSlots?: {
        [name: string]: ASTElement;
    };
    ref?: string;
    refInFor?: boolean;
    if?: string;
    ifProcessed?: boolean;
    elseif?: string;
    else?: true;
    ifConditions?: ASTIfConditions;
    for?: string;
    forProcessed?: boolean;
    key?: string;
    alias?: string;
    iterator1?: string;
    iterator2?: string;
    staticClass?: string;
    classBinding?: string;
    staticStyle?: string;
    styleBinding?: string;
    events?: ASTElementHandlers;
    nativeEvents?: ASTElementHandlers;
    transition?: string | true;
    transitionOnAppear?: boolean;
    model?: {
        value: string;
        callback: string;
        expression: string;
    };
    directives?: Array<ASTDirective>;
    forbidden?: true;
    once?: true;
    onceProcessed?: boolean;
    wrapData?: (code: string) => string;
    wrapListeners?: (code: string) => string;
    ssrOptimizability?: number;
};

declare type ASTElementHandler = {
    value: string;
    params?: Array<any>;
    modifiers: ASTModifiers | null;
    dynamic?: boolean;
    start?: number;
    end?: number;
};

declare type ASTElementHandlers = {
    [key: string]: ASTElementHandler | Array<ASTElementHandler>;
};

declare type ASTExpression = {
    type: 2;
    expression: string;
    text: string;
    tokens: Array<string | Object>;
    static?: boolean;
    ssrOptimizability?: number;
    start?: number;
    end?: number;
};

declare type ASTIfCondition = {
    exp: string | null;
    block: ASTElement;
};

declare type ASTIfConditions = Array<ASTIfCondition>;

declare type ASTModifiers = {
    [key: string]: boolean;
};

declare type ASTNode = ASTElement | ASTText | ASTExpression;

declare type ASTText = {
    type: 3;
    text: string;
    static?: boolean;
    isComment?: boolean;
    ssrOptimizability?: number;
    start?: number;
    end?: number;
};

declare type BindingMetadata = {
    [key: string]: BindingTypes | undefined;
} & {
    __isScriptSetup?: boolean;
};

declare const enum BindingTypes {
    /**
     * returned from data()
     */
    DATA = "data",
    /**
     * declared as a prop
     */
    PROPS = "props",
    /**
     * a local alias of a `<script setup>` destructured prop.
     * the original is stored in __propsAliases of the bindingMetadata object.
     */
    PROPS_ALIASED = "props-aliased",
    /**
     * a let binding (may or may not be a ref)
     */
    SETUP_LET = "setup-let",
    /**
     * a const binding that can never be a ref.
     * these bindings don't need `unref()` calls when processed in inlined
     * template expressions.
     */
    SETUP_CONST = "setup-const",
    /**
     * a const binding that does not need `unref()`, but may be mutated.
     */
    SETUP_REACTIVE_CONST = "setup-reactive-const",
    /**
     * a const binding that may be a ref.
     */
    SETUP_MAYBE_REF = "setup-maybe-ref",
    /**
     * bindings that are guaranteed to be refs
     */
    SETUP_REF = "setup-ref",
    /**
     * declared by other options, e.g. computed, inject
     */
    OPTIONS = "options"
}

declare type CompiledResult = {
    ast: ASTElement | null;
    render: string;
    staticRenderFns: Array<string>;
    stringRenderFns?: Array<string>;
    errors?: Array<string | WarningMessage>;
    tips?: Array<string | WarningMessage>;
};

export declare type CompilerOptions = {
    warn?: Function;
    modules?: Array<ModuleOptions>;
    directives?: {
        [key: string]: Function;
    };
    staticKeys?: string;
    isUnaryTag?: (tag: string) => boolean | undefined;
    canBeLeftOpenTag?: (tag: string) => boolean | undefined;
    isReservedTag?: (tag: string) => boolean | undefined;
    preserveWhitespace?: boolean;
    whitespace?: 'preserve' | 'condense';
    optimize?: boolean;
    mustUseProp?: (tag: string, type: string | null, name: string) => boolean;
    isPreTag?: (attr: string) => boolean | null;
    getTagNamespace?: (tag: string) => string | undefined;
    expectHTML?: boolean;
    isFromDOM?: boolean;
    shouldDecodeTags?: boolean;
    shouldDecodeNewlines?: boolean;
    shouldDecodeNewlinesForHref?: boolean;
    outputSourceRange?: boolean;
    shouldKeepComment?: boolean;
    delimiters?: [string, string];
    comments?: boolean;
    scopeId?: string;
    bindings?: BindingMetadata;
};

/**
 * Compile `<script setup>`
 * It requires the whole SFC descriptor because we need to handle and merge
 * normal `<script>` + `<script setup>` if both are present.
 */
export declare function compileScript(sfc: SFCDescriptor, options?: SFCScriptCompileOptions): SFCScriptBlock;

export declare function compileStyle(options: SFCStyleCompileOptions): SFCStyleCompileResults;

export declare function compileStyleAsync(options: SFCStyleCompileOptions): Promise<SFCStyleCompileResults>;

export declare function compileTemplate(options: SFCTemplateCompileOptions): SFCTemplateCompileResults;

export declare function generateCodeFrame(source: string, start?: number, end?: number): string;

declare interface ImportBinding {
    isType: boolean;
    imported: string;
    source: string;
    isFromSetup: boolean;
    isUsedInTemplate: boolean;
}

declare type ModuleOptions = {
    preTransformNode?: (el: ASTElement) => ASTElement | null | void;
    transformNode?: (el: ASTElement) => ASTElement | null | void;
    postTransformNode?: (el: ASTElement) => void;
    genData?: (el: ASTElement) => string;
    transformCode?: (el: ASTElement, code: string) => string;
    staticKeys?: Array<string>;
};

export declare function parse(options: SFCParseOptions): SFCDescriptor;

/**
 * Parse a single-file component (*.vue) file into an SFC Descriptor Object.
 */
export declare function parseComponent(source: string, options?: VueTemplateCompilerParseOptions): SFCDescriptor;

declare interface RawSourceMap extends StartOfSourceMap {
    version: string;
    sources: string[];
    names: string[];
    sourcesContent?: string[];
    mappings: string;
}

/**
 * Utility for rewriting `export default` in a script block into a variable
 * declaration so that we can inject things into it
 */
export declare function rewriteDefault(input: string, as: string, parserPlugins?: ParserPlugin[]): string;

export declare interface SFCBlock extends SFCCustomBlock {
    lang?: string;
    scoped?: boolean;
    module?: string | boolean;
}

export declare interface SFCCustomBlock {
    type: string;
    content: string;
    attrs: {
        [key: string]: string | true;
    };
    start: number;
    end: number;
    src?: string;
    map?: RawSourceMap;
}

export declare interface SFCDescriptor {
    source: string;
    filename: string;
    template: SFCBlock | null;
    script: SFCScriptBlock | null;
    scriptSetup: SFCScriptBlock | null;
    styles: SFCBlock[];
    customBlocks: SFCCustomBlock[];
    cssVars: string[];
    errors: (string | WarningMessage)[];
    /**
     * compare with an existing descriptor to determine whether HMR should perform
     * a reload vs. re-render.
     *
     * Note: this comparison assumes the prev/next script are already identical,
     * and only checks the special case where `<script setup lang="ts">` unused
     * import pruning result changes due to template changes.
     */
    shouldForceReload: (prevImports: Record<string, ImportBinding>) => boolean;
}

export declare interface SFCParseOptions {
    source: string;
    filename?: string;
    compiler?: TemplateCompiler;
    compilerParseOptions?: VueTemplateCompilerParseOptions;
    sourceRoot?: string;
    sourceMap?: boolean;
    /**
     * @deprecated use `sourceMap` instead.
     */
    needMap?: boolean;
}

export declare interface SFCScriptBlock extends SFCBlock {
    type: 'script';
    setup?: string | boolean;
    bindings?: BindingMetadata;
    imports?: Record<string, ImportBinding>;
    /**
     * import('\@babel/types').Statement
     */
    scriptAst?: any[];
    /**
     * import('\@babel/types').Statement
     */
    scriptSetupAst?: any[];
}

export declare interface SFCScriptCompileOptions {
    /**
     * Scope ID for prefixing injected CSS variables.
     * This must be consistent with the `id` passed to `compileStyle`.
     */
    id: string;
    /**
     * Production mode. Used to determine whether to generate hashed CSS variables
     */
    isProd?: boolean;
    /**
     * Enable/disable source map. Defaults to true.
     */
    sourceMap?: boolean;
    /**
     * https://babeljs.io/docs/en/babel-parser#plugins
     */
    babelParserPlugins?: ParserPlugin[];
}

export declare interface SFCStyleCompileOptions {
    source: string;
    filename: string;
    id: string;
    map?: any;
    scoped?: boolean;
    trim?: boolean;
    preprocessLang?: string;
    preprocessOptions?: any;
    postcssOptions?: any;
    postcssPlugins?: any[];
    isProd?: boolean;
}

export declare interface SFCStyleCompileResults {
    code: string;
    map: any | void;
    rawResult: LazyResult | void;
    errors: string[];
}

export declare interface SFCTemplateCompileOptions {
    source: string;
    filename: string;
    compiler?: TemplateCompiler;
    compilerOptions?: CompilerOptions;
    transformAssetUrls?: AssetURLOptions | boolean;
    transformAssetUrlsOptions?: TransformAssetUrlsOptions;
    preprocessLang?: string;
    preprocessOptions?: any;
    transpileOptions?: any;
    isProduction?: boolean;
    isFunctional?: boolean;
    optimizeSSR?: boolean;
    prettify?: boolean;
    isTS?: boolean;
    bindings?: BindingMetadata;
}

export declare interface SFCTemplateCompileResults {
    ast: Object | undefined;
    code: string;
    source: string;
    tips: (string | WarningMessage)[];
    errors: (string | WarningMessage)[];
}

declare interface StartOfSourceMap {
    file?: string;
    sourceRoot?: string;
}

export declare interface TemplateCompiler {
    parseComponent(source: string, options?: any): SFCDescriptor;
    compile(template: string, options: CompilerOptions): CompiledResult;
    ssrCompile(template: string, options: CompilerOptions): CompiledResult;
}

declare interface TransformAssetUrlsOptions {
    /**
     * If base is provided, instead of transforming relative asset urls into
     * imports, they will be directly rewritten to absolute urls.
     */
    base?: string;
    /**
     * If true, also processes absolute urls.
     */
    includeAbsolute?: boolean;
}

declare interface VueTemplateCompilerParseOptions {
    pad?: 'line' | 'space' | boolean;
    deindent?: boolean;
    outputSourceRange?: boolean;
}

export declare type WarningMessage = {
    msg: string;
    start?: number;
    end?: number;
};

export { }
