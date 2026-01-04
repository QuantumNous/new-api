const env = process.env.BABEL_ENV || process.env.NODE_ENV;

module.exports = {
    presets: [
        [
            '@babel/preset-env',
            {
                modules: env === 'test' ? 'cjs' : false,
                debug: false,
            },
        ],
        '@babel/preset-react',
        '@babel/preset-typescript'
    ],
    plugins: [
        "@babel/plugin-transform-numeric-separator",
        '@babel/plugin-transform-runtime',
        [
            '@babel/plugin-proposal-decorators',
            {
                legacy: true,
            },
        ],
        '@babel/plugin-proposal-class-properties',
        '@babel/plugin-proposal-object-rest-spread',
        env === 'test' && 'babel-plugin-transform-require-context',
    ].filter(Boolean)
};
