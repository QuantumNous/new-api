import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { strings } from '@douyinfe/semi-foundation/typography/constants';
import Base from './base';
import { Ellipsis, TypographyBaseType, OmitTypographyProps } from './interface';
import { ArrayElement } from '@douyinfe/semi-foundation/utils/type';

type OmitTitleProps = OmitTypographyProps;

export interface CopyableConfig {
    content?: string;
    copyTip?: React.ReactNode;
    successTip?: React.ReactNode;
    icon?: React.ReactNode;

    onCopy?: (e: React.MouseEvent, content: string, res: boolean) => void;

    render?: (copied: boolean, doCopy: (e: React.MouseEvent) => void, configs: CopyableConfig) => React.ReactNode
}

export type LinkType = React.AnchorHTMLAttributes<HTMLAnchorElement> | boolean;

export interface TitleProps extends Omit<React.HTMLAttributes<HTMLHeadingElement>, OmitTitleProps> {
    className?: string;
    component?: React.ElementType;
    copyable?: CopyableConfig | boolean;
    delete?: boolean;
    disabled?: boolean;
    /**
     * ellipsis 用于设置截断相关参数.  
     * Ellipsis is used to set ellipsis related parameters.  
     * ellipsis 仅支持纯文本的截断，不支持 reactNode 等复杂类型，请确保 children 传入内容类型为 string.  
     * Ellipsis only supports ellipsis of plain text, and does not support complex types such as reactNode. 
     * Please ensure that the content type of children is string.  
     * Semi 截断有两种策略， CSS 截断和 JS 截断。  
     * Semi ellipsis has two strategies, CSS ellipsis and JS ellipsis.   
     *  - 当设置中间截断（pos='middle')、可展开（expandable)、有后缀（suffix 非空）、可复制（copyable），启用 JS 截断策略  
     *  - When setting middle ellipsis (pos='middle')、expandable、suffix is not empty string、copyable,
     * the JS ellipsis strategy is enabled
     *  - 非以上场景，启用 CSS 截断策略  
     *  - Otherwise, enable the CSS ellipsis strategy  
     *   
     * 通常来说 CSS 截断的性能优于 JS 截断。在 children 不变， 容器尺寸不变的情况下，CSS 截断只涉及 1-2 次计算，js 截断基于二分法，可能涉及多次计算。  
     * In general CSS ellipsis performs better than JS ellipsis. when the children and container size remain unchanged, 
     * CSS ellipsis only involves 1-2 calculations, while JS ellipsis is based on dichotomy and may require multiple calculations.  
     * 同时使用大量带有截断功能的 Typography 需注意性能消耗，如在 Table 中，可通过设置合理的页容量进行分页减少性能损耗  
     * Pay attention to performance consumption when using a large number of Typography with ellipsis. For example, in Table, 
     * you can reduce performance loss by setting a reasonable pageSize for paging
     */
    ellipsis?: Ellipsis | boolean;
    heading?: ArrayElement<typeof strings.HEADING>;
    link?: LinkType;
    mark?: boolean;
    strong?: boolean;
    style?: React.CSSProperties;
    type?: TypographyBaseType;
    underline?: boolean;
    weight?: ArrayElement<typeof strings.WEIGHT> | number
}

export default class Title extends PureComponent<TitleProps> {
    static propTypes = {
        copyable: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
        delete: PropTypes.bool,
        disabled: PropTypes.bool,
        // editable: PropTypes.bool,
        ellipsis: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
        mark: PropTypes.bool,
        link: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
        underline: PropTypes.bool,
        strong: PropTypes.bool,
        type: PropTypes.oneOf(strings.TYPE),
        heading: PropTypes.oneOf(strings.HEADING),
        style: PropTypes.object,
        className: PropTypes.string,
        component: PropTypes.string,
        weight: PropTypes.oneOfType([PropTypes.oneOf(strings.WEIGHT), PropTypes.number]),
    };

    static defaultProps = {
        copyable: false,
        delete: false,
        disabled: false,
        // editable: false,
        ellipsis: false,
        mark: false,
        underline: false,
        strong: false,
        link: false,
        type: 'primary',
        heading: 1,
        style: {},
        className: '',
    };

    render() {
        const { heading, ...rest } = this.props;
        const component = strings.HEADING.indexOf(heading) !== -1 ? `h${heading}` : 'h1';
        // Passing headings to support custom components
        return <Base component={component as React.ElementType} heading={component} {...rest} />;
    }
}
