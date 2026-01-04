const path = require('path');
module.exports = {
    pathPrefix: '/',
    assetPrefix: (process.env['CDN_OUTER_CN'] || process.env['CDN_INNER_CN']) ? `https://${(process.env['CDN_OUTER_CN'] || process.env['CDN_INNER_CN'])}/${process.env['CDN_PATH_PREFIX']}`: "",
    siteMetadata: {
        title: 'Gatsby Default Starter',
        description: 'Create a consistent, good-looking, easy-to-use, and efficient user experience with a user-centric, content-first, and human-friendly design system',
        author: 'Semi Design Team',
    },
    plugins: [
        'gatsby-plugin-svgr',
        'gatsby-plugin-react-helmet',
        {
            resolve: 'gatsby-source-filesystem',
            options: {
                name: 'images',
                path: `${__dirname}/src/images`,
            },
        },
        {
            resolve: 'gatsby-source-filesystem',
            options: {
                name: 'content',
                path: `${__dirname}/content`,
            },
        },
        {
            resolve: 'gatsby-plugin-typescript',
            options: {
                isTSX: true, // defaults to false
                jsxPragma: 'jsx', // defaults to "React"
                allExtensions: true, // defaults to false
            },
        },
        {
            resolve: 'gatsby-plugin-mdx',
            options: {
                extensions: ['.mdx', '.md'],
                gatsbyRemarkPlugins: [
                    // {
                    //     resolve: require.resolve('./plugins/gatsby-remark-unwrap'),
                    // },
                    {
                        resolve: require.resolve('./plugins/gatsby-remark-wrap-in-section'),
                    },
                ],
            },
        },
        {
            resolve: 'gatsby-plugin-i18n',
            options: {
                langKeyDefault: 'en',
                useLangKeyLayout: false,
            },
        },
        'gatsby-plugin-remove-serviceworker',
        'gatsby-source-semi-icons'
    ],
};
