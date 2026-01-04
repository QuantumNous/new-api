import { _t } from "src/utils/locale";
import { navigate } from 'gatsby-link';
import React from 'react';
import styles from './dsm.module.scss';

function Dsm(props) {

    const goDsm = () => {
        location.href = DSM_URL?DSM_URL:"https://semi.design/dsm/landing";
    };
    const goThemeStore = ()=>{
        location.href = '/dsm_store';
    };
    return (
        <div {...props} className={styles.frame14293}>
            <div className={styles.frame14291}>
                <div className={styles.autoWrapper}>
                    <p className={styles.semiDSM} data-locale={"en-US"}>{_t('semi_dsm', {}, 'Semi 设计系统管理')}</p>
                </div>
                <p className={styles.text_86d8f999}>{_t("powerful_theme_editor__real_time_effect__one_click_synchronization_of_design_too_d77f5776bf126331e801d6d6aa0146f2", { }, "强大的主题编辑器，实时生效，设计工具一键同步")}</p>
                <div style={{ display: 'flex' }}>
                    <a onClick={goDsm} className={styles.buttonSecondarySolid} style={{ marginRight: '20px' }} href='/dsm'>
                        <p className={styles.text_8f6c2dc2}>{_t("learn_more", { }, "了解更多")}</p>
                    </a>
                    <a onClick={goThemeStore} className={styles.buttonSecondarySolid} href="/dsm_store">
                        <p className={styles.text_8f6c2dc2} style={{ color: 'var(--semi-color-primary)' }}>{_t("theme_store", { }, "主题商店")}</p>
                    </a>
                </div>
            </div>
            <div style={{ width: 1280, height: 750, overflow: 'hidden', }}>
                <video autoPlay loop muted src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dsm.mp4" type="video/mp4" className={styles.frame4160}></video>
            </div>
        </div>
    );
}

export default Dsm;
