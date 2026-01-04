/* eslint-disable max-lines-per-function */
/* argus-disable dangerMethod */
import React from 'react';
import PropTypes from 'prop-types';

const darkmodeProcesser = () => {
    if (!window) {
        return;
    }
    function cache(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.log(error);
        }
    }
    function getCache(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (error) {
            console.log(error);
            return undefined;
        }
    }
    const setMode = mode => {
        if (!window) {
            return;
        }
        const { body } = document;
        cache('semiMode', mode);
        const attr = 'theme-mode';
        if (mode === 'dark') {
            body.setAttribute(attr, mode);
        } else {
            body.removeAttribute(attr);
        }
        window.themeStorage.darkModeListener.map(listener => listener(mode));
    };
    const getValue = () => {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const match = mql.matches;
        return match ? 'dark' : 'light';
    };
    const cacheMode = getCache('semiMode');
    const mode = cacheMode ? cacheMode : getValue();
    document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive') {
            setMode(mode);
        }
    });
    if (!window.themeStorage) {
        window.themeStorage = {
            darkModeListener: []
        };
    }
    window.themeStorage.setMode = setMode;
};


const semiThemeProcesser = () => {
    function cache(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.log(error);
        }
    }
    function getCache(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (error) {
            console.log(error);
            return undefined;
        }
    }
    const defaultGlobal = {
        dark: {
            '--semi-color-primary': 'rgba(var(--semi-blue-5), 1)',
            '--semi-color-primary-hover': 'rgba(var(--semi-blue-6), 1)',
            '--semi-color-primary-active': 'rgba(var(--semi-blue-7), 1)',
            '--semi-color-primary-disabled': 'rgba(var(--semi-blue-2), 1)',
            '--semi-color-primary-light-default': 'rgba(var(--semi-blue-5), .2)',
            '--semi-color-primary-light-hover': 'rgba(var(--semi-blue-5), .3)',
            '--semi-color-primary-light-active': 'rgba(var(--semi-blue-5), .4)',
            '--semi-color-focus-border': 'rgba(var(--semi-blue-5), 1)'
        },
        light: {
            '--semi-color-primary': 'rgba(var(--semi-blue-5), 1)',
            '--semi-color-primary-hover': 'rgba(var(--semi-blue-6), 1)',
            '--semi-color-primary-active': 'rgba(var(--semi-blue-7), 1)',
            '--semi-color-primary-disabled': 'rgba(var(--semi-blue-2), 1)',
            '--semi-color-primary-light-default': 'rgba(var(--semi-blue-0), 1)',
            '--semi-color-primary-light-hover': 'rgba(var(--semi-blue-1), 1)',
            '--semi-color-primary-light-active': 'rgba(var(--semi-blue-2), 1)',
            '--semi-color-focus-border': 'rgba(var(--semi-blue-5), 1)'
        }
    };
    const _conventStr = obj => {
        let str = '';
        Object.keys(obj).forEach(key => {
            const value = obj[key];
            str = `${str}${key}: ${value};`;
        });
        return str;
    };
    const paletteObj = getCache('semiPaletteObj') ? getCache('semiPaletteObj') : { light: {}, dark: {} };
    const globalObj = getCache('semiGlobalObj')
        ? getCache('semiGlobalObj')
        : {
            light: defaultGlobal.light,
            dark: defaultGlobal.dark,
        };
    const writeStyle = ({ lightPaletteStr, darkPaletteStr, lightGlobalStr, darkGlobalStr }) => {
        let cssText = `
            body{
                ${lightPaletteStr}
                ${lightGlobalStr}
            }\n
            body[theme-mode='dark'] {
                ${darkPaletteStr}
                ${darkGlobalStr}
            }
        `;
        const styleSheet = document.querySelector('style[name="semi"]');
        if (!styleSheet) {
            const style = document.createElement('style');
            style.innerText = cssText;
            style.setAttribute('name', 'semi');
            document.head.appendChild(style);
        } else {
            styleSheet.innerText = cssText;
        }

    };
    const lightPaletteStr = _conventStr(paletteObj.light);
    const darkPaletteStr = _conventStr(paletteObj.dark);
    const lightGlobalStr = _conventStr(globalObj.light);
    const darkGlobalStr = _conventStr(globalObj.dark);
    writeStyle({ lightPaletteStr, darkPaletteStr, lightGlobalStr, darkGlobalStr });
};

export default function HTML(props) {
    if (process.env.NODE_ENV === 'production') {
        for (const component of props.headComponents) {
            if (component.type === 'style') {
                const index = props.headComponents.indexOf(component);
                const link = <link rel="stylesheet" href={component.props['data-href']} />;
                props.headComponents.splice(index, 1, link);
            }
        }
    }
    return (
        <html {...props.htmlAttributes}>
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="x-ua-compatible" content="ie=edge" />
                <meta name="google-site-verification" content="K9ajinpeafHOSSuts14tlwJswGvmgE8rRmuq8uvkaJQ" />
                <meta name="google-site-verification" content="I__60o8MR6XwZxKCpOe12z9PoGTk78az081sUkkREOU" />
                <meta name="viewport" content="width=1440, initial-scale=0, shrink-to-fit=no" />
                <link rel="alternate" hrefLang="zh" href="https://semi.design/zh-CN" />
                <link rel="alternate" hrefLang="en" href="https://semi.design/en-US" />
                <meta name="description" content="An easy-to-customize modern design system that helps designers and developers create high-quality products. 由抖音前端与 UED 团队维护，易于定制的现代化设计系统，帮助设计师与开发者打造高质量产品。 "/>
                <meta name="keywords" content={[
                    "React",
                    "React Component",
                    "UI Component",
                    "react library",
                    "Design component",
                    "Design System",
                    "easy customize",
                    "modern design system",
                    "front-end",
                    "React 组件",
                    "用户界面组件",
                    "反应库",
                    "设计组件",
                    "抖音设计系统",
                    "轻松定制",
                    "现代设计体系",
                    "前端"
                ].join(", ")}/>
                <script src="https://lf1-cdn-tos.bytescm.com/goofy/semi_convenience/semi-analyze.js" defer={true} />
                {
                    THEME_SWITCHER_URL ? <script src={THEME_SWITCHER_URL} defer={true}/> : <script src="https://unpkg.byted-static.com/latest/ies/semi-theme-switcher-opensource/dist/semi-theme-switcher.js" defer={true}/>
                }
                {
                    SEMI_SEARCH_URL ? <script src={SEMI_SEARCH_URL} defer={true}/> : <script src={"https://unpkg.byted-static.com/latest/ies/semi-search-opensource/dist/semi-search.js"} defer={true}/>
                }
                {
                    MATERIAL_LIST_URL ? <script src={MATERIAL_LIST_URL} defer={true} /> : null
                }
                <link rel="icon" href="https://lf9-static.semi.design/obj/semi-tos/images/favicon.ico" />
                <script dangerouslySetInnerHTML={{ __html: `(${darkmodeProcesser.toString()})()` }} />
                {props.headComponents}
                <script dangerouslySetInnerHTML={{ __html: `(${semiThemeProcesser.toString()})()` }} />
            </head>
            <body {...props.bodyAttributes}>
                {props.preBodyComponents}
                <div key={'body'} id="___gatsby" dangerouslySetInnerHTML={{ __html: props.body }} />
                {props.postBodyComponents}
            </body>
        </html>
    );
}

HTML.propTypes = {
    htmlAttributes: PropTypes.object,
    headComponents: PropTypes.array,
    bodyAttributes: PropTypes.object,
    preBodyComponents: PropTypes.array,
    body: PropTypes.string,
    postBodyComponents: PropTypes.array,
};

