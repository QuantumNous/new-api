/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import classNames from 'classnames';
import { _t } from 'utils/locale';
import './index.scss';

const features = [
    {
        title: _t('d2c.advanced.feature1.title'),
        description: _t('d2c.advanced.feature1.description'),
        // url: '/d2c/mark-library',
        backgroundImage: 'https://lf3-static.semi.design/obj/semi-tos/images/c341b1a0-bb8d-11ef-92a1-f9d591dc8ece.svg',
        blurBackground: '#1bc47d',
        FrontCom: ({ className }) => (
            <div className={classNames('d2c-feature-ds-support', className)}>
                <img
                    src="https://lf6-static.semi.design/obj/semi-tos/images/c33aacc0-bb8d-11ef-b0ca-191cf7612a7b.svg"
                    className={'d2c-feature-ds-support-img'}
                />
                <p className={'code'}>code</p>
            </div>
        ),
    },
    {
        title: _t('d2c.advanced.feature2.title'),
        description: _t('d2c.advanced.feature2.description'),
        // url: '/d2c/transform-plugin',
        backgroundImage: 'https://lf9-static.semi.design/obj/semi-tos/images/1b74be30-be0e-11ef-b10f-69903fa0351e.svg',
        blurBackground: '#38bbc6',
        FrontCom: ({ className }) => (
            <div className={classNames('d2c-feature-dsl-support', className)}>
                <div className={'dsl-wrapper'}>
                    <div className={'dsl-symbol'}>
                        <p className={'a'}>&#123; &#125;</p>
                    </div>
                    <p className={'dsl-text'}>DSL</p>
                </div>
                <div className={'d2c-feature-card-img2'}>
                    <div className={'dsl-dsl-vue-text'}>
                        <img
                            src="https://lf26-static.semi.design/obj/semi-tos/images/c33ccfa0-bb8d-11ef-b0ca-191cf7612a7b.svg"
                            className={'d2c-feature-dsl-support-img'}
                        />
                        <p className={'dsl-vue-text'}>Vue</p>
                    </div>
                    <div className={'dsl-react'}>
                        <img
                            src="https://lf9-static.semi.design/obj/semi-tos/images/c33d44d0-bb8d-11ef-b0ca-191cf7612a7b.svg"
                            className={'react'}
                        />
                        <p className={'dsl-react-text'}>React</p>
                    </div>
                </div>
            </div>
        ),
    },
    {
        title: _t('d2c.advanced.feature3.title'),
        description: _t('d2c.advanced.feature3.description'),
        backgroundImage: 'https://lf6-static.semi.design/obj/semi-tos/images/c341ffc0-bb8d-11ef-92a1-f9d591dc8ece.svg',
        blurBackground: '#a593ff',
        FrontCom: ({ className }) => (
            <div className={classNames('d2c-feature-ecosystem-support', className)}>
                <div className={'frame2117130723'}>
                    <img
                        src="https://lf3-static.semi.design/obj/semi-tos/images/c33d1dc0-bb8d-11ef-b0ca-191cf7612a7b.svg"
                        className={'d2c-feature-ds-support-img'}
                    />
                    <p className={'openApi'}>Open API</p>
                </div>
                <div className={'frame2117130722'}>
                    <img
                        src="https://lf9-static.semi.design/obj/semi-tos/images/c33d6be0-bb8d-11ef-b0ca-191cf7612a7b.svg"
                        className={'frame2117130688'}
                    />
                    <p className={'nodeSdk'}>Node SDK</p>
                </div>
            </div>
        ),
    },
];

export const Advanced = ({ location }) => {
    const [hoveredIndex, setHoveredIndex] = React.useState(0);
    return (
        <div className='d2c-feature-wrapper'>
            <div className={'d2c-feature-list'}>
                <div className={'hover'}>
                    {features.map((feature, index) => {
                        const { title, description, url, backgroundImage, blurBackground, FrontCom } = feature;
                        return (
                            <a
                                key={index}
                                className={'d2c-feature-card'}
                                onMouseEnter={e => setHoveredIndex(index)}
                                onMouseLeave={e => setHoveredIndex(-1)}
                                style={{ transition: 'transform 0.3s ease' }}
                            >
                                <div
                                    className={'d2c-feature-card-img'}
                                    style={{ backgroundImage: `url(${backgroundImage})` }}
                                >
                                    <div className={'rectangle279334588'} style={{ background: blurBackground }} />
                                    <FrontCom className={hoveredIndex === index ? 'hovered' : ''} />
                                </div>
                                <div className={'d2c-feature-card-detail'}>
                                    <div className={'frame2117130798'}>
                                        <p className={'d2c-feature-card-detail-title'}>{title}</p>
                                        <p className={'d2c-feature-card-detail-description'}>{description}</p>
                                    </div>
                                    {/* <p className={classNames('text3', { ['d2c-feature-card-disabled']: isForbidden })}>
                                        {isForbidden ? _t('d2c.advanced.comingSoon') : _t('d2c.advanced.view')}
                                    </p> */}
                                </div>
                            </a>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default Advanced;