import { _t } from "src/utils/locale";
import { Button } from '@douyinfe/semi-ui';
import { navigate } from 'gatsby-link';
import React from 'react';
import { getLocale } from '../../../../utils/locale';
import styles from "./operateButton.module.scss";
import { IconGithubLogo } from '@douyinfe/semi-icons';

function OperateButton() {
    const goStart = () => {
        navigate(`/${getLocale()}/start/getting-started`);
    };
    const goGithub = () => {
        window.open('https://github.com/DouyinFE/semi-design');
    };
    return (<div className={styles.group2835}>
        <a href={`/${getLocale()}/start/getting-started`}>
            <Button tabIndex={-1} onClick={goStart} size="large" theme="solid" className={styles.extraLarge}>{_t("start_using", { }, "开始使用")}</Button>
        </a>
        <Button
            onClick={goGithub} 
            size="large"
            type={"tertiary"}
            theme="borderless"
            style={{
                border: "1px solid var(--semi-color-border)",
                color: "var(--semi-color-text-0)",
                marginLeft: "16px"
            }}
            className={styles.extraLarge} 
            icon={<IconGithubLogo size={'large'}/>}
        >
            <span style={{ display: 'flex' }}>
                GitHub
                <span className={styles.badge}>8k</span>
            </span>
        </Button>
    </div>);
}

export default OperateButton;
