import { _t } from "src/utils/locale";
import { navigate } from 'gatsby-link';
import React from 'react';
import { getLocale } from '../../../../utils/locale';
import styles from './resource.module.scss';
import OperateButton from '../operateButton/operateButton.jsx';
import classnames from 'classnames';

function Resource(props) {
    const goComponentsOverview = () => {
        navigate(`/${getLocale()}/start/overview`);
    };

    const goFigma = () => {
        window.open('https://figma.com/@semi');
    };

    return (
        <div {...props} className={styles.container}>
            <div className={styles.frame1}>
                <p className={styles.title} data-locale={"en-US"}>{_t("enterprise_product_design_system")}</p>
                <p className={styles.text_008e1ad6}>{_t("resource_subtitle")}</p>
                <OperateButton />
            </div>
            <div className={styles.frame4574}>
                <div className={styles.frame22}>
                    <div className={styles.group21}>
                        <p className={styles.text} data-locale={"en-US"}>{_t("home.resource.rd", { }, "研发")}</p>
                        <p className={styles.text_00d74f5e}>
                            <span className={styles.text_70c95f84}>{_t("home.resource.rd.desc")}</span>
                        </p>
                        <p onClick={goComponentsOverview} className={styles.text_0aedd7ef}>{_t("component_documentation", { }, "组件文档")}</p>
                    </div><img src="https://lf9-static.semi.design/obj/semi-tos/images/homepage-code.png" className={styles.frame} alt="demo code" />
                </div>
                <div className={styles.frame23}>
                    <div className={styles.group20}>
                        <p className={styles.text} data-locale={"en-US"}>{_t("home.resource.design")}</p>
                        <p className={styles.text_00d74f5e}>
                            <span className={styles.text_70c95f84}>{_t("home.resource.design.desc")}</span>
                        </p>
                        <p onClick={goFigma} className={styles.figmaUIKit}>Figma UIKit</p>
                    </div><img src="https://lf9-static.semi.design/obj/semi-tos/images/a05515c0-323c-11ec-9c23-a9f1bde3758e.png" className={styles.frame4573} alt="figma source demo" />
                </div>
            </div>
        </div>
    );
}

export default Resource;
