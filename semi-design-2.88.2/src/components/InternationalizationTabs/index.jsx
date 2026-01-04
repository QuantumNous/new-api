import React, { useState } from 'react';
import { Tabs, MarkdownRender } from '@douyinfe/semi-ui';
import { IconLink, IconArticle, IconTextRectangle, IconBriefcase, IconLikeHeart, IconSafe, IconCustomize, IconBulb, IconPuzzle, IconAlertTriangle, IconFlipHorizontal, IconAppCenter, IconListView, IconSync } from '@douyinfe/semi-icons';
import { useIntl } from 'react-intl';
import { makeAnchorId } from '../../utils';
import { ImageCard, ImageList, TextCard, ColorCard, ColorList, ColorImageCard } from './cards';
import { conceptIntroduction, designPrinciples, textDesignSpecification, graphicDesignSpecification, informationPresentationSpecification, rtlDesignSpecification, conceptIntroductionEn, designPrinciplesEn, textDesignSpecificationEn, graphicDesignSpecificationEn, informationPresentationSpecificationEn, rtlDesignSpecificationEn,
    conceptIntroductionAnchor, conceptIntroductionAnchorEn, textDesignSpecificationAnchor, textDesignSpecificationAnchorEn, graphicDesignSpecificationAnchor, graphicDesignSpecificationAnchorEn, informationPresentationSpecificationAnchor, informationPresentationSpecificationAnchorEn, rtlDesignSpecificationAnchor, rtlDesignSpecificationAnchorEn,
} from './data';
import InnerAnchor from './innerAnchor';

const components = {
    h2: ({ children }) => {
        const intl = useIntl();
        const onIconLinkClick = () => {
            copy(`${window.location.href.replace(window.location.hash, '')}#${window.encodeURI(children)}`);
            Toast.success({
                content: intl.formatMessage({
                    id: 'editor.copy.success',
                }),
                duration: 3,
            });
        };
        return (
            <>
                <h2 className="md markdown gatsby-h2" id={makeAnchorId(children)}>
                    {children}
                    <IconLink
                        className={'anchor-link-button-icon'}
                        tabIndex={0}
                        role="button"
                        onClick={onIconLinkClick}
                        onKeyPress={(e) => {
                            if (['Enter', ' '].includes(e?.key)) {
                                onIconLinkClick(e);
                            }
                        }}
                    />
                </h2>
            </>
        );
    },
    h3: ({ children }) => {
        const intl = useIntl();
        const onIconLinkClick = () => {
            copy(`${window.location.href.replace(window.location.hash, '')}#${window.encodeURI(children)}`);
            Toast.success({
                content: intl.formatMessage({
                    id: 'editor.copy.success',
                }),
                duration: 3,
            });
        };
        return (
            <h3 className="md markdown gatsby-h3" id={makeAnchorId(children)}>
                {children}
                <IconLink
                    tabIndex={0}
                    role="button"
                    className={'anchor-link-button-icon'}
                    onClick={onIconLinkClick}
                    onKeyPress={(e) => {
                        if (['Enter', ' '].includes(e?.key)) {
                            onIconLinkClick(e);
                        }
                    }}
                />
            </h3>
        );
    },
    p: ({ children }) => <div className="md markdown gatsby-p">{children}</div>,
    ul: ({ children }) => <ul className="md markdown gatsby-ul">{children}</ul>,
    li: ({ children }) => <li className="md markdown gatsby-li">{children}</li>,
    a: ({ children, href, target }) => <a href={href} className="md gatsby-a" target={target}>{children}</a>,
    IconArticle: ({ props }) => <IconArticle className="internationalization-icon" {...props} ></IconArticle>,
    IconTextRectangle: ({ props }) => <IconTextRectangle className="internationalization-icon" {...props} ></IconTextRectangle>,
    IconBriefcase: ({ props }) => <IconBriefcase className="internationalization-icon" {...props} ></IconBriefcase>,
    IconLikeHeart: ({ props }) => <IconLikeHeart className="internationalization-icon" {...props} ></IconLikeHeart>,
    IconSafe: ({ props }) => <IconSafe className="internationalization-icon" {...props} ></IconSafe>,
    IconCustomize: ({ props }) => <IconCustomize className="internationalization-icon" {...props}></IconCustomize>,
    IconBulb: ({ props }) => <IconBulb className="internationalization-icon" {...props} ></IconBulb>,
    IconPuzzle: ({ props }) => <IconPuzzle className="internationalization-icon" {...props} ></IconPuzzle>,
    IconAlertTriangle: ({ props }) => <IconAlertTriangle className="internationalization-icon" {...props} ></IconAlertTriangle>,
    IconFlipHorizontal: ({ props }) => <IconFlipHorizontal className="internationalization-icon" {...props} ></IconFlipHorizontal>,
    IconAppCenter: ({ props }) => <IconAppCenter className="internationalization-icon" {...props} ></IconAppCenter>,
    IconListView: ({ props }) => <IconListView className="internationalization-icon" {...props} ></IconListView>,
    IconSync: ({ props }) => <IconSync className="internationalization-icon" {...props} ></IconSync>,
    TextCard: ({ color, title, description }) => <TextCard color={color} title={title} description={description} />,
    ImageCard: ({ icon, title, image, description }) => <ImageCard icon={icon} title={title} image={image} description={description} />,
    ImageList: ({ title, image, description }) => <ImageList title={title} image={image} description={description} />,
    ColorCard: ({ color, icon, title, description }) => <ColorCard color={color} icon={icon} title={title} description={description} />,
    ColorList: ({ color, title, description }) => <ColorList color={color} title={title} description={description} />,
    ColorImageCard: ({ color, icon, title, image, description }) => <ColorImageCard color={color} icon={icon} title={title} image={image} description={description} />,
};

const DesignSpecificationsTabs = ({ locale }) => {
    const isChinese = locale === 'zh-CN';
    const [key, setKey] = useState('textDesignSpecification');
    const [innerAnchorData, setInnerAnchorData] = useState(isChinese ? textDesignSpecificationAnchor : textDesignSpecificationAnchorEn);
    const contentList = {
        textDesignSpecification: isChinese ? textDesignSpecification : textDesignSpecificationEn,
        graphicDesignSpecification: isChinese ? graphicDesignSpecification : graphicDesignSpecificationEn,
        informationPresentationSpecification: isChinese ? informationPresentationSpecification : informationPresentationSpecificationEn,
        rtlDesignSpecification: isChinese ? rtlDesignSpecification : rtlDesignSpecificationEn,
    };

    return (
        <>
            <InnerAnchor data={innerAnchorData} />
            <Tabs
                type="button"
                style={{ marginTop: '1.46em' }}
                tabList={[
                    { tab: isChinese ? '文字设计规范' : 'Text Design Specification', itemKey: 'textDesignSpecification' },
                    { tab: isChinese ? '图形设计规范' : 'Graphic Design Specification', itemKey: 'graphicDesignSpecification' },
                    { tab: isChinese ? '信息呈现规范' : 'Information Presentation Specification', itemKey: 'informationPresentationSpecification' },
                    { tab: isChinese ? 'RTL 设计规范' : 'RTL Design Specification', itemKey: 'rtlDesignSpecification' },
                ]}
                onChange={key => {
                    setKey(key);
                    switch (key) {
                        case 'textDesignSpecification':
                            setInnerAnchorData(isChinese ? textDesignSpecificationAnchor : textDesignSpecificationAnchorEn);
                            break;
                        case 'graphicDesignSpecification':
                            setInnerAnchorData(isChinese ? graphicDesignSpecificationAnchor : graphicDesignSpecificationAnchorEn);
                            break;
                        case 'informationPresentationSpecification':
                            setInnerAnchorData(isChinese ? informationPresentationSpecificationAnchor : informationPresentationSpecificationAnchorEn);
                            break;
                        case 'rtlDesignSpecification':
                            setInnerAnchorData(isChinese ? rtlDesignSpecificationAnchor : rtlDesignSpecificationAnchorEn);
                            break;
                    }
                }}
            >
                <MarkdownRender style={{ marginTop: '1.46em' }} raw={contentList[key]} components={components} />
            </Tabs>
        </>
    );
};

const InternationalizationTabs = ({ locale }) => {
    const isChinese = locale === 'zh-CN';
    const [key, setKey] = useState('conceptIntroduction');
    const [anchorData, setAnchorData] = useState(isChinese ? conceptIntroductionAnchor : conceptIntroductionAnchorEn);

    const contentList = {
        'conceptIntroduction': <MarkdownRender raw={isChinese ? conceptIntroduction : conceptIntroductionEn} components={components} />,
        'designPrinciples': <MarkdownRender raw={isChinese ? designPrinciples : designPrinciplesEn} components={components} />,
        'designSpecificationsTabs': <DesignSpecificationsTabs locale={locale} />
    };
    return (
        <>
            <InnerAnchor data={anchorData} />
            <Tabs
                type="line"
                tabList={[
                    { tab: isChinese ? '概念介绍' : 'Concept Introduction', itemKey: 'conceptIntroduction' },
                    { tab: isChinese ? '设计原则' : 'Design Principles', itemKey: 'designPrinciples' },
                    { tab: isChinese ? '设计规范' : 'Design Specifications', itemKey: 'designSpecificationsTabs' },
                ]}
                onChange={key => {
                    setKey(key);
                    if (key === 'conceptIntroduction') {
                        setAnchorData(isChinese ? conceptIntroductionAnchor : conceptIntroductionAnchorEn);
                    } else {
                        setAnchorData([]);
                    } 
                }}
            >
                {contentList[key]}
            </Tabs>
        </>
    );
};




export default InternationalizationTabs;
