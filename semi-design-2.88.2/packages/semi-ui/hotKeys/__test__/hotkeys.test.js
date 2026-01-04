import { Icon, Dropdown, Tag, HotKeys } from '../../index';
import { string } from 'prop-types';
import { noop, drop } from 'lodash';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import {sleep} from "../../_test_/utils";

function mount(props) {
    const container = document.getElementById('container');
    return testRender(<HotKeys {...props} id={"test"}></HotKeys>, container);
}

describe('HotKeys', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        // Avoid `attachTo: document.body` Warning
        const div = document.createElement('div');
        div.setAttribute('id', 'container');
        document.body.appendChild(div);
    });

    afterEach(() => {
        const div = document.getElementById('container');
        if (div) {
            document.body.removeChild(div);
        }
    });

    it('HotKeys-custom className & style', () => {
        let props = {
            className: 'test',
            style: {
                color: 'red',
            },
            hotKeys: ['r']
        };
        mount(props);

        expect(Boolean(document.querySelector(`.${BASE_CLASS_PREFIX}-hotKeys.test`))).toEqual(true);
        expect(document.querySelector(`.${BASE_CLASS_PREFIX}-hotKeys`).style['color']==="red").toEqual(true);
    });
});
