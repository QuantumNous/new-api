import * as React from 'react';
import { PropsWithChildren } from 'react';
import CodeHighlight from "../../codeHighlight";
import { nth } from 'lodash';
import { cssClasses } from "@douyinfe/semi-foundation/markdownRender/constants";

const pre = (props: PropsWithChildren<{ className: string }>) => {
    const language = nth(props.className?.split("-"), -1);
    if (language) {
        return <CodeHighlight code={props.children as string}
            language={language} lineNumber={true}/>;
    } else {
        return <span className={`${cssClasses.PREFIX}-simple-code`}>
            {props.children}
        </span>;
    }

};

export default pre;
