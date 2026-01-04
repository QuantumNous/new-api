import { Toast, Icon, Button } from '../../index';
import { advanceBy, advanceTo, clear } from 'jest-date-mock';
import sleep from '@douyinfe/semi-ui/_test_/utils/function/sleep';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

import { JSDOM } from 'jsdom';
import { mount } from 'enzyme';

describe('Toast - 2', () => {
    beforeEach(() => {
        // semi-animation会使用Date.now()，所以这里需要clear掉全局的advanceTo对Date的修改
        clear();
        const tw = document.querySelector(`.${BASE_CLASS_PREFIX}-toast-wrapper`);
        if (tw) {
            tw.childNodes[0].innerHTML = '';
        }
    });

    afterEach(() => {});

    it('close via command call & duration = 0', async () => {
        let opts = {
            content: 'close by manual',
            duration: 0,
            motion:false
        };
        let id = Toast.info(opts);
        let toast = document.getElementsByClassName(`${BASE_CLASS_PREFIX}-toast-info`);
        expect(toast.length).toEqual(1);
        Toast.close(id);
        // wait, make sure react had update render content
        await sleep(400);
        expect(toast.length).toEqual(0);
    });

    it('different type toast', () => {
        Toast.info({ content: 'info' });
        Toast.success({ content: 'success' });
        Toast.warning({ content: 'warning' });
        Toast.error({ content: 'error' });
        expect(document.querySelector(`.${BASE_CLASS_PREFIX}-toast-info .${BASE_CLASS_PREFIX}-toast-content-text`).innerHTML).toEqual('info');
        expect(document.querySelector(`.${BASE_CLASS_PREFIX}-toast-success .${BASE_CLASS_PREFIX}-toast-content-text`).innerHTML).toEqual('success');
        expect(document.querySelector(`.${BASE_CLASS_PREFIX}-toast-warning .${BASE_CLASS_PREFIX}-toast-content-text`).innerHTML).toEqual('warning');
        expect(document.querySelector(`.${BASE_CLASS_PREFIX}-toast-error .${BASE_CLASS_PREFIX}-toast-content-text`).innerHTML).toEqual('error');
    });

    it('top/bottom/right/left', () => {
        let opts = {
            content: 'Hi, Bytedance dance dance',
            duration: 0,
            top: 500,
            left: 20,
            bottom: 30,
            right: 40,
        };
        Toast.info(opts);
        let toastWrapper = document.getElementsByClassName(`${BASE_CLASS_PREFIX}-toast-wrapper`)[0];
        let style = toastWrapper.style;
        expect(style.top).toEqual('500px');
        expect(style.left).toEqual('20px');
        expect(style.bottom).toEqual('30px');
        expect(style.right).toEqual('40px');
    });

    it('set global config', () => {
        Toast.destroyAll();
        Toast.config({
            theme: 'light',
            duration: 0,
            top: 40,
            left: 30,
            bottom: 20,
            right: 10,
            zIndex: 30,
        })
        Toast.info('Hi, Bytedance dance');
        let toastWrapper = document.getElementsByClassName(`${BASE_CLASS_PREFIX}-toast-wrapper`)[0];
        let style = toastWrapper.style;
        expect(style.top).toEqual('40px');
        expect(style.left).toEqual('30px');
        expect(style.bottom).toEqual('20px');
        expect(style.right).toEqual('10px');
        expect(style.zIndex).toEqual('30');
        let toast = document.querySelector(`.${BASE_CLASS_PREFIX}-toast-info`);
        expect(toast.classList.contains(`${BASE_CLASS_PREFIX}-toast-light`)).toEqual(true);
    });
});
