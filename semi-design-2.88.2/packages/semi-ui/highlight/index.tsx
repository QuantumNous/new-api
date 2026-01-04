import React, { PureComponent } from 'react';
import cls from 'classnames';
import PropTypes, { string } from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/highlight/constants';
import HighlightFoundation from '@douyinfe/semi-foundation/highlight/foundation';
import type { SearchWords, Chunk } from '@douyinfe/semi-foundation/highlight/foundation';

import '@douyinfe/semi-foundation/highlight/highlight.scss';

interface GetHighLightTextHTMLProps {
    sourceString?: string;
    searchWords?: SearchWords;
    option: HighLightTextHTMLOption
}

interface HighLightTextHTMLOption {
    highlightTag?: string;
    highlightClassName?: string;
    highlightStyle?: React.CSSProperties;
    caseSensitive: boolean;
    autoEscape: boolean
}

interface HighLightTextHTMLChunk extends Chunk { }

export interface HighlightProps {
    autoEscape?: boolean;
    caseSensitive?: boolean;
    sourceString?: string;
    searchWords?: SearchWords;
    highlightStyle?: React.CSSProperties;
    highlightClassName?: string;
    component?: string
}

const prefixCls = cssClasses.PREFIX;

class Highlight extends PureComponent<HighlightProps> {

    static propTypes = {
        style: PropTypes.object,
        className: PropTypes.string,
        autoEscape: PropTypes.bool,
        caseSensitive: PropTypes.bool,
        sourceString: PropTypes.string,
        searchWords: PropTypes.arrayOf(PropTypes.string),
        highlightStyle: PropTypes.object,
        highlightClassName: PropTypes.string,
        component: PropTypes.string
    };

    static defaultProps = {
        component: 'mark',
        autoEscape: true,
        caseSensitive: false,
        sourceString: '',
    };

    getHighLightTextHTML = ({
        sourceString = '',
        searchWords = [],
        option = { autoEscape: true, caseSensitive: false }
    }: GetHighLightTextHTMLProps) => {
        const chunks: HighLightTextHTMLChunk[] = new HighlightFoundation().findAll({ sourceString, searchWords, ...option });
        const markEle = option.highlightTag || 'mark';
        const highlightClassName = option.highlightClassName || '';
        const highlightStyle = option.highlightStyle || {};
        return chunks.map((chunk: HighLightTextHTMLChunk, index: number) => {
            const { end, start, highlight, style, className } = chunk;
            const text = sourceString.substr(start, end - start);
            if (highlight) {
                return React.createElement(
                    markEle,
                    {
                        style: { ...highlightStyle, ...style },
                        className: `${highlightClassName} ${className || ''}`.trim(),
                        key: text + index
                    },
                    text
                );
            } else {
                return text;
            }
        });
    };

    render() {
        const {
            searchWords,
            sourceString,
            component,
            highlightClassName,
            highlightStyle,
            caseSensitive,
            autoEscape,
        } = this.props;

        const tagCls = cls({
            [`${prefixCls}-tag`]: true,
        }, highlightClassName);

        const option = {
            highlightTag: component,
            highlightClassName: tagCls,
            highlightStyle,
            caseSensitive,
            autoEscape,
        };

        return (
            this.getHighLightTextHTML({ sourceString, searchWords, option })
        );
    }
}

export default Highlight;
