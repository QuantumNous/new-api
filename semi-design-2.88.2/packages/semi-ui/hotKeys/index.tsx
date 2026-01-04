import React, { ReactNode } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import HotKeysFoudation, { HotKeysAdapter } from '@douyinfe/semi-foundation/hotKeys/foundation';
import { cssClasses, Keys } from '@douyinfe/semi-foundation/hotKeys/constants';
import BaseComponent from '../_base/baseComponent';
import { noop } from 'lodash';
import '@douyinfe/semi-foundation/hotKeys/hotKeys.scss';
const prefixCls = cssClasses.PREFIX;

export interface HotKeysProps {
    preventDefault?: boolean;
    hotKeys?: KeyboardEvent["key"][];
    content?: string[];
    onClick?: () => void;
    onHotKey?: (e: KeyboardEvent) => void;
    mergeMetaCtrl?: boolean;
    render?: () => ReactNode | ReactNode;
    getListenerTarget?: () => HTMLElement;
    className?: string;
    style?: React.CSSProperties
}

export interface HotKeysState {
}

class HotKeys extends BaseComponent<HotKeysProps, HotKeysState> {
    static propTypes = {
        preventDefault: PropTypes.bool,
        hotKeys: PropTypes.arrayOf(PropTypes.string),
        content: PropTypes.arrayOf(PropTypes.string),
        onClick: PropTypes.func,
        onHotKey: PropTypes.func,
        mergeMetaCtrl: PropTypes.bool,
        render: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
        getListenerTarget: PropTypes.func,
        className: PropTypes.string,
        style: PropTypes.object,
    };

    static defaultProps: Partial<HotKeysProps> = {
        preventDefault: false,
        hotKeys: null,
        content: null,
        onClick: noop,
        onHotKey: noop,
        mergeMetaCtrl: false,
        render: undefined,
        getListenerTarget: () => document.body,
        className: '',
        style: null,
    };

    static Keys = Keys

    constructor(props: HotKeysProps) {
        super(props);
        this.state = {
        };
        this.foundation = new HotKeysFoudation(this.adapter);
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentDidUpdate(_prevProps: HotKeysProps) {
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    foundation: HotKeysFoudation;

    get adapter(): HotKeysAdapter<HotKeysProps, HotKeysState> {
        return {
            ...super.adapter,
            notifyHotKey: (e: KeyboardEvent) => {
                this.props.onHotKey?.(e);
            },
            registerEvent: () => {
                let target = this.props.getListenerTarget?.() ?? document.body;
                target.addEventListener('keydown', this.foundation.handleKeyDown);
            },
            unregisterEvent: () => {
                let target = this.props.getListenerTarget?.() ?? document.body;
                target.removeEventListener('keydown', this.foundation.handleKeyDown);
            }
        };
    }


    render() {
        const { hotKeys, content, onClick, render, getListenerTarget, className, style, ...rest } = this.props;
 
        if (typeof render !== 'undefined') {
            if (render === null || (typeof render === 'function' && render() === null)) {
                return null;
            }
            return (
                <div 
                    onClick={onClick}
                    className={classNames(prefixCls, className)}
                    style={style}
                    {...this.getDataAttr(rest)}    
                >
                    { typeof render === 'function' ? render() : render }
                </div>
            );
        }
        const renderContent = content ?? hotKeys;

        return (
            <div
                onClick={onClick}
                className={classNames(prefixCls, className)}
                style={style}
                {...this.getDataAttr(rest)}  
            >
                {renderContent.map((key: KeyboardEvent["key"], index) => {
                    return index === 0 ?
                        (<span key={index}>
                            <span className={prefixCls + '-content'}>{key}</span>
                        </span>)
                        :
                        (<span key={index}>
                            <span className={prefixCls + '-split'}>+</span>
                            <span className={prefixCls + '-content'}>{key}</span>
                        </span>);
                })}
            </div>
        );
    }
}

export default HotKeys;
