import { Toast, Icon, Button, ToastFactory } from '../../index';
import { advanceBy, advanceTo, clear } from 'jest-date-mock';
import ToastItem from '../toast';
import sleep from '@douyinfe/semi-ui/_test_/utils/function/sleep';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import { IconWifi } from '@douyinfe/semi-icons';
describe('Toast', () => {
    beforeEach(async () => {
        // semi-animation会使用Date.now()，所以这里需要clear掉全局的advanceTo对Date的修改
        clear();
        const tw = document.querySelector(`.${BASE_CLASS_PREFIX}-toast-wrapper`);
        if (tw) {
            tw.childNodes[0].innerHTML = '';
        }
    });
    afterEach(async () => {
        // await sleep(500);
    });
    it('basically show toast, test content', () => {
        Toast.info('semi');
        let toast = document.querySelector(`.${BASE_CLASS_PREFIX}-toast-info`);
        expect(toast.textContent).toEqual('semi');
    });
    it('theme: light', () => {
        Toast.info({
            content: 'semi',
            theme: 'light',
        });
        let toast = document.querySelector(`.${BASE_CLASS_PREFIX}-toast-info`);
        expect(toast.classList.contains(`${BASE_CLASS_PREFIX}-toast-light`)).toEqual(true);
    });
    it('duration, >0', done => {
        let opts = {
            duration: 1,
            content: 'dur1',
            motion:false,
        };
        Toast.info(opts);
        let toast = document.querySelector(`.${BASE_CLASS_PREFIX}-toast-info`);
        expect(toast.textContent).toEqual('dur1');
        setTimeout(() => {
            let toast = document.querySelector(`.${BASE_CLASS_PREFIX}-toast-info`); // expect toast had been remove

            expect(toast).toEqual(null);
            done();
        }, 1500);
    });
    it('update content by id', done => {
        const id = 'toastid'
        Toast.info({ content: 'bytedance', id, motion: false });
        let toast = document.querySelector(`.${BASE_CLASS_PREFIX}-toast-info`);
        expect(toast.textContent).toEqual('bytedance');
        setTimeout(() => {
            Toast.info({ content: 'dancebyte', id, motion: false });
            expect(toast.textContent).toEqual('dancebyte');
            setTimeout(() => {
                Toast.error({ content: 'error', id, motion: false});
                expect(toast.textContent).toEqual('error');
                expect(toast?.className).toEqual(`${BASE_CLASS_PREFIX}-toast ${BASE_CLASS_PREFIX}-toast-error`)
                done()
            }, 1000)
        }, 1000)
    });
    it('should trigger onClose after duration', done => {
        let spyOnClose = sinon.spy(() => {});
        let opts = {
            onClose: spyOnClose,
            content: 'bytedance',
            duration: 0.8,
        };
        Toast.info(opts);
        let toast = document.querySelector(`.${BASE_CLASS_PREFIX}-toast-info`);
        setTimeout(() => {
            expect(spyOnClose.calledOnce).toEqual(true);
            done();
        }, 1000);
    });
    it('should trigger onClose when click close btn', () => {
        let spyOnClose = sinon.spy(() => {});
        let opts = {
            onClose: spyOnClose,
            content: 'bytedance',
        };
        let toast = mount(<ToastItem {...opts} />);
        let closeBtn = toast.find(`.${BASE_CLASS_PREFIX}-toast-close-button .${BASE_CLASS_PREFIX}-button`);
        closeBtn.simulate('click', {});
        expect(spyOnClose.calledOnce).toEqual(true);
    });
    it('showClear = false', () => {
        let opts = {
            showClose: false,
            duration: 1,
            content: 'showCloseToast',
        };
        let toast = mount(<ToastItem {...opts} />);
        expect(toast.exists(`.${BASE_CLASS_PREFIX}-toast-close-button`)).toEqual(false);
    });
    it('custom icon', () => {
        let customIcon = <IconWifi />;
        let opts = {
            icon: customIcon,
            content: 'semi',
        };
        let toast = mount(<ToastItem {...opts} />);
        expect(toast.exists(`.${BASE_CLASS_PREFIX}-icon-wifi`)).toEqual(true);
    });
    it('specific getPopupContainer', () => {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
        const ContainerToast = ToastFactory.create({
            getPopupContainer: () => document.querySelector(`#toast-container`),
        });
        ContainerToast.info('specific getPopupContainer');
        expect(
            document.querySelector(`#${ContainerToast.getWrapperId()}`).parentNode ===
                document.querySelector(`#toast-container`)
        ).toEqual(true);
    });
});
