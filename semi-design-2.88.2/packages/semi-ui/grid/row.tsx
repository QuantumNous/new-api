/**
 * Implementation reference from: https://github.com/ant-design/ant-design/blob/master/components/grid/row.tsx
 */
import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/grid/constants';
import '@douyinfe/semi-foundation/grid/grid.scss';
import { registerMediaQuery } from '../_utils';

const responsiveArray = ['xxl', 'xl', 'lg', 'md', 'sm', 'xs'];

export interface RowContextType {
    gutters?: Gutter | [Gutter, Gutter]
}

export const RowContext = React.createContext<RowContextType>(null);

export type Breakpoint = 'xxl' | 'xl' | 'lg' | 'md' | 'sm' | 'xs';

export type Gutter = number | Partial<Record<Breakpoint, number>>;

export interface RowProps {
    type?: 'flex';
    align?: 'top' | 'middle' | 'bottom';
    justify?: 'start' | 'end' | 'center' | 'space-around' | 'space-between';
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    gutter?: Gutter | [Gutter, Gutter];
    prefixCls?: string
}

export interface RowState {
    screens: Partial<Record<Breakpoint, boolean>>
}

const responsiveMap = {
    xs: '(max-width: 575px)',
    sm: '(min-width: 576px)',
    md: '(min-width: 768px)',
    lg: '(min-width: 992px)',
    xl: '(min-width: 1200px)',
    xxl: '(min-width: 1600px)',
};

class Row extends React.Component<RowProps, RowState> {
    static propTypes = {
        type: PropTypes.oneOf(['flex']),
        align: PropTypes.oneOf(['top', 'middle', 'bottom']),
        justify: PropTypes.oneOf(['start', 'end', 'center', 'space-around', 'space-between']),
        className: PropTypes.string,
        style: PropTypes.object,
        children: PropTypes.node,
        gutter: PropTypes.oneOfType([PropTypes.object, PropTypes.number, PropTypes.array]),
        prefixCls: PropTypes.string,
    };

    static defaultProps = {
        prefixCls: cssClasses.PREFIX,
    };

    static RowContext = {
        gutters: PropTypes.any,
    };

    state = {
        screens: {
            xs: true,
            sm: true,
            md: true,
            lg: true,
            xl: true,
            xxl: true,
        }
    };

    unRegisters: Array<() => void> = [];

    componentDidMount() {
        this.unRegisters = Object.keys(responsiveMap).map(screen => registerMediaQuery(responsiveMap[screen], {
            match: () => {
                if (typeof this.props.gutter !== 'object') {
                    return;
                }
                this.setState(prevState => ({
                    screens: {
                        ...prevState.screens,
                        [screen]: true,
                    },
                }));
            },
            unmatch: () => {
                if (typeof this.props.gutter !== 'object') {
                    return;
                }
                this.setState(prevState => ({
                    screens: {
                        ...prevState.screens,
                        [screen]: false,
                    },
                }));
            },
        }));
    }

    componentWillUnmount() {
        this.unRegisters.forEach(unRegister => unRegister());
    }

    getGutter() {
        const { gutter = 0 } = this.props;
        const results: [number, number] = [0, 0];
        const normalizedGutter = Array.isArray(gutter) ? gutter.slice(0, 2) : [gutter, 0];
        normalizedGutter.forEach((g, index) => {
            if (typeof g === 'object') {
                for (let i = 0; i < responsiveArray.length; i++) {
                    const breakpoint = responsiveArray[i];
                    if (this.state.screens[breakpoint] && g[breakpoint] !== undefined) {
                        results[index] = g[breakpoint];
                        break;
                    }
                }
            } else {
                results[index] = g || 0;
            }
        });
        return results;
    }

    render() {
        const { prefixCls, type, justify, align, className, style, children, ...others } = this.props;
        const gutters = this.getGutter();

        const prefix = `${prefixCls}-row`;

        const classes = classnames(
            {
                [prefix]: type !== 'flex',
                [`${prefix}-${type}`]: type,
                [`${prefix}-${type}-${justify}`]: type && justify,
                [`${prefix}-${type}-${align}`]: type && align,
            },
            className
        );
        const rowStyle = {
            ...(gutters[0] > 0 ?
                {
                    marginLeft: gutters[0] / -2,
                    marginRight: gutters[0] / -2,
                } :
                {}),
            ...(gutters[1] > 0 ?
                {
                    marginTop: gutters[1] / -2,
                    marginBottom: gutters[1] / -2,
                } :
                {}),
            ...style,
        };

        const otherProps = { ...others };
        delete otherProps.gutter;
        return (
            <RowContext.Provider
                value={{
                    gutters,
                }}
            >
                <div {...otherProps} className={classes} style={rowStyle} x-semi-prop="children">
                    {children}
                </div>
            </RowContext.Provider>
        );
    }
}

export default Row;
