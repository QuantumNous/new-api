import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '@douyinfe/semi-ui';
import '../styles/ide.scss';

let runtime = null;
let autoImportComponent = () => void 0;

const formatCode = (code, demoIndex) => {
    const codeArr = code.split('\n');
    const bodyArr = [];
    codeArr.forEach(str => {
        if (!str.startsWith('export default')) {
            if (str.startsWith('() =>')) {
                str = str.replace('() =>', 'const Demo = () =>');
            }
            bodyArr.push(str);
        }
    });
    return {
        codeString: bodyArr.join('\n'),
        snippetString: '',
    };
};

/**
 * 用于浏览器环境下判断是否是 IDE 环境，SSR 情况下 isIde 永远为 false
 * @returns isIde
 */
export const useIsIde = () => {
    const [isIde, setIsIde] = useState(false);
    useEffect(() => {
        setIsIde(window.location.search?.includes('env=ide'));
    }, []);
    return isIde;
};

/**
 * IDE plug-in related functions
 */
export const useIde = props => {
    const timer = useRef(null);
    const { wrapperRef } = props;

    const isIde = useIsIde(false);

    const addSnippetsBtn = demoIndex => {
        const btnElm = document.createElement('div');
        const svgStr =
            '<svg fill="none" stroke="currentColor" stroke-width="4" viewBox="0 0 48 48" aria-hidden="true" focusable="false" class="arco-icon arco-icon-code"><path d="M43 22c0-7.732-6.492-14-14.5-14S14 14.268 14 22v.055A9.001 9.001 0 0 0 15 40h13m16.142-5.929-7.07 7.071L30 34.072M37.07 26v15"></path></svg>';
        btnElm.innerHTML = svgStr;
        btnElm.setAttribute('class', 'action-ide');
        btnElm.onclick = () => {
            const codeElem = wrapperRef?.current?.querySelectorAll('.gatsby-live-code-ide');
            const index = demoIndex + 1;
            if (codeElem?.length && codeElem[index]) {
                Modal.confirm({
                    title: '插入 Demo 代码',
                    content: '确定在编辑器中插入当前 Demo 代码吗？',
                    onOk: () => {
                        const { codeString } = formatCode(codeElem[index]?.value || '');
                        autoImportComponent({ codeString, snippetString: '' });
                        const lineNum = codeString?.split('\n')?.length || 0;
                        runtime?.require('tea').behave('importCode-semi', { num: lineNum });
                    },
                });
            }
        };
        return btnElm;
    };

    const setSandBoxVisible = () => {
        const actions = wrapperRef?.current?.querySelectorAll('.gatsby-live-code div[class^=index-module_actions__]');
        actions?.forEach((action, index) => {
            const snippetsBtn = addSnippetsBtn(index);
            action?.appendChild(snippetsBtn);
        });
    };

    useEffect(() => {
        if (!isIde) return;

        // 初始化 sdk runtime
        if (!runtime) {
            const { callNative, createProxy, Runtime } = require('univers-webview');
            runtime = Runtime?.init({ isInIframe: false });
            autoImportComponent = createProxy('ImportCode', callNative)?.autoImportComponent;
        }

        let cnt = 0;
        function waitForSetSandBoxVisible() {
            const actions = wrapperRef?.current?.querySelectorAll(
                '.gatsby-live-code div[class^=index-module_actions__]'
            );
            const loaded = actions.length > 0;
            cnt++;
            // 大于 10 次就放弃
            if (cnt > 10) return;
            if (!loaded) {
                timer.current = setTimeout(() => {
                    waitForSetSandBoxVisible();
                }, 1000);
                return;
            }
            setSandBoxVisible();
        }
        waitForSetSandBoxVisible();

        return () => {
            clearTimeout(timer.current);
        };
    }, [isIde]);

    return isIde;
};
