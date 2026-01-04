import { _t } from "src/utils/locale";
import React from 'react';
import styles from './products.module.scss';
import classnames from 'classnames';
import { ByteHiSvg, StarRiverSvg, AnyWebSvg, CapCutSvg, LarkProgramSvg, CozeSvg } from '../svg.jsx';

function Products(props) {
    const classForDarkImage = classnames(styles.showInDark, styles.hideInLight);
    return (
        <div {...props} className={styles.frame14368}>
            <p className={styles.text_ff23e7f4}>{_t("now_serving_100_000", { }, "现已服务 10 万")}</p>
            <div className={styles.frame14369}>
                <div className={classnames(styles.group720)} key='coze'>
                    <CozeSvg />
                </div>
                <div key='douyinCreator'>
                    <img src="https://lf9-static.semi.design/obj/semi-tos/images/16cf36e0-321a-11ec-b393-ab4adc2e449f.png" className={classnames(styles.image42, styles.hideInDark)} alt="douyin logo" />          
                    <img className={classForDarkImage} src="https://lf9-static.semi.design/obj/semi-tos/images/a50bd6f0-3474-11ec-b008-15e09471f238.png" style={{ width: 155, height: 36 }} alt="douyin logo" />              
                </div>
                <div key="lark" className={classnames(styles.group720)}>
                    <img src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/lark.png" className={styles.logo_lark} alt="larkprogram logo" />
                    <LarkProgramSvg />
                </div>
                <div key="byteHi" className={classnames(styles.group720)}>
                    <img src="https://lf9-static.semi.design/obj/semi-tos/images/16cec1b0-321a-11ec-adec-e911cea4cf98.png" className={styles.logo_bytehi} alt="bytehi logo"/>
                    <ByteHiSvg />
                </div>
                <div key="starRiver" className={classnames(styles.group720)}>
                    <StarRiverSvg />
                </div>
                <div key="anyWeb" className={classnames(styles.group720)}>
                    <AnyWebSvg />
                </div>
                <div className={styles.frame4144}>
                    <img src="https://lf9-static.semi.design/obj/semi-tos/images/16d06f60-321a-11ec-9c23-a9f1bde3758e.png" className={styles.logo_sso} alt="bytedance sso logo" />
                    <p className={styles.developer_11777484}>Bytedance SSO</p>
                </div>
                <div key="capcut" className={classnames(styles.group720)}>
                    <CapCutSvg />
                </div>
            </div>
        </div>
    );
}

export default Products;
