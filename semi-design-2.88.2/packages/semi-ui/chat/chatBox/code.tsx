import React, { useCallback, useMemo, useState } from 'react';
import { PropsWithChildren } from 'react';
import { cssClasses } from '@douyinfe/semi-foundation/chat/constants';
import copy from 'copy-text-to-clipboard';
import { IconCopyStroked, IconTick } from '@douyinfe/semi-icons';
import { nth } from 'lodash';
import { code } from '../../markdownRender/components';
// code's default height type is html/js/css, add jsx & tsx;
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-tsx.js";
import LocaleConsumer from "../../locale/localeConsumer";
import { Locale } from "../../locale/interface";

const { PREFIX_CHAT_BOX } = cssClasses;

const Code = (props: PropsWithChildren<{ className: string }>) => {
    const [copied, setCopied] = useState(false);
    const language = useMemo(() => {
        return nth(props.className?.split("-"), -1);
    }, [props.className]);

    const onCopyButtonClick = useCallback(() => {
        copy(props.children as string);
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
        }, 2000);
    }, [props.children]);
    
    return language ? (<div className={`${PREFIX_CHAT_BOX}-content-code semi-always-dark`}>
        <div className={`${PREFIX_CHAT_BOX}-content-code-topSlot`}>
            <span className={`${PREFIX_CHAT_BOX}-content-code-topSlot-type`}>{language}</span>
            <span className={`${PREFIX_CHAT_BOX}-content-code-topSlot-copy`}>
                {copied ? (<span className={`${PREFIX_CHAT_BOX}-content-code-topSlot-copy-wrapper`}>
                    <IconTick />
                    <LocaleConsumer<Locale["Chat"]> componentName="Chat" >
                        {(locale: Locale["Chat"]) => locale['copied']}
                    </LocaleConsumer>
                </span>) : (<button 
                    className={`${PREFIX_CHAT_BOX}-content-code-topSlot-copy-wrapper ${PREFIX_CHAT_BOX}-content-code-topSlot-toCopy`} 
                    onClick={onCopyButtonClick}
                >
                    <IconCopyStroked />
                    <LocaleConsumer<Locale["Chat"]> componentName="Chat" >
                        {(locale: Locale["Chat"]) => locale['copy']}
                    </LocaleConsumer>
                </button>)}
            </span> 
        </div>
        {code(props)}
    </div>) : (code(props));
};

export default Code;
