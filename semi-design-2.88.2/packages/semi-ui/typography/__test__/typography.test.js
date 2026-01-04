import * as _ from 'lodash';

import Typography from '../index';

describe(`Typography`, () => {
    beforeEach(() => {
        document.getSelection = () => {
            return {
                removeAllRanges: () => {},
            };
        };
    });

    it('custom component', () => {
        let props = { component: 'div' };
        const typographyTitle = mount(
            <Typography.Title {...props} heading={1}>
                Semi Design
            </Typography.Title>
        );
        const title = typographyTitle.find('div.semi-typography-h1');
        expect(title.length).toEqual(1);

        const typographyText = mount(
            <Typography.Text {...props} id="text">
                Semi Design
            </Typography.Text>
        );
        const text = typographyText.find('div.semi-typography');
        expect(text.length).toEqual(1);

        const typographyParagraph = mount(<Typography.Paragraph {...props}>Semi Design</Typography.Paragraph>);
        const p = typographyParagraph.find('div.semi-typography-paragraph');
        expect(p.length).toEqual(1);
        typographyParagraph.unmount();
    });

    it('typography copyable', () => {
        const typographyParagraph = mount(<Typography.Paragraph copyable>Semi Design</Typography.Paragraph>);
        const p = typographyParagraph.find('.semi-icon-copy');
        expect(p.length).toEqual(1);
        p.at(0).simulate('click');
        expect(typographyParagraph.find('.semi-typography-action-copied').length).toEqual(1);
        typographyParagraph.setProps({ copyable: false });
        typographyParagraph.update();
        expect(typographyParagraph.find('.semi-icon-copy').length).toEqual(0);
    });

    it('typography link', () => {
        const text = mount(<Typography.Text link={{ href: 'https://semi.design/' }}>链接文本</Typography.Text>);
        expect(text.find('.semi-typography.semi-typography-link').length).toEqual(1);
        text.setProps({ disabled: true });
        text.update();
        expect(text.find('.semi-typography.semi-typography-disabled').length).toEqual(1);
        text.setProps({ underline: true, link: false });
        text.update();
        expect(text.find('.semi-typography u').length).toEqual(1);
    });

    it('typography ellipsis', () => {
        const typographyParagraph = mount(
            <Typography.Paragraph ellipsis={{ showTooltip: true }} style={{ width: 250 }}>
                是一个很长很长很长很长5号标题
            </Typography.Paragraph>
        );
        // jest 测不出layout，补一些无效用例，提高coverage
        expect(typographyParagraph.find('semi-typography-ellipsis').length).toEqual(0);
        typographyParagraph.setProps({ children: '的撒的撒打算的撒的撒的撒打算打的撒的撒打算的撒的撒的撒打算打' });
        typographyParagraph.update();
        expect(typographyParagraph.find('semi-typography-ellipsis').length).toEqual(0);
        typographyParagraph.setProps({
            ellipsis: {
                expandText: 'expandText',
                collapseText: 'collapseText',
                rows: 1,
                showTooltip: {
                    type: 'popover',
                },
                suffix: 'suffix',
            },
        });
        typographyParagraph.update();
        expect(typographyParagraph.find('semi-typography-ellipsis').length).toEqual(0);
    });

    it('typography Numeral', () => {
        let numeral = mount(
            <Typography.Numeral rule={'numbers'} truncate={'ceil'} precision={2}>
                <div className="price">
                    <span>预期价格:{() => 1.555}; 成本: -1; 盈利: 0.555</span>
                    <b>Currency symbols: $</b>
                </div>
            </Typography.Numeral>
        );
        expect(numeral.find('.price').text()).toEqual('1.56-1.00,0.56');
        numeral = mount(
            <Typography.Numeral rule={'exponential'} truncate={'floor'} precision={2}>
                <div className="price">
                    Total revenue: <b>$ 1992.15</b>
                </div>
            </Typography.Numeral>
        )
        expect(numeral.find('.price').text()).toEqual('Total revenue: $ 1.99e+3')
        // test: parser
        numeral.setProps({
            parser: oldVal => oldVal.replace(/[^\d.]/g, '')
        })
        expect(numeral.find('.price').text()).toEqual('1992.15')
    })

    it('children is template string', () => {
        const { Text } = Typography;
        const code = 'code'; 

        const typographyParagraph = mount(
            <Text 
                style={{  marginTop: 6, color: 'var(--semi-color-text-2)' }}
                ellipsis={{ showTooltip: { opts: { style: { wordBreak: 'break-word' } } } }}
                copyable={{ content: code }}
            >
                Key: {code}
            </Text>
        );
        expect(typographyParagraph.find('.semi-typography').children().at(0).text()).toEqual('Key: code');
    });

    it('custom copy render', () => {
        const { Text } = Typography;
        const code = 'code';

        const typographyParagraph = mount(
            <Text
                style={{ marginTop: 6, color: 'var(--semi-color-text-2)' }}
                ellipsis={{ showTooltip: { opts: { style: { wordBreak: 'break-word' } } } }}
                copyable={{
                    content: code,
                    render: (copied, doCopy, config) => {
                        return (
                            <span className="test-copy-button" onClick={doCopy}>
                                <span className="test-copied">{String(copied)}</span>
                                <span className="test-copy-content">{config.content}</span>
                            </span>
                        );
                    }
                }}
            >
                Key: {code}
            </Text>
        );

        // test basic render
        expect(typographyParagraph.find('.test-copied').text()).toEqual('false');
        expect(typographyParagraph.find('.test-copy-content').text()).toEqual(code);

        // test copy
        const trigger = typographyParagraph.find('.test-copy-button');
        expect(trigger.length).toEqual(1);
        trigger.at(0).simulate('click');
        expect(typographyParagraph.find('.test-copied').text()).toEqual('true');
    });

});
