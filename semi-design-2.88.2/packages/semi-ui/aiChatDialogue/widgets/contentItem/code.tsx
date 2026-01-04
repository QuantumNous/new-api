import React, { useCallback, useMemo, useState } from 'react';
import { PropsWithChildren } from 'react';
import { cssClasses } from '@douyinfe/semi-foundation/aiChatDialogue/constants';
import copy from 'copy-text-to-clipboard';
import { IconCopyStroked, IconTick } from '@douyinfe/semi-icons';
import { nth } from 'lodash';
import { code } from '../../../markdownRender/components';
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-tsx.js";

const { PREFIX_CODE } = cssClasses;

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
    
    return language ? (<div className={`${PREFIX_CODE}`}>
        <div className={`${PREFIX_CODE}-topSlot`}>
            <span className={`${PREFIX_CODE}-topSlot-type`}>{language}</span>
            <span className={`${PREFIX_CODE}-topSlot-copy`}>
                {copied ? (<button className={`${PREFIX_CODE}-topSlot-copy-wrapper`}>
                    <IconTick />
                </button>) : (<button 
                    className={`${PREFIX_CODE}-topSlot-copy-wrapper`} 
                    onClick={onCopyButtonClick}
                >
                    <IconCopyStroked />
                </button>)}
                
            </span> 
        </div>
        {code(props)}
    </div>) : (code(props));
};

export default Code;
