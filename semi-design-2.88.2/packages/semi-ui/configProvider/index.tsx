import React from 'react';
import PropTypes from 'prop-types';
import { BASE_CLASS_PREFIX } from '@douyinfe/semi-foundation/base/constants';
import DefaultLocale from '../locale/source/zh_CN';
import Context, { ContextValue } from './context';

export interface ConfigProviderProps extends ContextValue {}

export const ConfigConsumer = Context.Consumer;

export default class ConfigProvider extends React.Component<ConfigProviderProps> {

    constructor(props: ConfigProviderProps) {
        super(props);
    }


    static propTypes = {
        locale: PropTypes.object,
        timeZone: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        getPopupContainer: PropTypes.func,
        direction: PropTypes.oneOf(['ltr', 'rtl']),
    };

    static defaultProps = {
        locale: DefaultLocale,
        direction: 'ltr',
    };



    renderChildren() {
        const { direction, children } = this.props;
        if (direction === 'rtl') {
            return (
                <div className={`${BASE_CLASS_PREFIX}-rtl`}>
                    {children}
                </div>
            );
        }
        return children;
    }

    render() {
        const { children, direction, ...rest } = this.props;
        return (
            <Context.Provider
                value={{
                    direction,
                    ...rest,
                }}
            >
                {this.renderChildren()}
            </Context.Provider>
        );
    }
}
