import React, { AriaRole, ComponentClass, CSSProperties } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/layout/constants';
import '@douyinfe/semi-foundation/layout/layout.scss';
import LayoutContext, { ContextType } from './layout-context';
import Sider from './Sider';

export type { ResponsiveMap, SiderProps } from './Sider';

const htmlTag = {
    Header: 'header',
    Footer: 'footer',
    Content: 'main',
    Layout: 'section'
};

function generator<P extends { type?: string; tagName?: string; role?: AriaRole; 'aria-label'?: string }>(type: string): (ComponentType: ComponentClass<{ type?: string; tagName?: string } & P>) => ComponentClass<P> {
    const tagName = htmlTag[type];
    const typeName = type.toLowerCase();
    return (BasicComponent): ComponentClass<P> => class Adapter extends React.PureComponent<P> {
        render() {
            return <BasicComponent role={this.props.role} aria-label={this.props['aria-label']} type={typeName} tagName={tagName} {...this.props} />;
        }
    };
}

export interface BasicProps {
    prefixCls?: string;
    style?: CSSProperties;
    className?: string;
    tagName?: keyof HTMLElementTagNameMap;
    type?: string;
    children?: React.ReactNode | undefined
}

class Basic extends React.PureComponent<BasicProps> {
    static propTypes = {
        prefixCls: PropTypes.string,
        style: PropTypes.object,
        className: PropTypes.string,
    };

    static defaultProps = {
        prefixCls: cssClasses.PREFIX,
    };

    render() {
        const { prefixCls, type, className, children, tagName, ...others } = this.props;
        const classString = cls(className, `${prefixCls}-${type}`);
        return React.createElement(tagName, { className: classString, ...others }, children);
    }
}

const Header = generator<BasicProps>('Header')(Basic);
const Footer = generator<BasicProps>('Footer')(Basic);
const Content = generator<BasicProps>('Content')(Basic);

export interface BasicLayoutProps {
    prefixCls?: string;
    style?: CSSProperties;
    className?: string;
    children?: React.ReactNode;
    hasSider?: boolean;
    tagName?: keyof HTMLElementTagNameMap
}

export interface BasicLayoutState {
    siders: Array<string>
}

class Layout extends React.Component<BasicLayoutProps, BasicLayoutState> {
    static propTypes = {
        prefixCls: PropTypes.string,
        style: PropTypes.object,
        className: PropTypes.string,
    };

    static defaultProps = {
        prefixCls: cssClasses.PREFIX,
        tagName: 'section'
    };
    static Header = Header;
    static Footer = Footer;
    static Content = Content;
    static Sider = Sider;

    constructor(props: BasicLayoutProps) {
        super(props);
        this.state = {
            siders: [],
        };
    }

    getSiderHook(): ContextType['siderHook'] {
        return {
            addSider: (id: string): void => {
                this.setState(state => ({
                    siders: [...state.siders, id],
                }));
            },
            removeSider: (id: string): void => {
                this.setState(state => ({
                    siders: state.siders.filter(curr => curr !== id),
                }));
            },
        };
    }

    render() {
        const { prefixCls, className, children, hasSider, tagName, ...others } = this.props;
        const { siders } = this.state;
        const classString = cls(className, prefixCls, {
            [`${prefixCls}-has-sider`]: typeof hasSider === 'boolean' && hasSider || siders.length > 0 || React.Children.toArray(children).some((child: React.ReactNode) => {
                return React.isValidElement(child) && child.type && (child.type as any).elementType === "Layout.Sider";
            }),
        });
        const Tag: any = tagName;
        return (
            <LayoutContext.Provider value={{ siderHook: this.getSiderHook() }}>
                <Tag className={classString} {...others}>
                    {children}
                </Tag>
            </LayoutContext.Provider>
        );
    }
}

export { Layout };
export default Layout;
