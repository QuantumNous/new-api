import React from 'react';
import { useState, useMemo } from 'react';
import {
    Pagination,
    Cascader,
    LocaleProvider,
    ConfigProvider,
    Space,
    Modal,
    Button,
    Select,
    DatePicker,
    TreeSelect,
    Table,
    TimePicker,
    List,
    Calendar,
    Typography,
    Transfer,
    ImagePreview,
    Image,
    Form,
    Nav,
    InputNumber,
    JsonViewer
} from '../../index';

import zh_CN from '@douyinfe/semi-ui/locale/source/zh_CN';
import en_GB from '@douyinfe/semi-ui/locale/source/en_GB';
import en_US from '@douyinfe/semi-ui/locale/source/en_US';
import ko_KR from '@douyinfe/semi-ui/locale/source/ko_KR';
import ja_JP from '@douyinfe/semi-ui/locale/source/ja_JP';
import ru_RU from '@douyinfe/semi-ui/locale/source/ru_RU';
import vi_VN from '@douyinfe/semi-ui/locale/source/vi_VN';
import ar from '@douyinfe/semi-ui/locale/source/ar';
import id_ID from '@douyinfe/semi-ui/locale/source/id_ID';
import ms_MY from '@douyinfe/semi-ui/locale/source/ms_MY';
import th_TH from '@douyinfe/semi-ui/locale/source/th_TH';
import tr_TR from '@douyinfe/semi-ui/locale/source/tr_TR';
import pt_BR from '@douyinfe/semi-ui/locale/source/pt_BR';
import zh_TW from '@douyinfe/semi-ui/locale/source/zh_TW';
import sv_SE from '@douyinfe/semi-ui/locale/source/sv_SE';
import pl_PL from '@douyinfe/semi-ui/locale/source/pl_PL';
import nl_NL from '@douyinfe/semi-ui/locale/source/nl_NL';
import es from '@douyinfe/semi-ui/locale/source/es';
import it from '@douyinfe/semi-ui/locale/source/it';
import de from '@douyinfe/semi-ui/locale/source/de';
import fr from '@douyinfe/semi-ui/locale/source/fr';
import ro from '@douyinfe/semi-ui/locale/source/ro';
import az from '@douyinfe/semi-ui/locale/source/az';
import bg from '@douyinfe/semi-ui/locale/source/bg';
import bn_IN from '@douyinfe/semi-ui/locale/source/bn_IN';  
import ca from '@douyinfe/semi-ui/locale/source/ca';
import cs_CZ from '@douyinfe/semi-ui/locale/source/cs_CZ';
import ceb_PH from '@douyinfe/semi-ui/locale/source/ceb_PH';
import da from '@douyinfe/semi-ui/locale/source/da';
import el_GR from '@douyinfe/semi-ui/locale/source/el_GR';
import es_419 from '@douyinfe/semi-ui/locale/source/es_419';
import et from '@douyinfe/semi-ui/locale/source/et';
import fa_IR from '@douyinfe/semi-ui/locale/source/fa_IR';
import fil_PH from '@douyinfe/semi-ui/locale/source/fil_PH';
import fi_FI from '@douyinfe/semi-ui/locale/source/fi_FI';
import fr_CA from '@douyinfe/semi-ui/locale/source/fr_CA';
import ga from '@douyinfe/semi-ui/locale/source/ga';
import he_IL from '@douyinfe/semi-ui/locale/source/he_IL';
import hi_IN from '@douyinfe/semi-ui/locale/source/hi_IN';
import hr from '@douyinfe/semi-ui/locale/source/hr';
import hu_HU from '@douyinfe/semi-ui/locale/source/hu_HU';
import is from '@douyinfe/semi-ui/locale/source/is';
import jv_ID from '@douyinfe/semi-ui/locale/source/jv_ID';
import kk from '@douyinfe/semi-ui/locale/source/kk';
import km_KH from '@douyinfe/semi-ui/locale/source/km_KH';
import lt from '@douyinfe/semi-ui/locale/source/lt';
import lv from '@douyinfe/semi-ui/locale/source/lv';
import my_MM from '@douyinfe/semi-ui/locale/source/my_MM';
import nb from '@douyinfe/semi-ui/locale/source/nb';
import pt from '@douyinfe/semi-ui/locale/source/pt';
import sk from '@douyinfe/semi-ui/locale/source/sk';
import sl from '@douyinfe/semi-ui/locale/source/sl';
import sq from '@douyinfe/semi-ui/locale/source/sq';
import sw from '@douyinfe/semi-ui/locale/source/sw';
import uk_UA from '@douyinfe/semi-ui/locale/source/uk_UA';
import ur from '@douyinfe/semi-ui/locale/source/ur';
import uz from '@douyinfe/semi-ui/locale/source/uz';
import { IconUser, IconSemiLogo, IconStar } from '@douyinfe/semi-icons';

const { Option } = Select;

export default {
    title: 'LocaleProvider',
};
// -√ Pagination
// -√ Modal
// -× DatePicker
// -√ Table
// -√ Select
// -× Calendar
// -√ Timepicker

const TableDemo = () => {};

const CascaderDemo = () => {
    const treeData = [
        {
            label: '亚洲',
            value: 'yazhou',
            children: [
                {
                    label: '中国',
                    value: 'zhongguo',
                    children: [
                        {
                            label: '北京',
                            value: 'beijing',
                        },
                        {
                            label: '上海',
                            value: 'shanghai',
                        },
                    ],
                },
                {
                    label: '日本',
                    value: 'riben',
                    children: [
                        {
                            label: '大阪',
                            value: 'daban',
                        },
                    ],
                },
            ],
        },
    ];
    return <Cascader style={{ width: 300, margin: 10 }} treeData={treeData} filterTreeNode />;
};

const I18nComponent = () => {
    const [modalVisible, setModalVisible] = useState(false);
    const style = { margin: 10 };
    const presets = [
        {
            text: 'Today',
            start: new Date(),
            end: new Date(),
        },
        {
            text: 'Tomorrow',
            start: new Date(new Date().valueOf() + 1000 * 3600 * 24),
            end: new Date(new Date().valueOf() + 1000 * 3600 * 24),
        },
    ];
    const columns = useMemo(() => [
        {
            title: 'Name',
            width: 250,
            dataIndex: 'name',
        },
        {
            title: 'Age',
            width: 150,
            dataIndex: 'age',
        },
        {
            title: 'Address',
            dataIndex: 'address',
        },
    ]);
    const dataSource = useMemo(() => {
        const data = [];
        for (let i = 0; i < 1; i++) {
            data.push({
                key: '' + i,
                name: `Bytedance ${i}`,
                age: 32,
                address: `Beijing, Haidian. Zhichun Road ${i}`,
            });
        }
        return data;
    });



    return (
        <>
            <Pagination total={100} showTotal showSizeChanger style={style} />
            <Table columns={columns} dataSource={dataSource} scroll={{ y: 320 }} />

            <div style={style}>
                <Button onClick={() => setModalVisible(true)}>Show Modal</Button>
            </div>
            <div style={style}>
                <Select filter style={{ width: '180px' }}>
                    <Option value="abc">abc</Option>
                    <Option value="vigo" disabled>
                        vigo
                    </Option>
                    <Option value="hotsoon">hotsoon</Option>
                </Select>
                <CascaderDemo />
            </div>
            <Modal
                title="Modal"
                visible={modalVisible}
                onOk={() => setModalVisible(false)}
                onCancel={() => setModalVisible(false)}
            >
                <p>This is the content of a basic modal.</p>
                <p>More content...</p>
            </Modal>
            <div>
                <DatePicker type="monthRange" onChange={(date, dateString) => console.log(dateString)} />
            </div>
            <div>
              <DatePicker style={{ ...style, width: 200 }} open defaultPickerValue={[new Date('2024-09-08 00:00'), new Date('2024-09-09 12:00')]} />
              <DatePicker style={{ ...style,marginLeft:120, width: 250 }} open type="dateTime" presets={presets} presetPosition="left" defaultPickerValue={[new Date('2024-09-08 00:00'), new Date('2024-09-09 12:00')]} />
              {/* <DatePicker style={{ ...style, width: 250 }} type="dateRange" /> */}
              <DatePicker style={{ ...style, marginLeft:240, width: 400 }} open type="dateTimeRange" defaultPickerValue={[new Date('2024-09-08 00:00'), new Date('2024-09-09 12:00')]} />
            </div>
            <div style={{ marginTop: 400 }}>
              <DatePicker style={{ ...style, width: 200 }} open autoAdjustOverflow={false} position='bottomLeft' density='compact' defaultPickerValue={[new Date('2024-09-08 00:00'), new Date('2024-09-09 12:00')]} />
              <DatePicker style={{ ...style,marginLeft:120, width: 250 }} open type="dateTime" presets={presets} presetPosition="left" autoAdjustOverflow={false} position='bottomLeft' density='compact'  defaultPickerValue={[new Date('2024-09-08 00:00'), new Date('2024-09-09 12:00')]} />
              {/* <DatePicker style={{ ...style, width: 250 }} type="dateRange" /> */}
              <DatePicker style={{ ...style, marginLeft:240, width: 400 }} open type="dateTimeRange" autoAdjustOverflow={false} position='bottomLeft' density='compact' defaultPickerValue={[new Date('2024-09-08 00:00'), new Date('2024-09-09 12:00')]} />
            </div>
            <br />
            <br />
            <div style={{ marginTop: 400 }}>
              <TimePicker style={style} />
              <TimePicker use12Hours style={style} />
            </div>
            <br />
            <br />
        </>
    );
};

export const LocaleZhCn = () => (
    <LocaleProvider locale={zh_CN}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleEnGb = () => (
    <LocaleProvider locale={en_GB}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleEnUs = () => (
    <LocaleProvider locale={en_US}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleJaJp = () => (
    <LocaleProvider locale={ja_JP}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleKoKr = () => (
    <LocaleProvider locale={ko_KR}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleAr = () => (
    <LocaleProvider locale={ar}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleViVn = () => (
    <LocaleProvider locale={vi_VN}>
        <I18nComponent />
    </LocaleProvider>
);
export const LocaleRuRu = () => (
    <LocaleProvider locale={ru_RU}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleIdID = () => (
    <LocaleProvider locale={id_ID}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleMsMY = () => (
    <LocaleProvider locale={ms_MY}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleThTH = () => (
    <LocaleProvider locale={th_TH}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleTrTR = () => (
    <LocaleProvider locale={tr_TR}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocalePtBR = () => (
    <LocaleProvider locale={pt_BR}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleES = () => (
    <LocaleProvider locale={es}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleDe = () => (
    <LocaleProvider locale={de}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleIt = () => (
    <LocaleProvider locale={it}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleFr = () => (
    <LocaleProvider locale={fr}>
        <I18nComponent />
    </LocaleProvider>
);

export const LocaleRo = () => (
    <LocaleProvider locale={ro}>
        <I18nComponent />
    </LocaleProvider>
);

const treeData = [
    {
        label: 'Asia',
        value: 'asia',
        key: '1',
        children: [
            {
                label: 'China',
                value: 'china',
                key: '1-0',
                children: [
                    { label: 'Beijing', value: 'beijing', key: '1-0-0' },
                    { label: 'Shanghai', value: 'shanghai', key: '1-0-1' },
                ],
            },
            {
                label: 'Japan',
                value: 'japan',
                key: '1-1',
                children: [{ label: 'Osaka', value: 'osaka', key: '1-1-0' }],
            },
        ],
    },
];

const I18nComponent2 = (props) => {
    const [modalVisible, setModalVisible] = useState(false);
    const columns = useMemo(() => [
        {
            title: 'Name',
            width: 250,
            dataIndex: 'name',
        },
        {
            title: 'Age',
            width: 150,
            dataIndex: 'age',
        },
        {
            title: 'Address',
            dataIndex: 'address',
        },
    ]);
    const dataSource = useMemo(() => {
        const data = [];
        for (let i = 0; i < 46; i++) {
            data.push({
                key: '' + i,
                name: `Bytedance ${i}`,
                age: 32,
                address: `Beijing, Haidian. Zhichun Road ${i}`,
            });
        }
        return data;
    });
    const transferData = useMemo(() => {
        return Array.from({ length: 100 }, (v, i) => {
            return {
                label: `选项名称 ${i}`,
                value: i,
                disabled: false,
                key: i,
            };
        });
    });
    const srcList = useMemo(
        () => [
            'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg',
            'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/sky.jpg',
            'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/greenleaf.jpg',
            'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/colorful.jpg',
        ],
        []
    );
    const style = { margin: 10 };
    return (
        <>
            <h5>Pagination</h5>
            <Pagination total={100} showTotal showSizeChanger style={style} />
            <h5>Modal</h5>

            <div style={style}>
                <Button onClick={() => setModalVisible(true)}>Show Modal</Button>
                <Modal
                    title="Modal"
                    visible={modalVisible}
                    onOk={() => setModalVisible(false)}
                    onCancel={() => setModalVisible(false)}
                >
                    <p>This is the content of a basic modal.</p>
                    <p>More content...</p>
                </Modal>
            </div>
            <h5>InputNumber</h5>
            <InputNumber mode="currency" key={props.localeCode} defaultValue={1234567.89} />
            <h5>Select & Cascader</h5>
            <div style={style}>
                <Select filter style={{ width: '180px' }}>
                    <Select.Option value="abc">abc</Select.Option>
                    <Select.Option value="vigo" disabled>
                        vigo
                    </Select.Option>
                    <Select.Option value="hotsoon">hotsoon</Select.Option>
                </Select>
                <Cascader
                    style={{ width: 300, margin: 10 }}
                    treeData={treeData}
                    filterTreeNode
                    insetLabel="Cascader"
                />
            </div>
            <h5>DatePicker</h5>
            <DatePicker style={{ ...style, width: 250 }} />
            <DatePicker style={{ ...style, width: 300 }} type="dateTime" />
            <DatePicker style={{ ...style, width: 300 }} type="dateRange" />
            <DatePicker style={{ ...style, width: 450 }} type="dateTimeRange" />
            <h5>TimePicker</h5>
            <TimePicker style={style} />
            <TimePicker use12Hours style={style} />
            <br />
            <br />
            <h5>TreeSelect</h5>
            <TreeSelect
                style={{ ...style, width: 300 }}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={treeData}
                filterTreeNode
            />
            <h5>Table</h5>
            <Table columns={columns} dataSource={dataSource} scroll={{ y: 320 }} />
            <h5>Table - Empty</h5>
            <Table columns={columns} dataSource={[]} scroll={{ y: 320 }} />
            <h5>List - Empty</h5>
            <List header={<div>List</div>} dataSource={[]} />
            <h5>Calendar</h5>
            <Calendar mode="month" displayValue={new Date('2024-02-01')} />
            <h5>Typography - Copyable</h5>
            <Typography.Paragraph copyable>Click to copy text.</Typography.Paragraph>
            <h5>Typography - Collapsible</h5>
            <Typography.Paragraph
                ellipsis={{ rows: 3, expandable: true, collapsible: true }}
                style={{ width: 300 }}
            >
                支持展开和折叠：Semi Design 是由抖音前端团队与 UED
                团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                Web 应用。
            </Typography.Paragraph>
            <h5>Transfer</h5>
            <Transfer style={{ width: 568, height: 416 }} dataSource={transferData} />
            <h5>Image</h5>
            <ImagePreview showTooltip>
                {srcList.map((src, index) => {
                    return (
                        <Image
                            key={index}
                            src={src}
                            width={200}
                            alt={`lamp${index + 1}`}
                            style={{ marginRight: 5 }}
                        />
                    );
                })}
            </ImagePreview>
            <h5>Form</h5>
            <Form layout="horizontal" onValueChange={values => console.log(values)}>
                <Form.Input field="UserName" label={{ text: '角色', optional: true }} style={{ width: 200 }} />
            </Form>
            <h5>Navigation</h5>
            <Nav
                bodyStyle={{ height: 320 }}
                items={[
                    { itemKey: 'user', text: '用户管理', icon: <IconUser /> },
                    { itemKey: 'union', text: '活动管理', icon: <IconStar /> },
                ]}
                header={{
                    logo: <IconSemiLogo style={{ height: '36px', fontSize: 36 }} />,
                    text: 'Semi 数据后台',
                }}
                footer={{
                    collapseButton: true,
                }}
            />
            <h5>JsonViewer</h5>
            <JsonViewer height={100} width={700} value={`{
                "name": "Semi",
                "version": "0.0.0"
            }`} />
        </>
    );
};

class I18nDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            locale: zh_CN,
            localeCode: 'zh_CN',
        };
        this.onLanguageChange = this.onLanguageChange.bind(this);
    }

    onLanguageChange(code) {
        let language = {
            zh_CN: zh_CN,
            en_GB: en_GB,
            ko_KR: ko_KR,
            ja_JP: ja_JP,
            ar: ar,
            vi_VN: vi_VN,
            ru_RU: ru_RU,
            id_ID: id_ID,
            ms_MY: ms_MY,
            th_TH: th_TH,
            tr_TR: tr_TR,
            pt_BR: pt_BR,
            zh_TW: zh_TW,
            es: es,
            sv_SE: sv_SE,
            pl_PL: pl_PL,
            nl_NL: nl_NL,
            de,
            it,
            fr,
            ro,
            bn_IN: bn_IN,
            az,
            bg,
            ca,
            cs_CZ,
            ceb_PH,
            da,
            el_GR,
            es_419,
            et,
            fa_IR,
            fil_PH,
            fi_FI,
            fr_CA,
            ga,
            he_IL,
            hi_IN,
            hr,
            hu_HU,
            is,
            jv_ID,
            kk,
            km_KH,
            lt,
            lv,
            my_MM,
            nb,
            pt,
            sk,
            sl,
            sq,
            sw,
            uk_UA,
            ur,
            uz,
        };
        this.setState({ locale: language[code], localeCode: code });
    }

    render() {
        const { locale, localeCode } = this.state;
        return (
            <>
                <div style={{ borderBottom: '1px solid var(--semi-color-border)', paddingBottom: 20 }}>
                    <Select
                        onChange={this.onLanguageChange}
                        insetLabel="切换语言"
                        style={{ width: 250 }}
                        defaultValue="zh_CN"
                    >
                        <Select.Option value="zh_CN">简体中文</Select.Option>
                        <Select.Option value="en_GB">英语（英）</Select.Option>
                        <Select.Option value="ja_JP">日语</Select.Option>
                        <Select.Option value="ko_KR">韩语</Select.Option>
                        <Select.Option value="ar">阿拉伯语</Select.Option>
                        <Select.Option value="vi_VN">越南语</Select.Option>
                        <Select.Option value="ru_RU">俄罗斯语</Select.Option>
                        <Select.Option value="id_ID">印尼语</Select.Option>
                        <Select.Option value="ms_MY">马来语</Select.Option>
                        <Select.Option value="th_TH">泰语</Select.Option>
                        <Select.Option value="tr_TR">土耳其语</Select.Option>
                        <Select.Option value="pt_BR">葡萄牙语（巴西）</Select.Option>
                        <Select.Option value="zh_TW">繁体中文</Select.Option>
                        <Select.Option value="es">西班牙语</Select.Option>
                        <Select.Option value="de">德语</Select.Option>
                        <Select.Option value="it">意大利语</Select.Option>
                        <Select.Option value="fr">法语</Select.Option>
                        <Select.Option value="ro">罗马尼亚语</Select.Option>
                        <Select.Option value="bn_IN">孟加拉语</Select.Option>
                        <Select.Option value="az">阿塞拜疆语 az</Select.Option>
                        <Select.Option value="bg">保加利亚语 bg</Select.Option>
                        <Select.Option value="ca">加泰罗尼亚语 ca</Select.Option>
                        <Select.Option value="cs_CZ">捷克语 cs_CZ</Select.Option>
                        <Select.Option value="ceb_PH">宿务语 ceb_PH</Select.Option>
                        <Select.Option value="da">丹麦语 da</Select.Option>
                        <Select.Option value="el_GR">希腊语 el_GR</Select.Option>
                        <Select.Option value="es_419">西班牙语（拉美）es_419</Select.Option>
                        <Select.Option value="et">爱沙尼亚语 et</Select.Option>
                        <Select.Option value="fa_IR">波斯语 fa_IR</Select.Option>
                        <Select.Option value="fil_PH">菲律宾语 fil_PH</Select.Option>
                        <Select.Option value="fi_FI">芬兰语 fi_FI</Select.Option>
                        <Select.Option value="fr_CA">法语（加）fr_CA</Select.Option>
                        <Select.Option value="ga">爱尔兰语 ga</Select.Option>
                        <Select.Option value="he_IL">希伯来语 he_IL</Select.Option>
                        <Select.Option value="hi_IN">印地语 hi_IN</Select.Option>
                        <Select.Option value="hr">克罗地亚语 hr</Select.Option>
                        <Select.Option value="hu_HU">匈牙利语 hu_HU</Select.Option>
                        <Select.Option value="is">冰岛语 is</Select.Option>
                        <Select.Option value="jv_ID">爪哇语 jv_ID</Select.Option>
                        <Select.Option value="kk">哈萨克语 kk</Select.Option>
                        <Select.Option value="km_KH">高棉语 km_KH</Select.Option>
                        <Select.Option value="lt">立陶宛语 lt</Select.Option>
                        <Select.Option value="lv">拉脱维亚语 lv</Select.Option>
                        <Select.Option value="my_MM">缅甸语 my_MM</Select.Option>
                        <Select.Option value="nb">挪威语 nb</Select.Option>
                        <Select.Option value="pt">葡萄牙语 pt</Select.Option>
                        <Select.Option value="sk">斯洛伐克语 sk</Select.Option>
                        <Select.Option value="sl">斯洛文尼亚语 sl</Select.Option>
                        <Select.Option value="sq">阿尔巴尼亚语 sq</Select.Option>
                        <Select.Option value="sw">斯瓦希里语 sw</Select.Option>
                        <Select.Option value="uk_UA">乌克兰语 uk_UA</Select.Option>
                        <Select.Option value="ur">乌尔都语 ur</Select.Option>
                        <Select.Option value="uz">乌兹别克语 uz</Select.Option>
                    </Select>
                </div>
                <LocaleProvider locale={locale}>
                    <ConfigProvider direction={localeCode === 'ar' ? 'rtl' : 'ltr'} locale={locale}>
                        <I18nComponent2 localeCode={localeCode}/>
                    </ConfigProvider>
                </LocaleProvider>
            </>
        );
    }
}

export const Locale = () => <I18nDemo />;
