import { _t } from "src/utils/locale";
import React from 'react';
import styles from './index.module.scss';
import { Descriptions, Typography, Form, Button, Avatar, Table } from '@douyinfe/semi-ui';
import { IconBell, IconFeishuLogo, IconMail, IconMapPin, IconSemiLogo, IconUserCircle } from '@douyinfe/semi-icons';
import avatarPng from './images/avatar.png';
import classnames from 'classnames';

const { Title, Text } = Typography;
const { Select, TextArea } = Form;
const { Option } = Select;

const { Column } = Table;

function Demo(props) {
    const data = [
        {
            key: '1',
            sender: (
                <span>
                    <Avatar 
                        size='small' 
                        style={{ backgroundColor: 'rgb(var(--semi-pink-5))', marginRight: 12 }}>
                        <IconFeishuLogo></IconFeishuLogo>
                    </Avatar>{_t("system_notification", { }, "系统通知")}</span>
            ),
            content: <Text>{_t("semi_design_share_2code", { }, "#Semi Design2Code# 技术分享开讲啦！根据活动规则，恭喜 13 位...")}</Text>,
            time: '2020-02-02 05:13',
        },
        {
            key: '2',
            sender: (
                <span>
                    <Avatar
                        size='small' 
                        style={{ backgroundColor: 'rgb(var(--semi-teal-5))', marginRight: 12 }}>
                        <IconBell></IconBell>
                    </Avatar>{_t("system_notification", { }, "系统通知")}</span>
            ),
            content: <Text>{_t("semi_design_share_presentation", { }, "Semi Design 分享演示文稿")}</Text>,
            time: '2020-01-17 05:31',
        },
        {
            key: '3',
            sender: (
                <span>
                    <Avatar 
                        size='small' 
                        style={{ backgroundColor: 'rgb(var(--semi-grey-9))', marginRight: 12 }}>
                        <IconSemiLogo></IconSemiLogo>
                    </Avatar>{_t("system_notification", { }, "系统通知")}</span>
            ),
            content: <Text>{_t("design", { }, "设计")}</Text>,
            time: '2020-01-26 11:01',
        }
    ];
    const tabaleData = [...Array(11)].map(() => data).flat();

    const classes = classnames(styles.themeDemoContainer, props.className);
    return (
        <div className={classes}>
            <section className={styles.profile}>
                <header className={styles.profileHeader}>
                    <Avatar src={avatarPng} className={styles.avatar}></Avatar>
                    <Title heading={4} style={{ marginTop: 16 }}>Richard Hendricks</Title>
                    <Text className={styles.nickname}>@RichardHendricks</Text>
                </header>
                <main className={styles.profileMain}>
                    <Text icon={<IconMapPin size="extra-large"></IconMapPin>}>{_t("beijing__china", { }, "中国 北京")}</Text>
                    <Text icon={<IconSemiLogo></IconSemiLogo>}>{_t("douyin_certification", { }, "官方认证")}</Text>
                    <Text icon={<IconMail></IconMail>}>richard@gmail.com</Text>
                    <Text icon={<IconUserCircle></IconUserCircle>}>{_t("chief_foodie__good_at_algorithms__especially", { }, "首席吃货，擅长算法，特别是")}<br />{_t("video_compression_algorithm", { }, "视频压缩算法")}</Text>
                </main>
                <footer className={styles.profileFooter}>
                    <Text className={classnames(styles.badge1, styles.badge)} strong>{_t("official_topics", { }, "官方话题")}</Text>
                    {/* <Text className={classnames(styles.badge2, styles.badge)} strong>{_t("commercialization", { }, "商业化")}</Text> */}
                    <Text className={classnames(styles.badge3, styles.badge)} strong>{_t("big_v", { }, "大 V")}</Text>
                </footer>
            </section>
            <div>
                <section className={styles.descriptionSection}>
                    <Title heading={4}>{_t("private_message_management", { }, "私信管理")}</Title>
                    <main className={styles.descriptionsWrapper}>
                        <Descriptions align="left" style={{ marginRight: 48, width: 338 }}>
                            <Descriptions.Item itemKey={_t("apple_account", { }, "Apple 账号")}>richard@icloud.com</Descriptions.Item>
                            <Descriptions.Item itemKey={_t("google_account", { }, "Google 账号")}>richard@gmail.com</Descriptions.Item>
                        </Descriptions>
                        <Descriptions align="left" style={{ width: 338 }}>
                            <Descriptions.Item itemKey='Instagram'>richard_aaa</Descriptions.Item>
                            <Descriptions.Item itemKey='Facebook'>Richard Hendricks</Descriptions.Item>
                        </Descriptions>
                    </main>
                </section>
                <section className={styles.dataSection}>
                    <div>
                        <Form layout="horizontal" initValues={{ type: 'abc' }}>
                            <Select field="type" noLabel={true} style={{ width: 116 }}>
                                <Option value="abc">{_t("douyin_assistant", { }, "抖音小助手")}</Option>
                                <Option value="huoshan">{_t("ulike_assistant", { }, "轻颜小助手")}</Option>
                            </Select>
                            <TextArea field="content" placeholder='placeholder' noLabel={true} style={{ width: 556, height: 75 }} className={styles.textarea}></TextArea>
                            <Button theme='solid' icon={<IconFeishuLogo />}>{_t("send", { }, "发送")}</Button>
                        </Form>
                        <Table dataSource={tabaleData} pagination={{ total: 33, pageSize: 3, formatPageText: false }} className={styles.table}>
                            <Column title={_t("sender", { }, "发信人")} dataIndex="sender" key="sender" />
                            <Column title={_t("private_message_content", { }, "私信内容")} dataIndex="content" key="content" />
                            <Column title={_t("time_of_dispatch", { }, "发信时间")} dataIndex="time" key="time" />
                        </Table>
                    </div>
                  
                </section>
            </div>
        </div>
    );
}

export default Demo;
