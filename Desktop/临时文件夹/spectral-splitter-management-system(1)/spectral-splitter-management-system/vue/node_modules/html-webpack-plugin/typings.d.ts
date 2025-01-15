import { AsyncSeriesWaterfallHook } from "tapable";
import { Compiler, Compilation } from "webpack";
import { Options as HtmlMinifierOptions } from "html-minifier-terser";

export = HtmlWebpackPlugin;

declare class HtmlWebpackPlugin {
  constructor(options?: HtmlWebpackPlugin.Options);

  userOptions: HtmlWebpackPlugin.Options;

  /** Current HtmlWebpackPlugin Major */
  version: number;

  /**
   * Options after html-webpack-plugin has been initialized with defaults
   */
  options?: HtmlWebpackPlugin.ProcessedOptions;

  apply(compiler: Compiler): void;

  static getHooks(compilation: Compilation): HtmlWebpackPlugin.Hooks;

  /**
   * Static helper to create a tag object to be get injected into the dom
   */
  static createHtmlTagObject(
    tagName: string,
    attributes?: { [attributeName: string]: string | boolean },
    innerHTML?: string
  ): HtmlWebpackPlugin.HtmlTagObject;

  static readonly version: number;
}

declare namespace HtmlWebpackPlugin {
  type MinifyOptions = HtmlMinifierOptions;

  interface Options {
    /**
     * Emit the file only if it was changed.
     * @default true
     */
    cache?: boolean;
    /**
     * List all entries which should be injected
     */
    chunks?: "all" | string[];
    /**
     * Allows to control how chunks should be sorted before they are included to the html.
     * @default 'auto'
     */
    chunksSortMode?:
      | "auto"
      // `none` is deprecated and an alias for `auto` now.
      | "none"
      | "manual"
      | ((entryNameA: string, entryNameB: string) => number);
    /**
     * List all entries which should not be injected
     */
    excludeChunks?: string[];
    /**
     * Path to the favicon icon
     */
    favicon?: false | string;
    /**
     * The file to write the HTML to.
     * Supports subdirectories eg: `assets/admin.html`
     * [name] will be replaced by the entry name
     * Supports a function to generate the name
     *
     * @default 'index.html'
     */
    filename?: string | ((entryName: string) => string);
    /**
     * By default the public path is set to `auto` - that way the html-webpack-plugin will try
     * to set the publicPath according to the current filename and the webpack publicPath setting
     */
    publicPath?: string | "auto";
    /**
     * If `true` then append a unique `webpack` compilation hash to all included scripts and CSS files.
     * This is useful for cache busting
     */
    hash?: boolean;
    /**
     * Inject all assets into the given `template` or `templateContent`.
     */
    inject?:
      | false // Don't inject scripts
      | true // Inject scripts into body
      | "body" // Inject scripts into body
      | "head"; // Inject scripts into head
    /**
     * Set up script loading
     * blocking will result in <script src="..."></script>
     * defer will result in <script defer src="..."></script>
     *
     * @default 'defer'
     */
    scriptLoading?: "blocking" | "defer" | "module";
    /**
     * Inject meta tags
     */
    meta?:
      | false // Disable injection
      | {
          [name: string]:
            | string
            | false // name content pair e.g. {viewport: 'width=device-width, initial-scale=1, shrink-to-fit=no'}`
            | { [attributeName: string]: string | boolean }; // custom properties e.g. { name:"viewport" content:"width=500, initial-scale=1" }
        };
    /**
     * HTML Minification options accepts the following values:
     * - Set to `false` to disable minifcation
     * - Set to `'auto'` to enable minifcation only for production mode
     * - Set to custom minification according to
     * {@link https://github.com/kangax/html-minifier#options-quick-reference}
     */
    minify?: "auto" | boolean | MinifyOptions;
    /**
     * Render errors into the HTML page
     */
    showErrors?: boolean;
    /**
     * The `webpack` require path to the template.
     * @see https://github.com/jantimon/html-webpack-plugin/blob/master/docs/template-option.md
     */
    template?: string;
    /**
     * Allow to use a html string instead of reading from a file
     */
    templateContent?:
      | false // Use the template option instead to load a file
      | string
      | ((templateParameters: {
          [option: string]: any;
        }) => string | Promise<string>)
      | Promise<string>;
    /**
     * Allows to overwrite the parameters used in the template
     */
    templateParameters?:
      | false // Pass an empty object to the template function
      | ((
          compilation: any,
          assets: {
            publicPath: string;
            js: Array<string>;
            css: Array<string>;
            manifest?: string;
            favicon?: string;
          },
          assetTags: {
            headTags: HtmlTagObject[];
            bodyTags: HtmlTagObject[];
          },
          options: ProcessedOptions
        ) => { [option: string]: any } | Promise<{ [option: string]: any }>)
      | { [option: string]: any };
    /**
     * The title to use for the generated HTML document
     */
    title?: string;
    /**
     * Enforce self closing tags e.g. <link />
     */
    xhtml?: boolean;
    /**
     * In addition to the options actually used by this plugin, you can use this hash to pass arbitrary data through
     * to your template.
     */
    [option: string]: any;
  }

  /**
   * The plugin options after adding default values
   */
  interface ProcessedOptions extends Required<Options> {
    filename: string;
  }

  /**
   * The values which are available during template execution
   *
   * Please keep in mind that the `templateParameter` options allows to change them
   */
  interface TemplateParameter {
    compilation: any;
    htmlWebpackPlugin: {
      tags: {
        headTags: HtmlTagObject[];
        bodyTags: HtmlTagObject[];
      };
      files: {
        publicPath: string;
        js: Array<string>;
        css: Array<string>;
        manifest?: string;
        favicon?: string;
      };
      options: Options;
    };
    webpackConfig: any;
  }

  interface Hooks {
    alterAssetTags: AsyncSeriesWaterfallHook<{
      assetTags: {
        scripts: HtmlTagObject[];
        styles: HtmlTagObject[];
        meta: HtmlTagObject[];
      };
      publicPath: string,
      outputName: string;
      plugin: HtmlWebpackPlugin;
    }>;

    alterAssetTagGroups: AsyncSeriesWaterfallHook<{
      headTags: HtmlTagObject[];
      bodyTags: HtmlTagObject[];
      outputName: string;
      publicPath: string,
      plugin: HtmlWebpackPlugin;
    }>;

    afterTemplateExecution: AsyncSeriesWaterfallHook<{
      html: string;
      headTags: HtmlTagObject[];
      bodyTags: HtmlTagObject[];
      outputName: string;
      plugin: HtmlWebpackPlugin;
    }>;

    beforeAssetTagGeneration: AsyncSeriesWaterfallHook<{
      assets: {
        publicPath: string;
        js: Array<string>;
        css: Array<string>;
        favicon?: string;
        manifest?: string;
      };
      outputName: string;
      plugin: HtmlWebpackPlugin;
    }>;

    beforeEmit: AsyncSeriesWaterfallHook<{
      html: string;
      outputName: string;
      plugin: HtmlWebpackPlugin;
    }>;

    afterEmit: AsyncSeriesWaterfallHook<{
      outputName: string;
      plugin: HtmlWebpackPlugin;
    }>;
  }

  /**
   * A tag element according to the htmlWebpackPlugin object notation
   */
  interface HtmlTagObject {
    /**
     * Attributes of the html tag
     * E.g. `{'disabled': true, 'value': 'demo'}`
     */
    attributes: {
      [attributeName: string]: string | boolean | null | undefined;
    };
    /**
     * The tag name e.g. `'div'`
     */
    tagName: string;
    /**
     * The inner HTML
     */
    innerHTML?: string;
    /**
     * Whether this html must not contain innerHTML
     * @see https://www.w3.org/TR/html5/syntax.html#void-elements
     */
    voidTag: boolean;
    /**
     * Meta information about the tag
     * E.g. `{'plugin': 'html-webpack-plugin'}`
     */
    meta: {
      plugin?: string,
      [metaAttributeName: string]: any;
    };
  }
}
