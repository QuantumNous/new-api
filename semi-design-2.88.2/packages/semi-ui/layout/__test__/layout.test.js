import { Layout } from '../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

describe('layout', () => {
    it('layout with custom className & style', () => {
        let props = {
            className: 'test',
            style: {
                color: 'red',
            },
        };
        let layout = mount(<Layout {...props} hasSider />);
        expect(layout.hasClass('test')).toEqual(true);
        expect(layout.find('section.test')).toHaveStyle('color', 'red');
        layout.unmount();

        let header = mount(<Layout.Header {...props} />);
        expect(header.hasClass('test')).toEqual(true);
        expect(header.find('header.test')).toHaveStyle('color', 'red');
        header.unmount();

        let sider = mount(<Layout.Sider {...props} />);
        expect(sider.hasClass('test')).toEqual(true);
        expect(sider.find('aside.test')).toHaveStyle('color', 'red');
        sider.unmount();

        let content = mount(<Layout.Content {...props} />);
        expect(content.hasClass('test')).toEqual(true);
        expect(content.find('main.test')).toHaveStyle('color', 'red');
        content.unmount();

        let footer = mount(<Layout.Footer {...props} />);
        expect(footer.hasClass('test')).toEqual(true);
        expect(footer.find('footer.test')).toHaveStyle('color', 'red');
        footer.unmount();
    });

    it('layout with sider', () => {
        const layout = mount(
            <Layout>
                <Layout.Sider />
            </Layout>
        );
        expect(layout.exists(`section.${BASE_CLASS_PREFIX}-layout-has-sider`)).toEqual(true);
        layout.unmount();
    });

    // Responsive breakpoints are not easy to handle in unit test, ignore
    // it('sider breakpoint', () => {
    // })
});
