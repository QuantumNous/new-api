import * as React from 'react';
import BaseComponent from '../_base/baseComponent';
import MarkdownRenderFoundation, {
    MarkdownRenderAdapter,
    MarkdownRenderBaseProps,
    MarkdownRenderBaseState,
} from '@douyinfe/semi-foundation/markdownRender/foundation';
import "@douyinfe/semi-foundation/markdownRender/markdownRender.scss";
import { CSSProperties } from 'react';
import * as runtime from 'react/jsx-runtime';
import { cssClasses } from '@douyinfe/semi-foundation/markdownRender/constants';
import * as SemiMarkdownComponents from "./components";
import cls from "classnames";
import PropTypes from 'prop-types';
import { getDefaultPropsFromGlobalConfig } from '../_utils';
export interface MarkdownRenderProps extends MarkdownRenderBaseProps{
    style?: CSSProperties;
    className?: string
}

export interface MarkdownRenderState extends MarkdownRenderBaseState{

}

class MarkdownRender extends BaseComponent<MarkdownRenderProps, MarkdownRenderState> {

    foundation = new MarkdownRenderFoundation(this.adapter)

    constructor(props: MarkdownRenderProps) {
        super(props);
        this.state = {
            MDXContentComponent: this.foundation.evaluateSync(this.props.raw)
        };
    }

    static propTypes = {
        className: PropTypes.string,
        style: PropTypes.object,
        format: PropTypes.string,
        components: PropTypes.any,
        raw: PropTypes.string,
        remarkPlugins: PropTypes.arrayOf(PropTypes.any),
        rehypePlugins: PropTypes.arrayOf(PropTypes.any),
        remarkGfm: PropTypes.bool,
    }

    static __SemiComponentName__ = "MarkdownRender";
    static defaultProps = getDefaultPropsFromGlobalConfig(MarkdownRender.__SemiComponentName__, {
        format: "mdx",
        remarkGfm: true,
    })

    componentDidUpdate(prevProps: Readonly<MarkdownRenderProps>, prevState: Readonly<MarkdownRenderState>, snapshot?: any) {
        if (prevProps.raw !== this.props.raw) {
            this.setState({ MDXContentComponent: this.foundation.evaluateSync(this.props.raw) });
        }
    }

    get adapter(): MarkdownRenderAdapter<MarkdownRenderProps, MarkdownRenderState> {
        return {
            ...super.adapter,
            getRuntime: () => runtime
        };
    }

    render() {
        const ComponentConstructor = this.state.MDXContentComponent;
        return <div className={cls(cssClasses.PREFIX, this.props.className)} style={this.props.style} {...this.getDataAttr()}>
            <ComponentConstructor components={{ ...SemiMarkdownComponents, ...this.props.components }} />
        </div>;
    }

    static defaultComponents = SemiMarkdownComponents;
}


export default MarkdownRender;
