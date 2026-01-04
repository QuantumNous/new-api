/* eslint-disable jsx-a11y/click-events-have-key-events */
import { _t } from "src/utils/locale";
import { Carousel } from '@douyinfe/semi-ui';
import React, { useRef } from 'react';
import styles from "./application.module.scss";
import { AnyWebBigSvg, StarRiverBigSvg, CapCutBigSvg, CozeSvg } from '../svg.jsx';
import { IconChevronLeft, IconChevronRight } from '@douyinfe/semi-icons';
import classnames from 'classnames';

function Application(props) {

    const classForDarkImage = classnames(styles.showInDark, styles.hideInLight);

    const imgList = [
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/meego.jpg',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/douyinCreate-page.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/coze.jpg',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/anyweb-page.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/starRive-page.png',
        'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/capCut-page.png'
    ];

    const imgInfo = [_t("feishu_program"), _t("douyin_creator"), _t("coze"), _t("anyweb"), _t("star_river"), _t("cap_cut")];

    const logoNode = [
        <div key="lark" className={classnames(styles.group720)}>
            {/* eslint-disable-next-line */}
            <img src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/feishu-logo.png" width={64} height={64} style={{ marginRight: 16 }}/>
            <p className={styles.larkProject}>飞书项目</p>
        </div>,
        <div key='douyinCreator'>
            {/* eslint-disable-next-line */}
            <img src="https://lf9-static.semi.design/obj/semi-tos/images/16cf36e0-321a-11ec-b393-ab4adc2e449f.png" className={styles.hideInDark} height={64} width={275}/>   
            {/* eslint-disable-next-line */}       
            <img src="https://lf9-static.semi.design/obj/semi-tos/images/a50bd6f0-3474-11ec-b008-15e09471f238.png" className={classForDarkImage} height={64} width={275} />              
        </div>,
        <div key='coze' className={classnames(styles.group720)}>
            <CozeSvg />
        </div>,
        <div key="anyWeb" className={classnames(styles.group720)}>
            <AnyWebBigSvg />
        </div>,
        <div key="starRiver" className={classnames(styles.group720)}>
            <StarRiverBigSvg />
        </div>,
        <div key="capcut" className={classnames(styles.group720)}>
            <CapCutBigSvg />
        </div>  
    ];

    const carouselRef = useRef(null);

    const clickPrev = () => {
        carouselRef.current.prev();
    };

    const clickNext = () => {
        carouselRef.current.next();
    };
    
    return (
        <div {...props} className={styles.frame14373}>
            <div className={styles.titleWrapper}>
                <p className={styles.title} data-locale={"en-US"}>{_t("application_title")}</p>
                <p className={styles.subTitle}>{_t("application_subtitle")}</p>
            </div>
            <div className={styles.container}>
                <div className={styles.carouselWrapper}>
                    <Carousel 
                        ref={carouselRef}
                        style={{ width: 1200, height: 948 }}
                        autoPlay={{ interval: 1500, hoverToPause: true }}
                        showArrow={false}
                        showIndicator={false} 
                        animation='fade'
                    >
                        {
                            imgList.map((src, index) => {
                                return (
                                    <div key={index} className={styles.application}>
                                        <div className={classnames(styles.imgWrapper, styles[`imgBg${index}`])}>
                                            {/* eslint-disable-next-line */}
                                            <img src={src} className={styles.img}/>
                                        </div>
                                        <div className={styles.imgInfo}>
                                            <div className={styles.logo}>{logoNode[index]}</div>
                                            <p className={styles.imgInfoText}>{imgInfo[index]}</p>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </Carousel>
                    {/* eslint-disable-next-line */}
                    <div className={classnames(styles.arrow, styles.leftArrow)} onClick={clickPrev}><IconChevronLeft size="extra-large"/></div>
                    {/* eslint-disable-next-line */}
                    <div className={classnames(styles.arrow, styles.rightArrow)} onClick={clickNext}><IconChevronRight size="extra-large"/></div>
                </div>
            </div>
        </div>
    );
}

export default Application;
