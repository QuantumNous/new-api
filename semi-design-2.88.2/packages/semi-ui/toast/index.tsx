import React, { CSSProperties } from 'react';
/* REACT_18_START */
import ReactDOM from 'react-dom';
/* REACT_18_END */
/* REACT_19_START */
// import { createRoot } from 'react-dom/client';
/* REACT_19_END */
import PropTypes from 'prop-types';
import ToastListFoundation, {
    ToastListAdapter,
    ToastListProps,
    ToastListState
} from '@douyinfe/semi-foundation/toast/toastListFoundation';
import { cssClasses, strings } from '@douyinfe/semi-foundation/toast/constants';
import BaseComponent from '../_base/baseComponent';
import Toast from './toast';
import '@douyinfe/semi-foundation/toast/toast.scss';
import getUuid from '@douyinfe/semi-foundation/utils/uuid';
import useToast from './useToast';
import { ConfigProps, ToastInstance, ToastProps, ToastState } from '@douyinfe/semi-foundation/toast/toastFoundation';
import CSSAnimation from '../_cssAnimation';
import cls from 'classnames';


export interface ToastReactProps extends ToastProps{
    id?: string;
    style?: CSSProperties;
    icon?: React.ReactNode;
    content: React.ReactNode
}

export type {
    ConfigProps,
    ToastListProps,
    ToastListState,
    ToastState
};

const createBaseToast = () => class ToastList extends BaseComponent<ToastListProps, ToastListState> {
    static ref: ToastList;
    static useToast: typeof useToast;
    static defaultOpts: ToastReactProps & { motion: boolean } = {
        motion: true,
        zIndex: 1010,
        content: '',
    };
    static propTypes = {
        content: PropTypes.node,
        duration: PropTypes.number,
        onClose: PropTypes.func,
        icon: PropTypes.node,
        direction: PropTypes.oneOf(strings.directions),
        stack: PropTypes.bool,
    };

    static defaultProps = {};
    static wrapperId: null | string;
    /* REACT_19_START */
    // static root: any = null;
    /* REACT_19_END */
    stack: boolean = false;

    innerWrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

    constructor(props: ToastListProps) {
        super(props);
        this.state = {
            list: [],
            removedItems: [],
            updatedItems: [],
            mouseInSide: false
        };
        this.foundation = new ToastListFoundation(this.adapter);
    }

    get adapter(): ToastListAdapter {
        return {
            ...super.adapter,
            updateToast: (list: ToastInstance[], removedItems: ToastInstance[], updatedItems: ToastInstance[]) => {
                this.setState({ list, removedItems, updatedItems });
            },
            handleMouseInSideChange: (mouseInSide: boolean) => {
                this.setState({ mouseInSide });
            },
            getInputWrapperRect: () => {
                return this.innerWrapperRef.current?.getBoundingClientRect();
            }
        };
    }

    handleMouseEnter = (e: React.MouseEvent) => {
        if (this.stack) {
            this.foundation.handleMouseInSideChange(true);
        } 
    }

    handleMouseLeave = (e: React.MouseEvent) => {
        if (this.stack) {
            const height = this.foundation.getInputWrapperRect()?.height;
            if (height) {
                this.foundation.handleMouseInSideChange(false);
            } 
        }
    }

    static create(opts: ToastReactProps) {
        const id = opts.id ?? getUuid('toast');
        // this.id = id;
        if (!ToastList.ref) {
            const div = document.createElement('div');
            if (!this.wrapperId) {
                this.wrapperId = getUuid('toast-wrapper').slice(0, 26);
            }
            div.className = cssClasses.WRAPPER;
            div.id = this.wrapperId;
            div.style.zIndex = String(typeof opts.zIndex === 'number' ?
                opts.zIndex : ToastList.defaultOpts.zIndex);
            ['top', 'left', 'bottom', 'right'].map(pos => {
                if (pos in ToastList.defaultOpts || pos in opts) {
                    const val = opts[pos] ? opts[pos] : ToastList.defaultOpts[pos];
                    div.style[pos] = typeof val === 'number' ? `${val}px` : val;
                }
            });
            // document.body.appendChild(div);
            if (ToastList.defaultOpts.getPopupContainer) {
                const container = ToastList.defaultOpts.getPopupContainer();
                container.appendChild(div);
            } else {
                document.body.appendChild(div);
            }
            /* REACT_18_START */
            ReactDOM.render(React.createElement( 
                ToastList,
                { ref: instance => (ToastList.ref = instance) }
            ),
            div,
            () => {
                ToastList.ref.add({ ...opts, id });
                ToastList.ref.stack = Boolean(opts.stack);
            });
            /* REACT_18_END */
            
            /* REACT_19_START */
            // if (!this.root) {
            //     this.root = createRoot(div);
            // }
            // this.root.render(React.createElement( 
            //     ToastList,
            //     { ref: instance => (ToastList.ref = instance) }
            // ));
            // // 在 React 19 中，render 是同步的，确保 ref 已赋值后再执行add方法
            // if (typeof queueMicrotask === 'function') {
            //     queueMicrotask(() => {
            //         ToastList.ref.add({ ...opts, id });
            //         ToastList.ref.stack = Boolean(opts.stack);
            //     });
            // } else {
            //     Promise.resolve().then(() => {
            //         ToastList.ref.add({ ...opts, id });
            //         ToastList.ref.stack = Boolean(opts.stack);
            //     });
            // }
            /* REACT_19_END */
        } else {
            const node = document.querySelector(`#${this.wrapperId}`) as HTMLElement;
            ['top', 'left', 'bottom', 'right'].map(pos => {
                if (pos in opts) {
                    node.style[pos] = typeof opts[pos] === 'number' ? `${opts[pos]}px` : opts[pos];
                }
            });
            if (Boolean(opts.stack) !== ToastList.ref.stack) {
                ToastList.ref.stack = Boolean(opts.stack);
            }
            if (ToastList.ref.has(id)) {
                ToastList.ref.update(id, { ...opts, id });
            } else {
                ToastList.ref.add({ ...opts, id });
            }
        }
        return id;
    }

    static close(id: string) {
        if (ToastList.ref) {
            ToastList.ref.remove(id);
        }
    }

    static destroyAll() {
        if (ToastList.ref) {
            ToastList.ref.destroyAll();
            const wrapper = document.querySelector(`#${this.wrapperId}`);
            
            /* REACT_18_START */
            ReactDOM.unmountComponentAtNode(wrapper);
            wrapper && wrapper.parentNode.removeChild(wrapper);
            /* REACT_18_END */
            
            /* REACT_19_START */
            // if (this.root) {
            //     this.root.unmount();
            //     this.root = null;
            // }
            // wrapper && wrapper.parentNode.removeChild(wrapper);
            /* REACT_19_END */
            
            ToastList.ref = null;
            this.wrapperId = null;
        }
    }
    static getWrapperId() {
        return this.wrapperId;
    }
    static info(opts: Omit<ToastReactProps, 'type'> | string) {
        if (typeof opts === 'string') {
            opts = { content: opts };
        }
        return this.create({ ...ToastList.defaultOpts, ...opts, type: 'info' });
    }

    static warning(opts: Omit<ToastReactProps, 'type'> | string) {
        if (typeof opts === 'string') {
            opts = { content: opts };
        }
        return this.create({ ...ToastList.defaultOpts, ...opts, type: 'warning' });
    }

    static error(opts: Omit<ToastReactProps, 'type'> | string) {
        if (typeof opts === 'string') {
            opts = { content: opts };
        }
        return this.create({ ...ToastList.defaultOpts, ...opts, type: 'error' });
    }

    static success(opts: Omit<ToastReactProps, 'type'> | string) {
        if (typeof opts === 'string') {
            opts = { content: opts };
        }
        return this.create({ ...ToastList.defaultOpts, ...opts, type: 'success' });
    }

    static config(opts: ConfigProps) {
        ['top', 'left', 'bottom', 'right'].forEach(pos => {
            if (pos in opts) {
                ToastList.defaultOpts[pos] = opts[pos];
            }
        });

        if (typeof opts.theme === 'string' && strings.themes.includes(opts.theme)) {
            ToastList.defaultOpts.theme = opts.theme;
        }
        if (typeof opts.zIndex === 'number') {
            ToastList.defaultOpts.zIndex = opts.zIndex;
        }
        if (typeof opts.duration === 'number') {
            ToastList.defaultOpts.duration = opts.duration;
        }
        if (typeof opts.getPopupContainer === 'function') {
            ToastList.defaultOpts.getPopupContainer = opts.getPopupContainer;
        }
    }

    has(id: string) {
        return this.foundation.hasToast(id);
    }

    add(opts: ToastInstance) {
        return this.foundation.addToast(opts);
    }

    update(id: string, opts: ToastInstance) {
        return this.foundation.updateToast(id, opts);
    }

    remove(id: string) {
        return this.foundation.removeToast(id);
    }

    destroyAll() {
        return this.foundation.destroyAll();
    }

    render() {
        let { list } = this.state;
        const { removedItems, updatedItems } = this.state;
        list = Array.from(new Set([...list, ...removedItems]));
        const updatedIds = updatedItems.map(({ id }) => id);

        const refFn: React.LegacyRef<Toast> = (toast) => {
            if (toast?.foundation?._id && updatedIds.includes(toast.foundation._id)) {
                toast.foundation.restartCloseTimer();
            }
        };

        return (
            <React.Fragment>
                <div className={cls({
                    [`${cssClasses.PREFIX}-innerWrapper`]: true,
                    [`${cssClasses.PREFIX}-innerWrapper-hover`]: this.state.mouseInSide
                })} ref={this.innerWrapperRef} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
                    {list.map((item, index) =>{
                        const isRemoved = removedItems.find(removedItem=>removedItem.id===item.id) !== undefined;
                        return <CSSAnimation key={item.id} motion={item.motion} animationState={isRemoved?"leave":"enter"} startClassName={isRemoved?`${cssClasses.PREFIX}-animation-hide`:`${cssClasses.PREFIX}-animation-show`}>
                            {
                                ({ animationClassName, animationEventsNeedBind, isAnimating })=>{
                                    return (isRemoved && !isAnimating) ? null : <Toast {...item} stack={this.stack} stackExpanded={this.state.mouseInSide} positionInList={{ length: list.length, index }} className={cls({
                                        [item.className]: Boolean(item.className),
                                        [animationClassName]: true
                                    })} {...animationEventsNeedBind} style={{ ...item.style }} close={id => this.remove(id)} ref={refFn} />;
                                }
                            }
                        </CSSAnimation>;
                    }
                    )}
                </div>
            </React.Fragment>
        );
    }


};


export class ToastFactory {
    static create(config?: ConfigProps): ReturnType<typeof createBaseToast> {
        const newToast = createBaseToast();
        newToast.useToast = useToast;
        config && newToast.config(config);
        return newToast;

    }
}
export default ToastFactory.create();
