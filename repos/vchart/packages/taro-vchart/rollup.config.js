import typescript from '@rollup/plugin-typescript';

export default {
  input: './src/index.tsx',
  output: [
    {
      dir: './lib/src',
      format: 'es',
      exports: 'named',
      sourcemap: false
    }
  ],
  external: ['react', '@tarojs/components', '@tarojs/taro'],
  plugins: [
    typescript({
      outDir: './lib/src',
      include: ['./src/**/*.ts', './src/**/*.tsx'],
      lib: ['es6', 'dom'],
      target: 'es6',
      downlevelIteration: true,
      module: 'es2015',
      esModuleInterop: true,
      sourceMap: false
    })
  ]
};
