import fs from 'node:fs';
import { isMultiCompiler } from '../helpers/compiler';
import type { InternalContext, NormalizedConfig, Rspack } from '../types';
import { type AssetsMiddleware, assetsMiddleware } from './assets-middleware';
import { SocketServer } from './socketServer';

type Options = {
  context: InternalContext;
  config: NormalizedConfig;
  compiler: Rspack.Compiler | Rspack.MultiCompiler;
  resolvedPort: number;
};

/**
 * Setup compiler related logic:
 * 1. setup assets middleware
 * 2. establish webSocket connect
 */
export class BuildManager {
  public assetsMiddleware!: AssetsMiddleware;

  public outputFileSystem: Rspack.OutputFileSystem;

  public socketServer: SocketServer;

  public compiler: Rspack.Compiler | Rspack.MultiCompiler;

  private config: NormalizedConfig;

  private resolvedPort: number;

  private context: InternalContext;

  constructor({ config, context, compiler, resolvedPort }: Options) {
    this.config = config;
    this.context = context;
    this.compiler = compiler;
    this.resolvedPort = resolvedPort;
    this.outputFileSystem = fs;
    this.socketServer = new SocketServer(context, config.dev, () => this.outputFileSystem);
    this.context.socketServer = this.socketServer;
  }

  public async init(): Promise<void> {
    await this.setupCompilationMiddleware();
    await this.socketServer.prepare();

    // Get the latest outputFileSystem from assets middleware
    const { compiler } = this;
    this.outputFileSystem =
      (isMultiCompiler(compiler)
        ? compiler.compilers[0].outputFileSystem
        : compiler.outputFileSystem) || fs;
  }

  /**
   * Call `compiler.watch()` to start compiling.
   */
  public watch(): void {
    this.assetsMiddleware.watch();
  }

  public async close(): Promise<void> {
    // socketServer close should before app close
    await this.socketServer.close();

    if (this.assetsMiddleware) {
      await new Promise<void>((resolve) => {
        this.assetsMiddleware.close(() => {
          resolve();
        });
      });
    }

    // `middleware.close()` only stop watching for file changes, compiler should also be closed.
    await new Promise<void>((resolve) => {
      this.compiler.close(() => {
        resolve();
      });
    });
  }

  public readFileSync = (fileName: string): string => {
    if ('readFileSync' in this.outputFileSystem) {
      // bundle require needs a synchronous method. Rspack's OutputFileSystem type only
      // declares the async API, but most implementations still provide readFileSync,
      // for example `node:fs` or `memfs`.
      return (this.outputFileSystem as typeof fs).readFileSync(fileName, 'utf-8');
    }
    return fs.readFileSync(fileName, 'utf-8');
  };

  private async setupCompilationMiddleware(): Promise<void> {
    const { config, context } = this;

    const middleware = await assetsMiddleware({
      config,
      context,
      compiler: this.compiler,
      socketServer: this.socketServer,
      resolvedPort: this.resolvedPort,
    });

    this.assetsMiddleware = middleware;
  }
}
