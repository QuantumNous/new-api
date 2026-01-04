import React from 'react';
import { shallow } from 'enzyme';
import Spin from '..';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import { sleep } from '../../_test_/utils';

describe('Spin', () => {
    it('should be controlled by spinning', () => {
        const wrapper = shallow(<Spin spinning={false} />);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-spin`)
                .hasClass(`${BASE_CLASS_PREFIX}-spin-hidden`)
        ).toEqual(true);
        
        wrapper.setProps({ spinning: true });
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-spin`)
                .hasClass(`${BASE_CLASS_PREFIX}-spin-hidden`)
        ).toEqual(false);
    });

    it('test delay', async () => {
        const wrapper = shallow(<Spin delay={1000} spinning={false} />);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-spin`)
                .hasClass(`${BASE_CLASS_PREFIX}-spin-hidden`)
        ).toEqual(true);
        
        wrapper.setProps({ spinning: true });
        wrapper.update()
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-spin`)
                .hasClass(`${BASE_CLASS_PREFIX}-spin-hidden`)
        ).toEqual(true);
        await sleep(1000);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-spin`)
                .hasClass(`${BASE_CLASS_PREFIX}-spin-hidden`)
        ).toEqual(false);
    });
});