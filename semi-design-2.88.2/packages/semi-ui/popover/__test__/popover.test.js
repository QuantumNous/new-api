import { clear } from 'jest-date-mock';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

import Popover from '../index';
import { Button } from '../../index';

import { genAfterEach, genBeforeEach, mount, sleep } from '../../_test_/utils';

const wrapCls = `${BASE_CLASS_PREFIX}-popover`;
const wrapSelector = `.${wrapCls}`;
const triggerCls = 'trigger';

describe(`Popover`, () => {
    beforeEach(() => {
        clear();
        genBeforeEach()();
    });

    afterEach(genAfterEach());

    it(`test appearance`, async () => {
        const contentId = `content`;
        const elem = mount(
            <Popover trigger={'hover'} visible={true} content={<p id={contentId}>I'm content</p>} showArrow={true}>
                <Button>Hover Me</Button>
            </Popover>
        );

        // check if popover showed or not
        expect(document.querySelectorAll(wrapSelector).length > 0).toBeTruthy();
        expect(document.querySelectorAll(`#${contentId}`).length > 0).toBeTruthy();

        // check if popover has arrow icon or not
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-popover-icon-arrow`).length > 0).toBeTruthy();
    });

    it(`test appearance without arrow`, async () => {
        const contentId = `content`;
        const elem = mount(
            <Popover trigger={'hover'} visible={true} content={<p id={contentId}>I'm content</p>} spacing={0}>
                <Button>Hover Me</Button>
            </Popover>
        );

        // check if popover showed or not
        expect(document.querySelectorAll(wrapSelector).length > 0).toBeTruthy();
        expect(document.querySelectorAll(`#${contentId}`).length > 0).toBeTruthy();

        // check if popover has arrow icon or not
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-popover-icon-arrow`).length === 0).toBeTruthy();
    });
});
