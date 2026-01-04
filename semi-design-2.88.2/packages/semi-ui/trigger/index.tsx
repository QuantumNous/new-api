import React from 'react';
import PropTypes from 'prop-types';

export interface TriggerProps {
    triggerRender?: (props?: any) => React.ReactNode;
    componentName?: string;
    componentProps?: Record<string, any>;
    value?: any;
    inputValue?: string;
    placeholder?: string | string[];
    className?: string;
    style?: React.CSSProperties;
    [x: string]: any
}
/**
 * `Trigger` is a HOC that will cover the inner of components which have popups
 */
class Trigger extends React.PureComponent<TriggerProps> {
    static propTypes = {
        /**
         * ({ value?: any, className?: string, style?: React.CSSProperties, ... }) => React.ReactNode
         */
        triggerRender: PropTypes.func.isRequired,
        /**
         * e.g. "AutoComplete", "DatePicker", ...
         */
        componentName: PropTypes.string,
        componentProps: PropTypes.object,
        value: PropTypes.any,
        inputValue: PropTypes.string,
        placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
        className: PropTypes.string,
        style: PropTypes.object,
    };

    render() {
        const { triggerRender, componentName, ...rest } = this.props;
        return triggerRender({ ...rest });
    }
}

export default Trigger;
