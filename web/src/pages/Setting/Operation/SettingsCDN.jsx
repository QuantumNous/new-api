import React, { useEffect, useState, useRef } from 'react';
import {
  Button,
  Col,
  Form,
  Row,
  Spin,
  Table,
  Input,
  Popconfirm,
  Typography,
  Space,
} from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsCDN(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'cdn_setting.enabled': false,
    'cdn_setting.detect_header': 'X-GeoIP-Country',
    'cdn_setting.rules': '{}',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  const [newCountry, setNewCountry] = useState('');
  const [newUrl, setNewUrl] = useState('');

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function getRulesArray() {
    try {
      const rulesStr = inputs['cdn_setting.rules'];
      const rulesObj =
        typeof rulesStr === 'string' ? JSON.parse(rulesStr) : rulesStr;
      return Object.entries(rulesObj || {}).map(([country, url]) => ({
        country,
        url,
      }));
    } catch {
      return [];
    }
  }

  function setRulesFromArray(arr) {
    const rulesObj = {};
    arr.forEach(({ country, url }) => {
      if (country) rulesObj[country] = url;
    });
    const rulesStr = JSON.stringify(rulesObj);
    setInputs((prev) => ({ ...prev, 'cdn_setting.rules': rulesStr }));
  }

  function handleAddRule() {
    const country = newCountry.trim().toUpperCase();
    if (!country) {
      showWarning(t('请输入国家代码'));
      return;
    }
    const url = newUrl.trim();
    if (!url) {
      showWarning(t('请输入CDN地址'));
      return;
    }
    const rules = getRulesArray();
    const existing = rules.findIndex(
      (r) => r.country.toUpperCase() === country,
    );
    if (existing >= 0) {
      rules[existing].url = url;
    } else {
      rules.push({ country, url });
    }
    setRulesFromArray(rules);
    setNewCountry('');
    setNewUrl('');
  }

  function handleDeleteRule(country) {
    const rules = getRulesArray().filter(
      (r) => r.country.toUpperCase() !== country.toUpperCase(),
    );
    setRulesFromArray(rules);
  }

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      return API.put('/api/option/', {
        key: item.key,
        value: String(inputs[item.key]),
      });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined))
            return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    if (refForm.current) {
      refForm.current.setValues(currentInputs);
    }
  }, [props.options]);

  const rulesData = getRulesArray();
  const columns = [
    {
      title: t('国家代码'),
      dataIndex: 'country',
      key: 'country',
      width: 150,
      render: (text) => (
        <Typography.Text strong={text.toUpperCase() === 'DEFAULT'}>
          {text.toUpperCase()}
        </Typography.Text>
      ),
    },
    {
      title: t('CDN 地址'),
      dataIndex: 'url',
      key: 'url',
    },
    {
      title: t('操作'),
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title={t('确认删除？')}
          onConfirm={() => handleDeleteRule(record.country)}
        >
          <Button theme='light' type='danger' size='small'>
            {t('删除')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section text={t('CDN 加速设置')}>
          <Typography.Text
            type='tertiary'
            style={{ marginBottom: 16, display: 'block' }}
          >
            {t(
              '通过 CDN 加速前端静态资源加载，按访客国家分配不同的 CDN 节点。需要 nginx 配置 GeoIP 模块并传递国家代码请求头。',
            )}
          </Typography.Text>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                field={'cdn_setting.enabled'}
                label={t('启用 CDN')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                onChange={handleFieldChange('cdn_setting.enabled')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field={'cdn_setting.detect_header'}
                label={t('检测请求头')}
                placeholder='X-GeoIP-Country'
                onChange={handleFieldChange('cdn_setting.detect_header')}
                disabled={!inputs['cdn_setting.enabled']}
              />
            </Col>
          </Row>

          <Typography.Title
            heading={6}
            style={{ marginTop: 16, marginBottom: 8 }}
          >
            {t('CDN 规则')}
          </Typography.Title>
          <Typography.Text
            type='tertiary'
            style={{ marginBottom: 12, display: 'block' }}
          >
            {t(
              '按国家代码配置 CDN 地址，精确匹配国家规则，未匹配时使用 default 规则兜底',
            )}
          </Typography.Text>

          <Table
            columns={columns}
            dataSource={rulesData}
            pagination={false}
            size='small'
            rowKey='country'
            empty={
              <Typography.Text type='tertiary'>
                {t('暂无规则，请在下方添加')}
              </Typography.Text>
            }
            style={{ marginBottom: 12 }}
          />

          <Space style={{ marginBottom: 16 }}>
            <Input
              placeholder={t('国家代码 (如 CN、US、default)')}
              value={newCountry}
              onChange={setNewCountry}
              style={{ width: 220 }}
              disabled={!inputs['cdn_setting.enabled']}
            />
            <Input
              placeholder={t('CDN 地址 (如 https://cdn-cn.example.com)')}
              value={newUrl}
              onChange={setNewUrl}
              style={{ width: 400 }}
              disabled={!inputs['cdn_setting.enabled']}
            />
            <Button
              onClick={handleAddRule}
              disabled={!inputs['cdn_setting.enabled']}
            >
              {t('添加规则')}
            </Button>
          </Space>

          <Row>
            <Button size='default' onClick={onSubmit}>
              {t('保存 CDN 设置')}
            </Button>
          </Row>
        </Form.Section>
      </Form>
    </Spin>
  );
}
