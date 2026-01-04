import Anchor from '../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import { mount } from 'enzyme';

const {Link} = Anchor;

function mountAnchor(props = {}) {
  return mount(
        <Anchor {...props}>
            <Link href="#welcome" title="welcome" />
            <Link href="#api" title="api too much to show">
                <Link href="#docs" title="docs">
                    <Link href="#doc1" title="doc1" />
                    <Link href="#doc2" title="doc2" />
                </Link>
            </Link>
            <Link href="#contact" title="contact" />
        </Anchor>
  );
}

describe('Anchor', () => {
  it('anchor small size', () => {
    const smallAnchor = mount(<Anchor size="small" />);
    expect(smallAnchor.find(`.${BASE_CLASS_PREFIX}-anchor-size-small`)).toHaveLength(1);
    smallAnchor.unmount();
  });

  it('anchor rail theme', () => {
    const smallAnchor = mount(<Anchor railTheme="primary" />);
    expect(smallAnchor.find(`.${BASE_CLASS_PREFIX}-anchor-slide-bar-primary`)).toHaveLength(1);
  });

  it('anchor with custom className & style', () => {
    const wrapper = mount(<Anchor className="test" style={{ color: 'red' }} />);
    expect(wrapper.hasClass('test')).toEqual(true);
    expect(wrapper.find('div.test')).toHaveStyle('color', 'red');
  });

  it('simulate click event', () => {
    const wrapper = mountAnchor({autoCollapse: true})
    const links = wrapper.find('.semi-anchor-link-title');
    expect(wrapper.find('.semi-anchor-link-title-active').length).toEqual(0)
    expect(wrapper.exists('.semi-anchor-link .semi-anchor-link')).toEqual(false);
    const secondLink = links.at(1);
    secondLink.simulate('click')
    expect(wrapper.find('.semi-anchor-link-title-active').length).toEqual(1)
    expect(wrapper.exists('.semi-anchor-link .semi-anchor-link')).toEqual(true);
    const firstLink = links.at(0);
    firstLink.simulate('click')
    expect(wrapper.find('.semi-anchor-link-title-active').length).toEqual(1)
    expect(wrapper.exists('.semi-anchor-link .semi-anchor-link')).toEqual(false);
  });

  it('anchor max height and max width', () => {
    const wrapper = mountAnchor({maxHeight: 50, maxWidth: 100})
    expect(wrapper.find('.semi-anchor').instance().style.maxHeight).toBe('50px')
    expect(wrapper.find('.semi-anchor').instance().style.maxWidth).toBe('100px')
  })
});
