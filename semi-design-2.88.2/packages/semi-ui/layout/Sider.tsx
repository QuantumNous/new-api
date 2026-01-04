import React, { AriaRole, CSSProperties } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/layout/constants';
import getDataAttr from '@douyinfe/semi-foundation/utils/getDataAttr';
import LayoutContext, { ContextType } from './layout-context';
import { registerMediaQuery } from '../_utils';

const responsiveMap: ResponsiveMap = {
    xs: '(max-width: 575px)',
    sm: '(min-width: 576px)',
    md: '(min-width: 768px)',
    lg: '(min-width: 992px)',
    xl: '(min-width: 1200px)',
    xxl: '(min-width: 1600px)',
};

export interface ResponsiveMap {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string
}

const generateId = ((): () => string => {
    let i = 0;
    return (): string => {
        i += 1;
        return `${cssClasses.PREFIX}-sider-${i}`;
    };
})();

const bpt = strings.BREAKPOINT;

export interface SiderProps {
    prefixCls?: string;
    style?: CSSProperties;
    className?: string;
    children?: React.ReactNode;
    breakpoint?: Array<keyof ResponsiveMap>;
    onBreakpoint?: (screen: keyof ResponsiveMap, match: boolean) => void;
    'aria-label'?: React.AriaAttributes['aria-label'];
    'role'?: React.AriaRole
}

class Sider extends React.PureComponent<SiderProps> {
    static propTypes = {
        prefixCls: PropTypes.string,
        style: PropTypes.object,
        className: PropTypes.string,
        breakpoint: PropTypes.arrayOf(PropTypes.oneOf(bpt)),
        onBreakpoint: PropTypes.func,
        'aria-label': PropTypes.string,
        role: PropTypes.string,
    };

    static defaultProps = {
        prefixCls: cssClasses.PREFIX,
    };

    static contextType = LayoutContext;
    static elementType = "Layout.Sider"

    unRegisters: Array<() => void> = [];
    context: ContextType;
    uniqueId = '';

    constructor(props: SiderProps) {
        super(props);
        this.uniqueId = generateId();
    }

    componentDidMount(): void {
        const { breakpoint } = this.props;
        const matchBpt: Array<keyof ResponsiveMap> = (Object.keys(responsiveMap) as (keyof ResponsiveMap)[]).filter((item) => breakpoint && breakpoint.indexOf(item) !== -1) as any;
        const unRegisters = matchBpt.map(screen => registerMediaQuery(responsiveMap[screen], {
            match: () => {
                this.responsiveHandler(screen, true);
            },
            unmatch: () => {
                this.responsiveHandler(screen, false);
            },
        }));
        this.unRegisters = unRegisters;

        if (this.context.siderHook) {
            this.context.siderHook.addSider(this.uniqueId);
        }
    }

    componentWillUnmount(): void {
        this.unRegisters.forEach(unRegister => unRegister());

        if (this.context.siderHook) {
            this.context.siderHook.removeSider(this.uniqueId);
        }
    }

    responsiveHandler(screen: keyof ResponsiveMap, matches: boolean): void {
        const { onBreakpoint } = this.props;
        if (onBreakpoint) {
            onBreakpoint(screen, matches);
        }
    }

    render() {
        const { prefixCls, className, children, style, ...others } = this.props;
        const classString = cls(className, {
            [`${prefixCls}-sider`]: true,
        });
        return (
            <aside className={classString} aria-label={this.props['aria-label']} style={style} {...getDataAttr(others)}>
                <div className={`${prefixCls}-sider-children`}>
                    {children}
                </div>
            </aside>
        );
    }
}

export default Sider;
