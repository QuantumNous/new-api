import React, { CSSProperties } from 'react';
/* REACT_18_START */
import ReactDOM from 'react-dom';
/* REACT_18_END */
/* REACT_19_START */
// import { createRoot } from 'react-dom/client';
/* REACT_19_END */
import cls from 'classnames';
import PropTypes from 'prop-types';
import ConfigContext, { ContextValue } from '../configProvider/context';
import NotificationListFoundation, {
    ConfigProps, NotificationListAdapter,
    NotificationListProps,
    NotificationListState
} from '@douyinfe/semi-foundation/notification/notificationListFoundation';
import { cssClasses, strings } from '@douyinfe/semi-foundation/notification/constants';
import Notice from './notice';
import BaseComponent from '../_base/baseComponent';
import '@douyinfe/semi-foundation/notification/notification.scss';
import getUuid from '@douyinfe/semi-foundation/utils/uuid';
import useNotification from './useNotification';
import {
    NoticeInstance,
    NoticePosition,
    NoticeProps,
    NoticeState
} from '@douyinfe/semi-foundation/notification/notificationFoundation';
import CSSAnimation from "../_cssAnimation";

// TODO: Automatic folding + unfolding function when there are more than N

export interface NoticeReactProps extends NoticeProps {
    style?: CSSProperties
}

export type {
    NoticeState,
    NotificationListProps,
    NotificationListState,
    ConfigProps
};

export type NoticesInPosition = {
    top: NoticeInstance[];
    topLeft: NoticeInstance[];
    topRight: NoticeInstance[];
    bottom: NoticeInstance[];
    bottomLeft: NoticeInstance[];
    bottomRight: NoticeInstance[]
};


let ref: NotificationList = null;
const defaultConfig = {
    duration: 3,
    position: 'topRight' as NoticePosition,
    motion: true,
    content: '',
    title: '',
    zIndex: 1010,
};

class NotificationList extends BaseComponent<NotificationListProps, NotificationListState> {
    static contextType = ConfigContext;
    static propTypes = {
        style: PropTypes.object,
        className: PropTypes.string,
        direction: PropTypes.oneOf(strings.directions),
    };
    static defaultProps = {};
    static useNotification: typeof useNotification;
    private static wrapperId: string;
    /* REACT_19_START */
    // private static root: any = null;
    /* REACT_19_END */
    private noticeStorage: NoticeInstance[];
    private removeItemStorage: NoticeInstance[];


    constructor(props: NotificationListProps) {
        super(props);
        this.state = {
            notices: [],
            removedItems: [],
            updatedItems: []
        };
        this.noticeStorage = [];
        this.removeItemStorage = [];

        this.foundation = new NotificationListFoundation(this.adapter);
    }

    context: ContextValue;

    get adapter(): NotificationListAdapter {
        return {
            ...super.adapter,
            updateNotices: (notices: NoticeInstance[], removedItems: NoticeInstance[] = [], updatedItems: NoticeInstance[] = []) => {
                this.noticeStorage = [...notices];
                this.removeItemStorage = [...removedItems];
                // setState is async sometimes and react often merges state, so use "this" , make sure other code always get right data.
                this.setState({ notices, removedItems, updatedItems });
            },
            getNotices: () => this.noticeStorage,
        };
    }

    static addNotice(notice: NoticeProps) {
        notice = { ...defaultConfig, ...notice };
        const id = notice.id ?? getUuid('notification');
        if (!ref) {
            const { getPopupContainer } = notice;
            const div = document.createElement('div');
            if (!this.wrapperId) {
                this.wrapperId = getUuid('notification-wrapper').slice(0, 32);
            }
            div.className = cssClasses.WRAPPER;
            div.id = this.wrapperId;
            div.style.zIndex = String(typeof notice.zIndex === 'number' ? notice.zIndex : defaultConfig.zIndex);
            if (getPopupContainer) {
                const container = getPopupContainer();
                container.appendChild(div);
            } else {
                document.body.appendChild(div);
            }
            /* REACT_18_START */
            ReactDOM.render(React.createElement(NotificationList, { ref: instance => (ref = instance) }), div, () => {
                ref.add({ ...notice, id });
            });
            /* REACT_18_END */
            
            /* REACT_19_START */
            // if (!this.root) {
            //     this.root = createRoot(div);
            // }
            // this.root.render(React.createElement(NotificationList, { ref: instance => (ref = instance) }));
            // // 在 React 19 中，render 是同步的，确保 ref 已赋值后再执行add方法
            // if (typeof queueMicrotask === 'function') {
            //     queueMicrotask(() => {
            //         ref.add({ ...notice, id });
            //     });
            // } else {
            //     Promise.resolve().then(() => {
            //         ref.add({ ...notice, id });
            //     });
            // }
            /* REACT_19_END */
        } else {
            if (ref.has(`${id}`)) {
                ref.update(id, notice);
            } else {
                ref.add({ ...notice, id });
            }

        }
        return id;
    }

    static removeNotice(id: string) {
        if (ref) {
            ref.remove(id);
        }

        return id;
    }

    static info(opts: NoticeProps) {
        return this.addNotice({ ...opts, type: 'info' });
    }

    static success(opts: NoticeProps) {
        return this.addNotice({ ...opts, type: 'success' });
    }

    static error(opts: NoticeProps) {
        return this.addNotice({ ...opts, type: 'error' });
    }

    static warning(opts: NoticeProps) {
        return this.addNotice({ ...opts, type: 'warning' });
    }

    static open(opts: NoticeProps) {
        return this.addNotice({ ...opts, type: 'default' });
    }

    static close(id: string) {
        return this.removeNotice(id);
    }

    static destroyAll() {
        if (ref) {
            ref.destroyAll();
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
            
            ref = null;
            this.wrapperId = null;
        }
    }

    static config(opts: ConfigProps) {
        ['top', 'left', 'bottom', 'right'].map(pos => {
            if (pos in opts) {
                defaultConfig[pos] = opts[pos];
            }
        });

        if (typeof opts.zIndex === 'number') {
            defaultConfig.zIndex = opts.zIndex;
        }
        if (typeof opts.duration === 'number') {
            defaultConfig.duration = opts.duration;
        }
        if (typeof opts.position === 'string') {
            defaultConfig.position = opts.position as NoticePosition;
        }
    }

    add = (noticeOpts: NoticeProps) => this.foundation.addNotice(noticeOpts);

    has = (id: string) => this.foundation.has(id);

    remove = (id: string) => {
        this.foundation.removeNotice(String(id));
    };



    update = (id: string, opts: NoticeProps)=>{
        return this.foundation.update(id, opts);
    }

    destroyAll = () => this.foundation.destroyAll();

    renderNoticeInPosition = (
        notices: NoticeInstance[],
        position: NoticePosition,
        removedItems: NoticeInstance[] = [],
        updatedItems: NoticeInstance[] = []
    ) => {
        const className = cls(cssClasses.LIST);
        // TODO notifyOnClose
        if (notices.length) {
            const style = this.setPosInStyle(notices[0]);
            return (
                // @ts-ignore
                <div placement={position} key={position} className={className} style={style}>
                    {notices.map((notice, index) => {
                        const isRemoved = removedItems.find(removedItem => removedItem.id === notice.id) !== undefined;
                        return <CSSAnimation key={notice.id}
                            animationState={isRemoved ? "leave" : "enter"}
                            startClassName={`${cssClasses.NOTICE}-animation-${isRemoved ? "hide" : "show"}_${position}`}>
                            {({ animationClassName, animationEventsNeedBind, isAnimating }) => {
                                return isRemoved && !isAnimating ? null : <Notice
                                    {...notice}
                                    ref={(notice)=>{
                                        if (notice && updatedItems.some(item=>item.id===notice.props.id)) {
                                            notice.foundation.restartCloseTimer();
                                        }
                                    }}
                                    className={cls({
                                        [notice.className]: Boolean(notice.className),
                                        [animationClassName]: true,
                                    })}
                                    {...animationEventsNeedBind}
                                    style={{ ...notice.style }}
                                    close={this.remove}
                                />;
                            }}
                        </CSSAnimation>;
                    }
                    )}
                </div>
            );
        }
        return null;
    };

    setPosInStyle(noticeInstance: NoticeInstance) {
        const style = {};
        ['top', 'left', 'bottom', 'right'].forEach(pos => {
            if (pos in noticeInstance) {
                const val = noticeInstance[pos];
                style[pos] = typeof val === 'number' ? `${val}px` : val;
            }
        });
        return style;
    }

    render() {
        let { notices } = this.state;
        const { removedItems, updatedItems } = this.state;
        notices = Array.from(new Set([...notices, ...removedItems]));
        const noticesInPosition: NoticesInPosition = {
            top: [],
            topLeft: [],
            topRight: [],
            bottom: [],
            bottomLeft: [],
            bottomRight: [],
        };
        notices.forEach(notice => {
            const direction = notice.direction || this.context.direction;
            const defaultPosition = direction === 'rtl' ? 'topLeft' : 'topRight';
            const position = notice.position || defaultPosition;
            noticesInPosition[position].push(notice);
        });
        const noticesList = Object.entries(noticesInPosition).map(obj => {
            const pos = obj[0];
            const noticesInPos = obj[1];
            return this.renderNoticeInPosition(noticesInPos, pos as NoticePosition, removedItems, updatedItems);
        });

        return <React.Fragment>{noticesList}</React.Fragment>;
    }


}

NotificationList.useNotification = useNotification;

export default NotificationList;
