import React, { PureComponent } from 'react';
import { createPortal } from 'react-dom';
import { BASE_CLASS_PREFIX } from '@douyinfe/semi-foundation/base/constants';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import ConfigContext, { ContextValue } from '../configProvider/context';
import '@douyinfe/semi-foundation/_portal/portal.scss';

export interface PortalProps {
    children: React.ReactNode;
    style?: React.CSSProperties;
    prefixCls?: string;
    className?: string;
    getPopupContainer?: () => HTMLElement;
    didUpdate?: (props: PortalProps) => void
}

export interface PortalState {
    container: undefined | HTMLElement
}

const defaultGetContainer = () => document.body;
class Portal extends PureComponent<PortalProps, PortalState> {
    static contextType = ConfigContext;

    static defaultProps = {
        // getPopupContainer: () => document.body,
        prefixCls: `${BASE_CLASS_PREFIX}-portal`,
    };

    static propTypes = {
        children: PropTypes.node,
        prefixCls: PropTypes.string,
        getPopupContainer: PropTypes.func,
        className: PropTypes.string,
        didUpdate: PropTypes.func,
    };

    el: HTMLElement;
    context: ContextValue;
    constructor(props: PortalProps, context: ContextValue) {
        super(props);
        this.state = {
            container: this.initContainer(context, true)
        };
    }

    componentDidMount() {
        const container = this.initContainer(this.context);
        if (container!==this.state.container) {
            this.setState({ container });
        }
    }

    initContainer = (context: ContextValue, catchError = false) => {
        try {
            let container: HTMLElement | undefined = undefined;
            if (!this.el || !this.state?.container || !Array.from(this.state.container.childNodes).includes(this.el)) {
                this.el = document.createElement('div');
                const getContainer = this.props.getPopupContainer || context.getPopupContainer || defaultGetContainer;
                const portalContainer = getContainer();
                portalContainer.appendChild(this.el);
                this.addStyle(this.props.style);
                this.addClass(this.props.prefixCls, context, this.props.className);
                container = portalContainer;
                return container;
            }
        } catch (e) {
            if (!catchError) {
                throw e;
            }
        }
        return this.state?.container;
    }

    componentDidUpdate(prevProps: PortalProps) {
        // visible callback
        const { didUpdate } = this.props;
        if (didUpdate) {
            didUpdate(prevProps);
        }
    }

    componentWillUnmount() {
        const { container } = this.state;
        if (container) {
            container.removeChild(this.el);
        }
    }

    addStyle = (style = {}) => {
        if (this.el) {
            for (const key of Object.keys(style)) {
                this.el.style[key] = style[key];
            }
        }
    };

    addClass = (prefixCls: string, context = this.context, ...classNames: string[]) => {
        const { direction } = context;
        const cls = classnames(prefixCls, ...classNames, {
            [`${prefixCls}-rtl`]: direction === 'rtl'
        });
        if (this.el) {
            this.el.className = cls;
        }
    };

    render() {
        const { state, props } = this;
        if (state.container) {
            return createPortal(props.children, this.el);
        }
        return null;
    }
}

export default Portal;
