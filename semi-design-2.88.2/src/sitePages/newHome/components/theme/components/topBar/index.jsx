import React from 'react';
import styles from './index.module.scss';

function TopBar() {
    return (
        <div className={styles.tabBar}>
            <div className={styles.autoWrapper}>
                <div className={styles.container}></div><img src="https://lf9-static.semi.design/obj/semi-tos/images/1c7e7720-3479-11ec-ab65-77a60c02a0b5.svg" className={styles.windowControls} />
            </div>
        </div>
    );
}

export default TopBar;
