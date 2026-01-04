/* eslint-disable jsx-a11y/click-events-have-key-events */
import { _t, getLocale } from "../../../../utils/locale";
import { navigate } from 'gatsby-link';
import React from 'react';
import styles from "./deepContent.module.scss";
import classnames from 'classnames';

function DeepContent(props) {

    const goA11y = () => {
        const local = getLocale();
        if (local === 'zh-CN') {
            window.open("https://mp.weixin.qq.com/s/O3js-SZDNPEOjGxh-aAkbw");
        } else {
            window.open("https://medium.com/@semi-design/accessibility-1808f1ed34d2");
        }
    };

    const goTheme = () => {
        window.open('https://mp.weixin.qq.com/s/noHoWRuA25PgqFNcurhIUA');
    };

    const goD2C = () => {
        window.open('https://juejin.cn/post/7267418854124699702');
    };

    const goD2COpenDayVideo = () => {
        window.open('https://www.bilibili.com/video/BV1n94y137kB/?share_source=copy_web&vd_source=6b19a3eea11d2cd88eaa3c2a7f3226e1');
    };

    const goTest = () => {
        window.open('https://medium.com/front-end-weekly/how-we-test-semi-design-component-libraries-64b854f63b65');
    };

    return (
        <div {...props} className={styles.frame}>
            <p className={styles.title} data-locale={"en-US"}>{_t("content_title")}</p>
            <p className={styles.subtitle}>{_t("content_subtitle")}</p>
            <div className={styles.autoWrapper}>
                <div className={styles.frame1312316425} onClick={goA11y}> 
                    <img className={styles.frame1312316426} alt="a11y in semi ui" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/a11y-detail.png" />
                    <div className={styles.details}>
                        <p className={styles.headline}> {_t("content_a11y")} </p>
                        <p className={styles.description}>{_t("content_ally_info")}</p>
                    </div>
                </div>
                <div className={styles.frame1312316425} onClick={goTheme}>
                    <img className={styles.frame1312316426} alt="about semi theme" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dsm-detail.png" />
                    <div className={styles.details}>
                        <p className={styles.headline}>{_t("content_theme")}</p>
                        <p className={styles.description}>{_t("content_theme_info")}</p>
                    </div>
                </div>
            </div>
            <div className={styles.autoWrapper}>
                <div className={styles.frame1312316425} onClick={goTest}>
                    <img className={styles.frame1312316426} alt="evolution of semi d2c" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/test.jpg" />
                    <div className={styles.details}>
                        <p className={styles.headline}>{_t("content_test")}</p>
                        <p className={styles.description}>{_t("content_test_info")}</p>
                    </div>
                </div>
                <div className={styles.frame1312316425} onClick={goD2C}>
                    <img className={styles.frame1312316426} alt="how we test semi ui" src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/d2c.jpg" />
                    <div className={styles.details}>
                        <p className={styles.headline}>{_t("content_d2c")}</p>
                        <p className={styles.description}>{_t("content_d2c_info")}</p>
                    </div>
                </div>
            </div>
            <div className={styles.autoWrapper}>
                <div className={styles.frame1312316425} onClick={goD2COpenDayVideo}>
                    <img className={styles.frame1312316426} alt="evolution of semi d2c" src="https://lf26-static.semi.design/obj/semi-tos/images/a8a32ee0-7eae-11ee-af66-8975b17081a1.png" />
                    <div className={styles.details}>
                        <p className={styles.headline}>{_t("content_d2c_openday")}</p>
                        <p className={styles.description}>{_t("content_d2c_info_openday")}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DeepContent;
