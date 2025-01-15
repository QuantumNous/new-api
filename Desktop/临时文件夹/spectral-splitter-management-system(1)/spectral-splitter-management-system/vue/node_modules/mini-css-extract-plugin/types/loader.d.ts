export = loader;
/**
 * @this {import("webpack").LoaderContext<LoaderOptions>}
 * @param {string} content
 */
declare function loader(
  this: import("webpack").LoaderContext<MiniCssExtractPlugin.LoaderOptions>,
  content: string
): string | undefined;
declare namespace loader {
  export {
    pitch,
    Schema,
    Compiler,
    Compilation,
    Chunk,
    Module,
    Source,
    AssetInfo,
    NormalModule,
    LoaderOptions,
    Locals,
    TODO,
    Dependency,
  };
}
import MiniCssExtractPlugin = require("./index");
/**
 * @this {import("webpack").LoaderContext<LoaderOptions>}
 * @param {string} request
 */
declare function pitch(
  this: import("webpack").LoaderContext<MiniCssExtractPlugin.LoaderOptions>,
  request: string
): void;
type Schema = import("schema-utils/declarations/validate").Schema;
type Compiler = import("webpack").Compiler;
type Compilation = import("webpack").Compilation;
type Chunk = import("webpack").Chunk;
type Module = import("webpack").Module;
type Source = import("webpack").sources.Source;
type AssetInfo = import("webpack").AssetInfo;
type NormalModule = import("webpack").NormalModule;
type LoaderOptions = import("./index.js").LoaderOptions;
type Locals = {
  [key: string]: string | Function;
};
type TODO = any;
type Dependency = {
  identifier: string;
  context: string | null;
  content: Buffer;
  media: string;
  supports?: string | undefined;
  layer?: string | undefined;
  sourceMap?: Buffer | undefined;
};
