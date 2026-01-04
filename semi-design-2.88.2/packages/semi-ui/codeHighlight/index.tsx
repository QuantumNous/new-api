import * as React from 'react';
import BaseComponent from '../_base/baseComponent';
import CodeHighlightFoundation, {
    CodeHighlightAdapter,
    CodeHighlightBaseProps,
    CodeHighlightBaseState,
} from '@douyinfe/semi-foundation/codeHighlight';
import { CSSProperties } from 'react';
import "@douyinfe/semi-foundation/codeHighlight/codeHighlight.scss";
import { getDefaultPropsFromGlobalConfig } from '../_utils';
import PropTypes from 'prop-types';
import cls from "classnames";
import { cssClasses } from "@douyinfe/semi-foundation/codeHighlight/constants";


interface CodeHighlightProps extends CodeHighlightBaseProps {
    className?: string;
    style?: CSSProperties;
    defaultTheme?: boolean
}


interface CodeHighlightState extends CodeHighlightBaseState {

}


class CodeHighlight extends BaseComponent<CodeHighlightProps, CodeHighlightState> {

    codeRef = React.createRef<HTMLElement>()
    foundation = new CodeHighlightFoundation(this.adapter)
    static __SemiComponentName__ = "CodeHighlight";

    static propTypes = {
        className: PropTypes.string,
        style: PropTypes.any,
        code: PropTypes.string,
        language: PropTypes.string,
        lineNumber: PropTypes.bool,
        defaultTheme: PropTypes.bool,
    }

    static defaultProps = getDefaultPropsFromGlobalConfig(CodeHighlight.__SemiComponentName__, {
        lineNumber: true,
        defaultTheme: true
    })

    constructor(props: CodeHighlightProps) {
        super(props);
        this.state = {};

    }

    get adapter(): CodeHighlightAdapter<CodeHighlightProps, CodeHighlightState> {
        return {
            ...super.adapter
        };
    }

    componentDidMount() {
        super.componentDidMount();
        if (this.codeRef.current) {
            this.foundation.highlightCode(this.codeRef.current, this.props.language);
        }
    }

    componentDidUpdate(prevProps: Readonly<CodeHighlightProps>, prevState: Readonly<CodeHighlightState>, snapshot?: any) {
        if (this.codeRef.current && prevProps.code !== this.props.code || this.props.language !== this.props.language) {
            this.foundation.highlightCode(this.codeRef.current, this.props.language);
        }
    }

    render() {
        return <div style={this.props.style} className={cls(this.props.className, cssClasses.PREFIX, "semi-light-scrollbar", { [`${cssClasses.PREFIX}-defaultTheme`]: this.props.defaultTheme })} {...this.getDataAttr(this.props)}>
            <pre>
                <code ref={this.codeRef}>
                    {this.props.code}
                </code>
            </pre>
        </div>;
    }


}

export default CodeHighlight;
