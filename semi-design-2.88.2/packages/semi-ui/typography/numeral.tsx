import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { strings } from '@douyinfe/semi-foundation/typography/constants';
import Base from './base';
import {
    TypographyBaseSize,
    TypographyBaseType,
    TypographyBaseRule,
    OmitTypographyProps,
    TypographyBaseTruncate,
} from './interface';
import { CopyableConfig, LinkType } from './title';
import FormatNumeral from '@douyinfe/semi-foundation/typography/formatNumeral';

type OmitNumeralProps = OmitTypographyProps;

export interface NumeralProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, OmitNumeralProps> {
    rule?: TypographyBaseRule;
    precision?: number;
    truncate?: TypographyBaseTruncate;
    parser?: (value: string) => string;
    children?: React.ReactNode;
    className?: string;
    code?: boolean;
    component?: React.ElementType;
    copyable?: CopyableConfig | boolean;
    delete?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode | string;
    link?: LinkType;
    mark?: boolean;
    size?: TypographyBaseSize;
    strong?: boolean;
    style?: React.CSSProperties;
    type?: TypographyBaseType;
    underline?: boolean
}

export default class Numeral extends PureComponent<NumeralProps> {
    static propTypes = {
        rule: PropTypes.oneOf(strings.RULE),
        precision: PropTypes.number,
        truncate: PropTypes.oneOf(strings.TRUNCATE),
        parser: PropTypes.func,
        copyable: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
        delete: PropTypes.bool,
        disabled: PropTypes.bool,
        icon: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
        mark: PropTypes.bool,
        underline: PropTypes.bool,
        link: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
        strong: PropTypes.bool,
        type: PropTypes.oneOf(strings.TYPE),
        size: PropTypes.oneOf(strings.SIZE),
        style: PropTypes.object,
        className: PropTypes.string,
        code: PropTypes.bool,
        component: PropTypes.string,
    };

    static defaultProps = {
        rule: 'text',
        precision: 0,
        truncate: 'round',
        parser: undefined,
        copyable: false,
        delete: false,
        icon: '',
        mark: false,
        underline: false,
        strong: false,
        link: false,
        type: 'primary',
        style: {},
        size: 'normal',
        className: '',
    };

    // Traverse the entire virtual DOM using a depth-first traversal algorithm, then format each piece. (in react)
    formatNodeDFS(node) {
        if (!Array.isArray(node)) {
            node = [node];
        }
        // Because the property is read-only, an object is returned for overwriting rather than directly modifying the object's contents.
        node = node.map(item => {
            if (typeof item === 'string' || typeof item === 'number') {
                // Formatting the digital content of nodes.
                return new FormatNumeral(
                    String(item),
                    this.props.rule,
                    this.props.precision,
                    this.props.truncate,
                    this.props.parser
                ).format();
            }
            if (typeof item === 'function') {
                return this.formatNodeDFS(item());
            }
            if (typeof item === 'object' && 'children' in item['props']) {
                return {
                    ...item,
                    props: { ...item['props'], children: this.formatNodeDFS(item['props']['children']) },
                };
            }
            return item;
        });
        return node.length === 1 ? node[0] : node;
    }

    render() {
        // Deep copy and remove props that are not needed by the Base component.
        const baseProps = Object.assign({}, this.props) as Record<string, unknown>;
        delete baseProps.rule;
        delete baseProps.parser;
        // Each piece of content in the virtual DOM is formatted by the `formatNumeral` function.
        baseProps.children = this.formatNodeDFS(this.props.children);
        return <Base component={'span'} {...baseProps} />;
    }
}
