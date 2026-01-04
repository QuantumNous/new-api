import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { NoticeInstance, NoticePosition, NoticeProps } from '../notification/notificationFoundation';
import { strings } from './constants';


export interface NotificationListProps {

}

export interface NotificationListState {
    notices: NoticeInstance[];
    removedItems: NoticeInstance[];
    updatedItems: NoticeInstance[]
}

export interface NotificationListAdapter extends DefaultAdapter<NotificationListProps, NotificationListState> {
    updateNotices: (notices: NoticeInstance[], removedItems?: NoticeInstance[], updatedItems?: NoticeInstance[]) => void;
    getNotices: () => NoticeInstance[]
}


export interface ConfigProps {
    top?: number | string;
    bottom?: number | string;
    left?: number | string;
    right?: number | string;
    duration?: number;
    position?: NoticePosition;
    zIndex?: number;
    direction?: typeof strings.directions[number]
}


export default class NotificationListFoundation extends BaseFoundation<NotificationListAdapter> {

    addNotice(opts: NoticeProps) {
        // let notices = this._adapter.getNotices();
        const notices = this._adapter.getNotices();

        // opts = { ...opts, id };
        // if (opts.duration) {
        //     setTimeout(() => {
        //         this.removeNotice(opts.id);
        //     }, opts.duration * 1000);
        // }
        this._adapter.updateNotices([opts, ...notices]);
        // return id;
    }

    has(id: string) {
        return this._adapter.getNotices().some(notice=>notice.id===id);
    }

    update(id: string, noticeOpts: NoticeProps) {
        let notices = this._adapter.getNotices();
        notices = notices.map((notice) => notice.id === id ? { ...notice, ...noticeOpts }: notice);
        const updatedItems = notices.filter(notice=>notice.id === id);
        this._adapter.updateNotices(notices, [], updatedItems);
    }

    removeNotice(id: string) {
        let notices = this._adapter.getNotices();
        // let notices = this._adapter.getNotices();
        const removedItems: NoticeInstance[] = [];
        notices = notices.filter(notice => {
            if (notice.id === id) {
                removedItems.push(notice);
                return false;
            }
            return true;
        });
        this._adapter.updateNotices(notices, removedItems); // This must be updated at the same time https://github.com/facebook/react/issues/12312
    }

    destroyAll() {
        const notices = this._adapter.getNotices();
        if (notices.length > 0) {
            this._adapter.updateNotices([], notices);
        }
    }

}
