import { Card, Rating, Typography, Avatar, CardGroup } from '../../index';
import { cssClasses } from '@douyinfe/semi-foundation/icons/constants';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

const { Meta } = Card;

function getCard(props) {
    return mount(<Card {...props}></Card>, { attachTo: document.getElementById('container') });
}

function getMeta(props = {}) {
    return mount(<Meta {...props}></Meta>);
}

describe('Card', () => {
    it('Card with actions', () => {
        const propsWithActions = {
            actions: [<Rating defaultValue={4} />, <Rating defaultValue={4} />],
        };
        const cardWithActions = getCard(propsWithActions);
        expect(cardWithActions.exists(`.${BASE_CLASS_PREFIX}-card-body-actions`)).toEqual(true);
        expect(cardWithActions.find(`.${BASE_CLASS_PREFIX}-card-body-actions-item`).length).toEqual(2);
        cardWithActions.unmount();

        const props = {};
        const card = getCard(props);
        expect(card.exists(`.${BASE_CLASS_PREFIX}-card-body-actions`)).toEqual(false);
        card.unmount();
    });

    it('Card with bordered', () => {
        const propsWithBordered = {
            bordered: true,
        };
        const cardWithBordered = getCard(propsWithBordered);
        expect(cardWithBordered.exists(`.${BASE_CLASS_PREFIX}-card-bordered`)).toEqual(true);
        cardWithBordered.unmount();

        const props = {
            bordered: false,
        };
        const card = getCard(props);
        expect(card.exists(`.${BASE_CLASS_PREFIX}-card-body-bordered`)).toEqual(false);
        card.unmount();
    });

    it('Card with cover', () => {
        const propsWithCover = {
            cover: (
                <img
                    alt="example"
                    src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg"
                />
            ),
        };
        const cardWithCover = getCard(propsWithCover);
        expect(cardWithCover.exists(`.${BASE_CLASS_PREFIX}-card-cover`)).toEqual(true);
        cardWithCover.unmount();

        const props = {};
        const card = getCard(props);
        expect(card.exists(`.${BASE_CLASS_PREFIX}-card-body-cover`)).toEqual(false);
        card.unmount();
    });

    it('Card with headerExtraContent', () => {
        const propsWithHeaderExtraContent = {
            headerExtraContent: <Typography.Text link={{}}>更多</Typography.Text>,
        };
        const cardWithHeaderExtraContent = getCard(propsWithHeaderExtraContent);
        expect(cardWithHeaderExtraContent.exists(`.${BASE_CLASS_PREFIX}-card-header-wrapper-extra`)).toEqual(true);
        cardWithHeaderExtraContent.unmount();

        const props = {};
        const card = getCard(props);
        expect(card.exists(`.${BASE_CLASS_PREFIX}-card-header-wrapper-extra`)).toEqual(false);
        card.unmount();
    });

    it('Card with footer/header', () => {
        const propsWithFooter = {
            footer: <Typography.Text link={{}}>更多</Typography.Text>,
            header: <Typography.Text link={{}}>更多</Typography.Text>,
        };
        const cardWithFooter = getCard(propsWithFooter);
        expect(cardWithFooter.exists(`.${BASE_CLASS_PREFIX}-card-footer`)).toEqual(true);
        expect(cardWithFooter.exists(`.${BASE_CLASS_PREFIX}-card-header`)).toEqual(true);
        cardWithFooter.unmount();

        const props = {};
        const card = getCard(props);
        expect(card.exists(`.${BASE_CLASS_PREFIX}-card-footer`)).toEqual(false);
        expect(card.exists(`.${BASE_CLASS_PREFIX}-card-header`)).toEqual(false);
        card.unmount();
    });

    it('Card with footerLine/headerLine', () => {
        const propsWithLine = {
            footer: <Typography.Text link={{}}>更多</Typography.Text>,
            header: <Typography.Text link={{}}>更多</Typography.Text>,
            headerLine: true,
            footerLine: true,
        };
        const cardWithLine = getCard(propsWithLine);
        expect(cardWithLine.exists(`.${BASE_CLASS_PREFIX}-card-header-bordered`)).toEqual(true);
        expect(cardWithLine.exists(`.${BASE_CLASS_PREFIX}-card-footer-bordered`)).toEqual(true);
        cardWithLine.unmount();

        const props = {
            footer: <Typography.Text link={{}}>更多</Typography.Text>,
            header: <Typography.Text link={{}}>更多</Typography.Text>,
            headerLine: false,
            footerLine: false,
        };
        const card = getCard(props);
        expect(card.exists(`.${BASE_CLASS_PREFIX}-card-footer-bordered`)).toEqual(false);
        expect(card.exists(`.${BASE_CLASS_PREFIX}-card-header-bordered`)).toEqual(false);
        card.unmount();
    });

    it('Card with title', () => {
        const propsWithTitle = {
            title: 'semi',
        };
        const cardWithTitle = getCard(propsWithTitle);
        expect(cardWithTitle.exists(`.${BASE_CLASS_PREFIX}-card-header-wrapper-title`)).toEqual(true);
        cardWithTitle.unmount();

        const props = {};
        const card = getCard(props);
        expect(card.exists(`.${BASE_CLASS_PREFIX}-card-header-wrapper-title`)).toEqual(false);
        card.unmount();
    });

    it('Card with loading', () => {
        const propsWithLoading = {
            loading: true,
        };
        const cardWithLoading = mount(<Card {...propsWithLoading}>content</Card>);
        expect(cardWithLoading.exists(`.${BASE_CLASS_PREFIX}-card-body .${BASE_CLASS_PREFIX}-skeleton`)).toEqual(true);
        cardWithLoading.unmount();

        const props = {
            loading: false,
        };
        const card = mount(<Card {...props}>content</Card>);
        expect(card.exists(`.${BASE_CLASS_PREFIX}-card-body .${BASE_CLASS_PREFIX}-skeleton`)).toEqual(false);
        card.unmount();
    });

    it('Card with shadows', () => {
        const propsWithHover = {
            shadows: 'hover',
        };
        const cardWithHover = getCard(propsWithHover);
        expect(cardWithHover.exists(`.${BASE_CLASS_PREFIX}-card-shadows-hover`)).toEqual(true);
        cardWithHover.unmount();

        const propsWithShow = {
            shadows: 'show',
        };
        const cardWithShow = getCard(propsWithShow);
        expect(cardWithShow.exists(`.${BASE_CLASS_PREFIX}-card-shadows-show`)).toEqual(true);
        cardWithShow.unmount();
    });

    it('Card with custom className', () => {
        const propsWithClassName = { className: 'test' };
        const wrapper = getCard(propsWithClassName);
        expect(wrapper.hasClass('test')).toEqual(true);
    });

    it('Card Meta', () => {
        const meta = getMeta({
            avatar: (
                <Avatar
                    size="default"
                    src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg"
                />
            ),
            title: 'title',
            description: 'description',
        });
        expect(meta.exists(`.${BASE_CLASS_PREFIX}-card-meta`)).toEqual(true);
        expect(meta.exists(`.${BASE_CLASS_PREFIX}-card-meta-avatar`)).toEqual(true);
        expect(meta.exists(`.${BASE_CLASS_PREFIX}-card-meta-wrapper`)).toEqual(true);
        expect(meta.exists(`.${BASE_CLASS_PREFIX}-card-meta-wrapper-title`)).toEqual(true);
        expect(meta.exists(`.${BASE_CLASS_PREFIX}-card-meta-wrapper-description`)).toEqual(true);
    });

    it('Card Group', () => {
        const cardGroup = mount(
            <CardGroup spacing={16}>
                {Array.from(Array(10)).map((i, idx) => (
                    <Card key={idx}>Content</Card>
                ))}
            </CardGroup>
        );
        expect(cardGroup.exists(`.${BASE_CLASS_PREFIX}-space`)).toEqual(true);
        expect(cardGroup.find(`.${BASE_CLASS_PREFIX}-card`).length).toEqual(10);
    });
});
