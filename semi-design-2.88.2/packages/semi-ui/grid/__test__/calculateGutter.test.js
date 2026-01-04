import React from 'react';
import { Row, Col } from '../index';

describe('Row', () => {
    it('gutter with number calc should be called right', () => {
        const wrapper = mount(
            <Row gutter={16}>
                <Col span={6} />
            </Row>
        );
        const rowNode = wrapper.find('.semi-row').getDOMNode();
        const colNode = wrapper.find('.semi-col').getDOMNode();
        expect(rowNode.style.marginLeft).toBe('-8px');
        expect(rowNode.style.marginRight).toBe('-8px');
        expect(colNode.style.paddingLeft).toBe('8px');
        expect(colNode.style.paddingRight).toBe('8px');
    });

    it('gutter with object calc should be called right', () => {
        const wrapper = mount(
            <Row gutter={{ xs: 16, sm: 16, md: 16 }}>
                <Col span={6} />
            </Row>
        );
        const rowNode = wrapper.find('.semi-row').getDOMNode();
        const colNode = wrapper.find('.semi-col').getDOMNode();
        expect(rowNode.style.marginLeft).toBe('-8px');
        expect(rowNode.style.marginRight).toBe('-8px');
        expect(colNode.style.paddingLeft).toBe('8px');
        expect(colNode.style.paddingRight).toBe('8px');
    });

    it('gutter with array calc should be called right', () => {
        const wrapper = mount(
            <Row gutter={[{ xs: 16, sm: 16, md: 16 }, 16]}>
                <Col span={6} />
            </Row>
        );
        const rowNode = wrapper.find('.semi-row').getDOMNode();
        const colNode = wrapper.find('.semi-col').getDOMNode();
        expect(rowNode.style.marginLeft).toBe('-8px');
        expect(rowNode.style.marginRight).toBe('-8px');
        expect(rowNode.style.marginTop).toBe('-8px');
        expect(rowNode.style.marginBottom).toBe('-8px');
        expect(colNode.style.paddingLeft).toBe('8px');
        expect(colNode.style.paddingRight).toBe('8px');
        expect(colNode.style.paddingTop).toBe('8px');
        expect(colNode.style.paddingBottom).toBe('8px');
    });
});
