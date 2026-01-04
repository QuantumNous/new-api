import { _t } from 'src/utils/locale';
import React from 'react';
import { Button, Tag, Badge } from '@douyinfe/semi-ui';
import styles from './pro.module.scss';
import { navigate } from 'gatsby-link';
import { getLocale } from '../../../../utils/locale';
import Component from './d2cApplication.jsx';

function BetaTag({ style }) {
    return (
        <Tag
            className='semi-always-dark'
            style={{ 
                color: 'var(--semi-color-white)', 
                background: 'rgba(var(--semi-violet-4), 1)', 
                fontWeight: 600,
                ...style
            }}
        >
            {_t('BETA', {}, 'BETA')}
        </Tag>
    );
}

function Pro(props) {

    const goD2CStart = () => {
        navigate(`/code/${getLocale()}`);
    };

    return (
        <div {...props} className={`${styles.macBookPro2}`}>
            <div className={styles.frame14294}>
                <div className={`${styles.frame4151}`}>
                    {/* <Badge count={<BetaTag style={{ right: -14, top: 4 }} />}> */}
                    <p className={styles.semiPro} data-locale={"en-US"}>{_t('home.pro.title')}</p>
                    {/* </Badge> */}
                </div>
                <p className={styles.text}>
                    <span className={styles.text_4c571d3f}>{_t('home.pro.desc', {}, '使用真实组件设计，前端代码一键转')}</span>
                </p>
                <Button onClick={goD2CStart} size="large" theme="solid" className={`${styles.extraLarge} semi-always-dark`}>
                    {_t('home.pro.start', {}, '了解更多')}
                </Button>
            </div>
            <div className={styles.autoWrapper}>
                {/* eslint-disable-next-line */}
                <img
                    src="https://lf9-static.semi.design/obj/semi-tos/images/homepage-pro-code.jpg"
                    className={styles.syntaxHighlighter}
                    alt="d2c demo code"
                />
                <div className={styles.rectangle1080}></div>
                <div className={styles.frame14295}>
                    <div className={styles.autoWrapper}>
                        {/* eslint-disable-next-line */}
                        <img
                            src="https://lf9-static.semi.design/obj/semi-tos/images/5de23960-3242-11ec-8b14-8fb159794ae4.png"
                            className={styles.chromeStandart}
                            alt="figma design file demo"
                        />
                        {/* eslint-disable-next-line */}
                        <img
                            src="https://lf9-static.semi.design/obj/semi-tos/images/5ddb0d70-3242-11ec-adec-e911cea4cf98.png"
                            className={styles.chromeStandart_2167fd7e}
                            alt="figma design file demo"
                        />
                        <div className={styles.chromeStandart_07210c83}>
                            <Component></Component>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Pro;
