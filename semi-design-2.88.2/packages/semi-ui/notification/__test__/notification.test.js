import { Notification, Button } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import NotificationItem from '../notice';
import { IconToutiaoLogo } from '@douyinfe/semi-icons';


describe('Notification', () => {

    it('title&content、zIndex', () => {
        Notification.open({
            title: 'Hi, Bytedance',
            content: 'ies dance dance dance',
            duration: 1,
            zIndex: 2333,
        });
        const notificationWrapper = document.querySelector(`.${BASE_CLASS_PREFIX}-notification-wrapper`);
        expect(
            notificationWrapper
            .style.zIndex
        ).toEqual("2333");
        const notificationInner = document.querySelector(`.${BASE_CLASS_PREFIX}-notification-notice-content-wrapper`);
        expect(
            notificationInner
            .childElementCount
        ).toEqual(2);
        expect(
            notificationInner
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('Hi, Bytedance');
        expect(
            notificationInner
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-notice-content`)
            .textContent
        ).toEqual('ies dance dance dance');
    });

    it('duration', () => {
        Notification.destroyAll();
        Notification.open({
            title: 'Hi, Bytedance',
            content: 'ies dance dance dance',
            duration: 1,
        })
        const notificationInner1 = document.querySelector(`.${BASE_CLASS_PREFIX}-notification-list`);
            expect(
                notificationInner1
                .childElementCount
            ).toEqual(1);
        setTimeout(() => {
            const notificationInner2 = document.querySelector(`.${BASE_CLASS_PREFIX}-notification-list`);
            expect(
                notificationInner2
                .childElementCount
            ).toEqual(0);
        }, 1000);
    });

    it('position-top', () => {
        Notification.destroyAll();
        Notification.open({
            title: 'top demo',
            content: 'ies dance dance dance',
            duration: 1,
            position: 'top'
        });
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-list[placement=top] .${BASE_CLASS_PREFIX}-notification-notice-content-wrapper .${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('top demo');
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-list[placement=bottom] .${BASE_CLASS_PREFIX}-notification-notice-content-wrapper .${BASE_CLASS_PREFIX}-notification-notice-title`)
        ).toEqual(null);
    });

    it('position-topLeft', () => {
        Notification.destroyAll();
        Notification.open({
            title: 'topLeft demo',
            content: 'ies dance dance dance',
            duration: 1,
            position: 'topLeft'
        });
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-list[placement=topLeft] .${BASE_CLASS_PREFIX}-notification-notice-content-wrapper .${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('topLeft demo');
    });

    it('position-bottomLeft', () => {
        Notification.destroyAll();
        Notification.open({
            title: 'bottomLeft demo',
            content: 'ies dance dance dance',
            duration: 1,
            position: 'bottomLeft'
        });
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-list[placement=bottomLeft] .${BASE_CLASS_PREFIX}-notification-notice-content-wrapper .${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('bottomLeft demo');
    });

    it('position-bottomRight', () => {
        Notification.destroyAll();
        Notification.open({
            title: 'bottomRight demo',
            content: 'ies dance dance dance',
            duration: 1,
            position: 'bottomRight'
        });
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-list[placement=bottomRight] .${BASE_CLASS_PREFIX}-notification-notice-content-wrapper .${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('bottomRight demo');
    });

    it('success', () => {
        Notification.destroyAll();
        Notification.success({
            title: 'success demo',
            duration: 1,
        });
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-notice-success .${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('success demo');
    });

    it('info', () => {
        Notification.destroyAll();
        Notification.info({
            title: 'info demo',
            duration: 1,
        });
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-notice-info .${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('info demo');
    });

    it('warning', () => {
        Notification.destroyAll();
        Notification.warning({
            title: 'warning demo',
            duration: 1,
        });
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-notice-warning .${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('warning demo');
    });

    it('error', () => {
        Notification.destroyAll();
        Notification.error({
            title: 'error demo',
            duration: 1,
        });
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-notice-error .${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('error demo');
    });

    it('theme error-light', () => {
        Notification.destroyAll();
        Notification.error({
            title: 'light error demo',
            duration: 1,
            theme: 'light'
        });
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-notice-light.${BASE_CLASS_PREFIX}-notification-notice-error .${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('light error demo');
    });

    it('theme info-light', () => {
        Notification.destroyAll();
        Notification.info({
            title: 'light info demo',
            duration: 1,
            theme: 'light'
        });
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-notice-light.${BASE_CLASS_PREFIX}-notification-notice-info .${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('light info demo');
    });

    it('theme warning-light', () => {
        Notification.destroyAll();
        Notification.warning({
            title: 'light warning demo',
            duration: 1,
            theme: 'light'
        });
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-notice-light.${BASE_CLASS_PREFIX}-notification-notice-warning .${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('light warning demo');
    });

    it('theme success-light', () => {
        Notification.destroyAll();
        Notification.success({
            title: 'light success demo',
            duration: 1,
            theme: 'light'
        });
        expect(
            document
            .querySelector(`.${BASE_CLASS_PREFIX}-notification-notice-light.${BASE_CLASS_PREFIX}-notification-notice-success .${BASE_CLASS_PREFIX}-notification-notice-title`)
            .textContent
        ).toEqual('light success demo');
    });

    it('onClick', () => {
        Notification.destroyAll();
        const spyOnClick = sinon.spy(() => {});
        const opts = {
            onClick: spyOnClick,
            content: 'content',
            title: 'title',
        };
        const notification = mount(<NotificationItem {...opts} />);
        notification.simulate('click', {});
        expect(spyOnClick.calledOnce).toEqual(true);
    })

    it('onClose', () => {
        Notification.destroyAll();
        const spyOnClose = sinon.spy(() => {});
        const opts = {
            onClose: spyOnClose,
            content: 'content',
            title: 'title',
        };
        const notification = mount(<NotificationItem {...opts} />);
        const closeBtn = notification.find(`.${BASE_CLASS_PREFIX}-notification-notice-inner .${BASE_CLASS_PREFIX}-button`);
        closeBtn.simulate('click', {});
        expect(spyOnClose.calledOnce).toEqual(true);
    });

    it('onCloseClick', () => {
        Notification.destroyAll();
        const spyOnCloseClick = sinon.spy(() => {});
        const opts = {
            onCloseClick: spyOnCloseClick,
            content: 'content',
            title: 'title',
        };
        const notification = mount(<NotificationItem {...opts} />);
        const closeBtn = notification.find(`.${BASE_CLASS_PREFIX}-notification-notice-inner .${BASE_CLASS_PREFIX}-button`);
        closeBtn.simulate('click', {});
        expect(spyOnCloseClick.calledOnce).toEqual(true);
    });

    it('showClose', () => {
        Notification.destroyAll();
        const spyOnCloseClick = sinon.spy(() => {});
        const opts = {
            onCloseClick: spyOnCloseClick,
            content: 'content',
            title: 'title',
            showClose: false
        };
        const notification = mount(<NotificationItem {...opts} />);
        expect(
            notification
            .exists(`.${BASE_CLASS_PREFIX}-notification-notice-inner .${BASE_CLASS_PREFIX}-button`)
        )
        .toEqual(false);
    });

    it('icon', () => {
        Notification.destroyAll();
        const opts = {
            content: 'content',
            title: 'title',
            icon: <IconToutiaoLogo style={{ color: 'red' }} size="large" />,
        };
        const notification = mount(<NotificationItem {...opts} />);
        expect(
            notification
            .exists(`.${BASE_CLASS_PREFIX}-notification-notice .${BASE_CLASS_PREFIX}-notification-notice-icon .${BASE_CLASS_PREFIX}-icon-toutiao_logo`)
        )
        .toEqual(true);
    });

    it('config', () => {
        Notification.destroyAll();
        const opts = {
            content: 'content',
            title: 'title',
        };
        Notification.config({
            left:'300px',
            top:'400px'
        })
        Notification.info({ ...opts, position: 'top' });
        const notificationList = document.querySelector(`.${BASE_CLASS_PREFIX}-notification-list`);
        expect(
            notificationList
            .style.left
        ).toEqual("300px");
        expect(
            notificationList
            .style.top
        ).toEqual("400px");
    });
});
