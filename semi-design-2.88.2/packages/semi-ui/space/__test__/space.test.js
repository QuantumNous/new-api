import React from 'react';
import { mount } from 'enzyme';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import Space from '../index';

describe('Space', () => {
    it('spacing', () => {
        const defaultNode = mount(
            <Space>
                {Array.from(Array(5)).map((i, idx) => (
                    <div key={idx}>content</div>
                ))}
            </Space>
        );
        const looseNode = mount(
            <Space spacing="loose">
                {Array.from(Array(5)).map((i, idx) => (
                    <div key={idx}>content</div>
                ))}
            </Space>
        );
        const mediumNode = mount(
            <Space spacing="medium">
                {Array.from(Array(5)).map((i, idx) => (
                    <div key={idx}>content</div>
                ))}
            </Space>
        );
        const tightNode = mount(
            <Space spacing="tight">
                {Array.from(Array(5)).map((i, idx) => (
                    <div key={idx}>content</div>
                ))}
            </Space>
        );
        const numberNode = mount(
            <Space spacing={20}>
                {Array.from(Array(5)).map((i, idx) => (
                    <div key={idx}>content</div>
                ))}
            </Space>
        );
        const arrayNumberNode = mount(
            <Space spacing={[10, 20]}>
                {Array.from(Array(5)).map((i, idx) => (
                    <div key={idx}>content</div>
                ))}
            </Space>
        );
        const arrayStringNode = mount(
            <Space spacing={['tight', 'loose']}>
                {Array.from(Array(5)).map((i, idx) => (
                    <div key={idx}>content</div>
                ))}
            </Space>
        );
        expect(defaultNode.find(`.${BASE_CLASS_PREFIX}-space`).hasClass('semi-space-tight-horizontal')).toEqual(true);
        expect(defaultNode.find(`.${BASE_CLASS_PREFIX}-space`).hasClass('semi-space-tight-vertical')).toEqual(true);

        expect(looseNode.find(`.${BASE_CLASS_PREFIX}-space`).hasClass('semi-space-loose-horizontal')).toEqual(true);
        expect(looseNode.find(`.${BASE_CLASS_PREFIX}-space`).hasClass('semi-space-loose-vertical')).toEqual(true);

        expect(mediumNode.find(`.${BASE_CLASS_PREFIX}-space`).hasClass('semi-space-medium-horizontal')).toEqual(true);
        expect(mediumNode.find(`.${BASE_CLASS_PREFIX}-space`).hasClass('semi-space-medium-vertical')).toEqual(true);

        expect(tightNode.find(`.${BASE_CLASS_PREFIX}-space`).hasClass('semi-space-tight-horizontal')).toEqual(true);
        expect(tightNode.find(`.${BASE_CLASS_PREFIX}-space`).hasClass('semi-space-tight-vertical')).toEqual(true);

        expect(numberNode.find(`.${BASE_CLASS_PREFIX}-space`).getDOMNode().style['column-gap']).toEqual('20px');
        expect(numberNode.find(`.${BASE_CLASS_PREFIX}-space`).getDOMNode().style['row-gap']).toEqual('20px');

        expect(arrayNumberNode.find(`.${BASE_CLASS_PREFIX}-space`).getDOMNode().style['column-gap']).toEqual('10px');
        expect(arrayNumberNode.find(`.${BASE_CLASS_PREFIX}-space`).getDOMNode().style['row-gap']).toEqual('20px');

        expect(arrayStringNode.find(`.${BASE_CLASS_PREFIX}-space`).hasClass('semi-space-tight-horizontal')).toEqual(
            true
        );
        expect(arrayStringNode.find(`.${BASE_CLASS_PREFIX}-space`).hasClass('semi-space-loose-vertical')).toEqual(true);
    });

    it('children render', () => {
        const containNullNode = mount(
            <Space>
                <div>content</div>
                {null}
                <div>content</div>
                {false}
                <div>content</div>
                {undefined}
                <>
                    <div>content</div>
                    <div>content</div>
                </>
            </Space>
        );
        const children = containNullNode.find(`.${BASE_CLASS_PREFIX}-space`).children();
        expect(children.length).toEqual(5);
    });
});
