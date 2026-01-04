import React from 'react';
import { Input, Select, Checkbox, Button } from '@douyinfe/semi-ui';
import cls from 'classnames';
import { _t } from 'src/utils/locale';
import { useIntl } from 'react-intl';

import styles from './index.module.scss';

const Component = () => {
    const intl = useIntl();
    return (
        <div className={cls(styles.chromeStandart, 'semi-always-light')}>
            <div className={styles.appContainer}></div>
            <div className={styles.modalHeader}>
                <p className={styles.title}>{_t('example_upload_report')}</p>
            </div>
            <div className={styles.contentContainer}>
                <div className={styles.formField3frEnabled}>
                    <div className={styles.label}>
                        <p className={styles.text}>{_t('example_doc_name_zh')}</p>
                        <p className={styles.required}>*</p>
                    </div>
                    <Input placeholder={intl.formatMessage({ id: 'example_doc_name_zh_desc' })}/>
                </div>
                <div className={styles.formField3frEnabled_d6a65c7a}>
                    <div className={styles.label}>
                        <p className={styles.text}>{_t('example_doc_name_en')}</p>
                    </div>
                    <Input placeholder={intl.formatMessage({ id: 'example_doc_name_en_desc' })} />
                </div>
                <div className={styles.formField3frEnabled}>
                    <div className={styles.label}>
                        <p className={styles.text_d5545fb6}>{_t('example_doc_link')}</p>
                        <p className={styles.required}>*</p>
                    </div>
                    <Input placeholder={intl.formatMessage({ id: 'example_doc_lark_link' })} />
                    <div className={styles.helperText}></div>
                </div>
                <div className={styles.formField}>
                    <div className={styles.autoLayoutHorizontal}>
                        <p className={styles.text_d5545fb6}>{_t('example_report_tag')}</p>
                    </div>
                    <Select
                        className={styles.select}
                        multiple
                        defaultValue={['lan', 'john']}
                        placeholder={intl.formatMessage({ id: 'example_business_line' })}
                    >
                        <Select.Option value="lan">兰超然</Select.Option>
                        <Select.Option value="john">John Smitch</Select.Option>
                    </Select>
                </div>
                <div className={styles.formField3frEnabled}>
                    <div className={styles.label}>
                        <p className={styles.text_d6dd221e}>{_t('example_result')}</p>
                    </div>
                    <Input placeholder={intl.formatMessage({ id: 'example_result_desc' })} />
                </div>
                <div className={styles.formField3frEnabled}>
                    <div className={styles.label}>
                        <p className={styles.text_d6dd221e}>{_t('example_remark')}</p>
                    </div>
                    <Input placeholder={intl.formatMessage({ id: 'example_remark_desc' })} />
                </div>
            </div>
            <div className={styles.modalFooter}>
                <Checkbox>{_t('example_upload_consist')}</Checkbox>
                <div className={styles.actions}>
                    <Button type="tertiary" theme="light">{_t('example_cancel')}</Button>
                    <Button type="secondary" theme='solid'>{_t('example_confirm')}</Button>
                </div>
            </div>
            {/* eslint-disable-next-line */}
            <img
                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/tab-head.png"
                className={styles.tabBar}
            />
        </div>
    );
};

export default Component;
