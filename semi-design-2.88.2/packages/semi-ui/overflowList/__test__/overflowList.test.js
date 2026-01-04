import React from 'react';
import { mount } from 'enzyme';
import { BASE_CLASS_PREFIX } from '@douyinfe/semi-foundation/base/constants';
import OverflowList from '../index';

describe('OverflowList', () => {
    // it('render basic', () => {
    //     const node = mount(
    //         <OverflowList
    //             items={[{ key: 'alarm' }, { key: 'bookmark' }, { key: 'camera' }, { key: 'duration' }]}
    //             visibleItemRenderer={item => <div>{item.key}</div>}
    //             overflowRenderer={() => null}
    //         />
    //     );
    //     expect(node.find(`.${BASE_CLASS_PREFIX}-overflow-list`).exists()).toEqual(true);
    //     // expect(node.find(`.${BASE_CLASS_PREFIX}-overflow-list-spacer`).exists()).toEqual(true);
    // });
    it('render scroll', () => {
        const node = mount(
            <OverflowList
                items={[{ key: 'alarm' }, { key: 'bookmark' }, { key: 'camera' }, { key: 'duration' }]}
                visibleItemRenderer={item => <div>{item.key}</div>}
                overflowRenderer={() => [null, null]}
                renderMode="scroll"
            />
        );
        expect(node.find(`.${BASE_CLASS_PREFIX}-overflow-list`).exists()).toEqual(true);
        expect(node.find(`.${BASE_CLASS_PREFIX}-overflow-list-scroll-wrapper`).exists()).toEqual(true);
        node.unmount();
    });
});
