/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Button,
  Col,
  Collapsible,
  Form,
  Radio,
  RadioGroup,
  Row,
  SideSheet,
  Spin,
  Switch,
  Tabs,
  Typography,
} from '@douyinfe/semi-ui';
import { IconChevronDown, IconChevronUp } from '@douyinfe/semi-icons';
import { IconHelpCircle } from '@douyinfe/semi-icons';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import GroupTable from './components/GroupTable';
import AutoGroupList from './components/AutoGroupList';
import GroupGroupRatioRules from './components/GroupGroupRatioRules';
import GroupSpecialUsableRules from './components/GroupSpecialUsableRules';

const { Text, Title, Paragraph } = Typography;

const OPTION_KEYS = [
  'GroupRatio',
  'UserUsableGroups',
  'GroupGroupRatio',
  'group_ratio_setting.group_special_usable_group',
  'AutoGroups',
  'DefaultUseAutoGroup',
];

function parseJSONSafe(str, fallback) {
  if (!str || !str.trim()) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default function GroupRatioSettings(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState('visual');
  const [showGuide, setShowGuide] = useState(false);

  const [inputs, setInputs] = useState({
    GroupRatio: '',
    UserUsableGroups: '',
    GroupGroupRatio: '',
    'group_ratio_setting.group_special_usable_group': '',
    AutoGroups: '',
    DefaultUseAutoGroup: false,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const dataVersionRef = useRef(0);

  const groupNames = useMemo(() => {
    const ratioMap = parseJSONSafe(inputs.GroupRatio, {});
    return Object.keys(ratioMap);
  }, [inputs.GroupRatio]);

  async function onSubmit() {
    if (editMode === 'manual') {
      try {
        await refForm.current.validate();
      } catch {
        showError(t('请检查输入'));
        return;
      }
    }

    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) {
      return showWarning(t('你似乎并没有修改什么'));
    }

    const requestQueue = updateArray.map((item) => {
      const value =
        typeof inputs[item.key] === 'boolean'
          ? String(inputs[item.key])
          : inputs[item.key];
      return API.put('/api/option/', { key: item.key, value });
    });

    setLoading(true);
    try {
      const res = await Promise.all(requestQueue);
      if (res.includes(undefined)) {
        return showError(
          requestQueue.length > 1
            ? t('部分保存失败，请重试')
            : t('保存失败'),
        );
      }
      for (let i = 0; i < res.length; i++) {
        if (!res[i].data.success) {
          return showError(res[i].data.message);
        }
      }
      showSuccess(t('保存成功'));
      props.refresh();
    } catch (error) {
      console.error('Unexpected error:', error);
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (OPTION_KEYS.includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    dataVersionRef.current += 1;
    if (refForm.current) {
      refForm.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleGroupTableChange = useCallback(
    ({ GroupRatio, UserUsableGroups }) => {
      setInputs((prev) => ({ ...prev, GroupRatio, UserUsableGroups }));
    },
    [],
  );

  const handleAutoGroupsChange = useCallback((value) => {
    setInputs((prev) => ({ ...prev, AutoGroups: value }));
  }, []);

  const handleGroupGroupRatioChange = useCallback((value) => {
    setInputs((prev) => ({ ...prev, GroupGroupRatio: value }));
  }, []);

  const handleSpecialUsableChange = useCallback((value) => {
    setInputs((prev) => ({
      ...prev,
      'group_ratio_setting.group_special_usable_group': value,
    }));
  }, []);

  const dv = dataVersionRef.current;

  const renderVisualMode = () => (
    <Form key='form-visual' values={inputs} style={{ marginBottom: 15 }}>
      <Form.Section text={t('分组管理')}>
        <Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
          {t('倍率用于计费乘数，勾选「用户可选」后用户可在创建令牌时选择该分组')}
        </Text>
        <GroupTable
          key={`gt_${dv}`}
          groupRatio={inputs.GroupRatio}
          userUsableGroups={inputs.UserUsableGroups}
          onChange={handleGroupTableChange}
        />
      </Form.Section>

      <Form.Section text={t('自动分组')}>
        <Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
          {t('令牌分组设为 auto 时，按以下顺序依次尝试选择可用分组，排在前面的优先级更高')}
        </Text>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8} lg={8} xl={8}>
            <Form.Slot label={t('默认使用auto分组')}>
              <div className='flex items-center gap-2'>
                <Switch
                  checked={!!inputs.DefaultUseAutoGroup}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(value) =>
                    setInputs((prev) => ({
                      ...prev,
                      DefaultUseAutoGroup: value,
                    }))
                  }
                />
              </div>
              <Text type='tertiary' size='small' style={{ marginTop: 4 }}>
                {t('开启后创建令牌默认选择auto分组，初始令牌也将设为auto')}
              </Text>
            </Form.Slot>
          </Col>
        </Row>
        <AutoGroupList
          key={`ag_${dv}`}
          value={inputs.AutoGroups}
          groupNames={groupNames}
          onChange={handleAutoGroupsChange}
        />
      </Form.Section>

      <Form.Section text={t('分组特殊倍率')}>
        <Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
          {t('当某个分组的用户使用另一个分组的令牌时，可设置特殊倍率覆盖基础倍率。例如：vip 分组的用户使用 default 分组时倍率为 0.5')}
        </Text>
        <GroupGroupRatioRules
          key={`ggr_${dv}`}
          value={inputs.GroupGroupRatio}
          groupNames={groupNames}
          onChange={handleGroupGroupRatioChange}
        />
      </Form.Section>

      <Form.Section text={t('分组特殊可用分组')}>
        <Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
          {t('为特定用户分组配置可用分组的增减规则。「添加」为该分组新增可用分组，「移除」移除默认可用分组，「追加」直接追加分组')}
        </Text>
        <GroupSpecialUsableRules
          key={`gsu_${dv}`}
          value={inputs['group_ratio_setting.group_special_usable_group']}
          groupNames={groupNames}
          onChange={handleSpecialUsableChange}
        />
      </Form.Section>
    </Form>
  );

  useEffect(() => {
    if (editMode === 'manual' && refForm.current) {
      refForm.current.setValues(inputs);
    }
  }, [editMode]);

  const renderManualMode = () => (
    <Form
      key='form-manual'
      initValues={inputs}
      getFormApi={(formAPI) => (refForm.current = formAPI)}
      style={{ marginBottom: 15 }}
    >
      <Form.Section text={t('分组JSON设置')}>
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('分组倍率')}
              placeholder={t('为一个 JSON 文本，键为分组名称，值为倍率')}
              extraText={t(
                '分组倍率设置，可以在此处新增分组或修改现有分组的倍率，格式为 JSON 字符串，例如：{"vip": 0.5, "test": 1}，表示 vip 分组的倍率为 0.5，test 分组的倍率为 1',
              )}
              field={'GroupRatio'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => verifyJSON(value),
                  message: t('不是合法的 JSON 字符串'),
                },
              ]}
              onChange={(value) =>
                setInputs((prev) => ({ ...prev, GroupRatio: value }))
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('用户可选分组')}
              placeholder={t(
                '为一个 JSON 文本，键为分组名称，值为分组描述',
              )}
              extraText={t(
                '用户新建令牌时可选的分组，格式为 JSON 字符串，例如：{"vip": "VIP 用户", "test": "测试"}，表示用户可以选择 vip 分组和 test 分组',
              )}
              field={'UserUsableGroups'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => verifyJSON(value),
                  message: t('不是合法的 JSON 字符串'),
                },
              ]}
              onChange={(value) =>
                setInputs((prev) => ({ ...prev, UserUsableGroups: value }))
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('分组特殊倍率')}
              placeholder={t('为一个 JSON 文本')}
              extraText={t(
                '键为分组名称，值为另一个 JSON 对象，键为分组名称，值为该分组的用户的特殊分组倍率，例如：{"vip": {"default": 0.5, "test": 1}}，表示 vip 分组的用户在使用default分组的令牌时倍率为0.5，使用test分组时倍率为1',
              )}
              field={'GroupGroupRatio'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => verifyJSON(value),
                  message: t('不是合法的 JSON 字符串'),
                },
              ]}
              onChange={(value) =>
                setInputs((prev) => ({ ...prev, GroupGroupRatio: value }))
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('分组特殊可用分组')}
              placeholder={t('为一个 JSON 文本')}
              extraText={t(
                '键为用户分组名称，值为操作映射对象。内层键以"+:"开头表示添加指定分组（键值为分组名称，值为描述），以"-:"开头表示移除指定分组（键值为分组名称），不带前缀的键直接添加该分组。例如：{"vip": {"+:premium": "高级分组", "special": "特殊分组", "-:default": "默认分组"}}，表示 vip 分组的用户可以使用 premium 和 special 分组，同时移除 default 分组的访问权限',
              )}
              field={'group_ratio_setting.group_special_usable_group'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => verifyJSON(value),
                  message: t('不是合法的 JSON 字符串'),
                },
              ]}
              onChange={(value) =>
                setInputs((prev) => ({
                  ...prev,
                  'group_ratio_setting.group_special_usable_group': value,
                }))
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('自动分组auto，从第一个开始选择')}
              placeholder={t('为一个 JSON 文本')}
              field={'AutoGroups'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => {
                    if (!value || value.trim() === '') return true;
                    try {
                      const parsed = JSON.parse(value);
                      if (!Array.isArray(parsed)) return false;
                      return parsed.every((item) => typeof item === 'string');
                    } catch {
                      return false;
                    }
                  },
                  message: t(
                    '必须是有效的 JSON 字符串数组，例如：["g1","g2"]',
                  ),
                },
              ]}
              onChange={(value) =>
                setInputs((prev) => ({ ...prev, AutoGroups: value }))
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={16}>
            <Form.Switch
              label={t(
                '创建令牌默认选择auto分组，初始令牌也将设为auto（否则留空，为用户默认分组）',
              )}
              field={'DefaultUseAutoGroup'}
              onChange={(value) =>
                setInputs((prev) => ({
                  ...prev,
                  DefaultUseAutoGroup: value,
                }))
              }
            />
          </Col>
        </Row>
      </Form.Section>
    </Form>
  );

  const GuideSection = ({ title, children }) => {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ marginTop: 16 }}>
        <Button
          theme='borderless'
          size='small'
          icon={open ? <IconChevronUp /> : <IconChevronDown />}
          onClick={() => setOpen(!open)}
          style={{ padding: '4px 0', color: 'var(--semi-color-primary)' }}
        >
          {title}
        </Button>
        <Collapsible isOpen={open} keepDOM>
          <div
            style={{
              background: 'var(--semi-color-fill-0)',
              padding: '12px 16px',
              borderRadius: 8,
              marginTop: 8,
            }}
          >
            {children}
          </div>
        </Collapsible>
      </div>
    );
  };

  const CodeBlock = ({ children }) => (
    <pre
      style={{
        background: 'var(--semi-color-bg-2)',
        border: '1px solid var(--semi-color-border)',
        padding: '10px 14px',
        borderRadius: 6,
        fontFamily: 'monospace',
        fontSize: 13,
        margin: '8px 0',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.6,
        overflowX: 'auto',
      }}
    >
      {children}
    </pre>
  );

  const renderGuide = () => (
    <SideSheet
      title={t('分组设置使用说明')}
      visible={showGuide}
      onCancel={() => setShowGuide(false)}
      width={560}
      bodyStyle={{ overflow: 'auto', padding: '0 24px 24px' }}
    >
      <Tabs type='line' size='small'>
        <Tabs.TabPane tab={t('概览')} itemKey='overview'>
          <div style={{ paddingTop: 20 }}>
            <Title heading={5}>{t('什么是分组？')}</Title>
            <Paragraph style={{ marginTop: 12, lineHeight: 1.8 }}>
              {t(
                '分组是用于控制计费倍率和模型访问权限的核心概念。每个用户属于一个分组，每个令牌也可以指定使用某个分组。',
              )}
            </Paragraph>
            <Paragraph style={{ marginTop: 8, lineHeight: 1.8 }}>
              {t(
                '通过分组可以实现不同用户等级的差异化定价，例如 VIP 用户享受更低的 API 调用费用。',
              )}
            </Paragraph>

            <GuideSection title={t('核心概念')}>
              <Paragraph style={{ lineHeight: 1.8 }}>
                <Text strong>{t('用户分组')}</Text>{' — '}
                {t('由管理员分配，决定用户身份等级（如 default、vip）。')}
              </Paragraph>
              <Paragraph style={{ lineHeight: 1.8, marginTop: 4 }}>
                <Text strong>{t('令牌分组')}</Text>{' — '}
                {t('用户创建令牌时选择的分组，决定该令牌的实际计费倍率。一个用户可以创建多个令牌，使用不同分组。')}
              </Paragraph>
              <Paragraph style={{ lineHeight: 1.8, marginTop: 4 }}>
                <Text strong>{t('倍率')}</Text>{' — '}
                {t('计费乘数，倍率越低费用越低。例如倍率 0.5 表示半价。')}
              </Paragraph>
              <Paragraph style={{ lineHeight: 1.8, marginTop: 4 }}>
                <Text strong>{t('用户可选')}</Text>{' — '}
                {t('勾选后，该分组会出现在用户创建令牌时的下拉菜单中。未勾选的分组只能由管理员分配，用户自己无法选择。')}
              </Paragraph>
              <Paragraph style={{ lineHeight: 1.8, marginTop: 4 }}>
                <Text strong>{t('自动分组')}</Text>{' — '}
                {t('令牌分组设为 auto 时，系统按优先级顺序自动选择一个可用分组。')}
              </Paragraph>
            </GuideSection>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab={t('分组管理')} itemKey='groups'>
          <div style={{ paddingTop: 20 }}>
            <Title heading={5}>{t('创建和管理分组')}</Title>
            <Paragraph style={{ marginTop: 12, lineHeight: 1.8 }}>
              {t('每个分组代表一个价格档位。管理员创建分组后，可以选择哪些档位对用户开放自选。')}
            </Paragraph>

            <GuideSection title={t('查看示例')}>
              <Paragraph size='small' type='tertiary' style={{ marginBottom: 8 }}>
                {t('场景：站点提供两个价格档位，用户可以按需选择')}
              </Paragraph>
              <CodeBlock>
                {`${t('分组名')}      ${t('倍率')}    ${t('用户可选')}    ${t('说明')}\n──────────────────────────────────────\nstandard  1.0     ${t('是')}        ${t('标准价格')}\npremium   0.5     ${t('是')}        ${t('高级套餐，半价优惠')}`}
              </CodeBlock>
              <Paragraph size='small' style={{ marginTop: 10, lineHeight: 1.8 }}>
                {t('两个分组都勾选了「用户可选」，所以用户创建令牌时可以看到这两个选项：')}
              </Paragraph>
              <CodeBlock>
                {t('用户创建令牌 → 选择分组下拉框：')}{'\n'}
                {`  ├─ standard (${t('标准价格')})`}{'\n'}
                {`  └─ premium  (${t('高级套餐，半价优惠')})`}
              </CodeBlock>
              <Paragraph size='small' style={{ marginTop: 10, lineHeight: 1.8 }}>
                {t('选择 premium 创建的令牌，调用 API 时费用为 standard 的 50%。')}
              </Paragraph>
              <Paragraph size='small' style={{ marginTop: 16, lineHeight: 1.8 }}>
                <Text strong>{t('对比：不勾选「用户可选」的场景')}</Text>
              </Paragraph>
              <Paragraph size='small' style={{ marginTop: 4, lineHeight: 1.8 }}>
                {t('假设再加两个分组 default 和 vip，但不勾选用户可选：')}
              </Paragraph>
              <CodeBlock>
                {`${t('分组名')}      ${t('倍率')}    ${t('用户可选')}    ${t('说明')}\n──────────────────────────────────────\ndefault   1.0     ${t('否')}        ${t('管理员分配的基础分组')}\nvip       0.5     ${t('否')}        ${t('管理员分配的优惠分组')}\nstandard  1.0     ${t('是')}        ${t('标准价格')}\npremium   0.5     ${t('是')}        ${t('高级套餐，半价优惠')}`}
              </CodeBlock>
              <Paragraph size='small' style={{ marginTop: 8, lineHeight: 1.8 }}>
                {t('此时用户创建令牌时只能看到 standard 和 premium：')}
              </Paragraph>
              <CodeBlock>
                {t('用户创建令牌 → 选择分组下拉框：')}{'\n'}
                {`  ├─ standard (${t('标准价格')})`}{'\n'}
                {`  └─ premium  (${t('高级套餐，半价优惠')})`}{'\n\n'}
                {`  ${t('不会出现')} default ${t('和')} vip`}
              </CodeBlock>
              <Paragraph size='small' style={{ marginTop: 8, lineHeight: 1.8 }}>
                {t('default 和 vip 只能由管理员在「用户管理」中分配给用户。适用于按用户等级定价、内部测试等不希望用户自主选择的场景。')}
              </Paragraph>
              <Paragraph size='small' style={{ marginTop: 12, lineHeight: 1.8 }}>
                <Text strong>{t('用户分组的联动作用')}</Text>
              </Paragraph>
              <Paragraph size='small' style={{ lineHeight: 1.8 }}>
                {t('管理员给用户分配的分组（如 vip）不仅决定用户身份，还会影响后续两个功能：')}
              </Paragraph>
              <Paragraph size='small' style={{ lineHeight: 1.8, marginTop: 4 }}>
                {'1. '}<Text strong>{t('特殊倍率')}</Text>{' — '}
                {t('可以根据用户分组设置不同的计费倍率。例如 vip 用户使用 standard 令牌时倍率从 1.0 降为 0.8。')}
              </Paragraph>
              <Paragraph size='small' style={{ lineHeight: 1.8, marginTop: 2 }}>
                {'2. '}<Text strong>{t('可用分组')}</Text>{' — '}
                {t('可以根据用户分组增减令牌可选的分组范围。例如 vip 用户额外开放 premium 分组，或移除某个分组的选择权。')}
              </Paragraph>
              <Paragraph size='small' type='tertiary' style={{ lineHeight: 1.8, marginTop: 6 }}>
                {t('详见「特殊倍率」和「可用分组」标签页。')}
              </Paragraph>
            </GuideSection>

            <GuideSection title={t('JSON 格式参考')}>
              <Paragraph size='small' style={{ marginBottom: 4 }}>
                <Text strong code>GroupRatio</Text>{' — '}{t('分组名称到倍率的映射')}
              </Paragraph>
              <CodeBlock>{`{"default": 1, "vip": 0.5, "standard": 1, "premium": 0.5}`}</CodeBlock>
              <Paragraph size='small' style={{ marginBottom: 4, marginTop: 8 }}>
                <Text strong code>UserUsableGroups</Text>{' — '}{t('用户可选分组的名称和描述（只包含勾选了用户可选的分组）')}
              </Paragraph>
              <CodeBlock>{`{"standard": "${t('标准价格')}", "premium": "${t('高级套餐，半价优惠')}"}`}</CodeBlock>
            </GuideSection>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab={t('自动分组')} itemKey='auto'>
          <div style={{ paddingTop: 20 }}>
            <Title heading={5}>{t('自动分组选择')}</Title>
            <Paragraph style={{ marginTop: 12, lineHeight: 1.8 }}>
              {t('当令牌分组设为 auto 时，系统按列表顺序依次选择可用分组。排在前面的优先级更高。')}
            </Paragraph>

            <GuideSection title={t('查看示例')}>
              <Paragraph size='small' type='tertiary' style={{ marginBottom: 6 }}>
                {t('场景：设置自动选择优先级')}
              </Paragraph>
              <CodeBlock>
                {`1. default    ${t('最高优先级')}\n2. vip`}
              </CodeBlock>
              <Paragraph size='small' style={{ marginTop: 6, lineHeight: 1.6 }}>
                {t('开启「默认使用 auto 分组」后，新建令牌和初始令牌都会自动设为 auto。')}
              </Paragraph>
            </GuideSection>

            <GuideSection title={t('JSON 格式参考')}>
              <Paragraph size='small' style={{ marginBottom: 4 }}>
                <Text strong code>AutoGroups</Text>{' — '}{t('有序字符串数组')}
              </Paragraph>
              <CodeBlock>{`["default", "vip"]`}</CodeBlock>
            </GuideSection>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab={t('特殊倍率')} itemKey='ratios'>
          <div style={{ paddingTop: 20 }}>
            <Title heading={5}>{t('跨分组特殊倍率')}</Title>
            <Paragraph style={{ marginTop: 12, lineHeight: 1.8 }}>
              {t('正常情况下，令牌的计费倍率由令牌所选的分组决定。特殊倍率可以根据「用户所在分组」进一步覆盖这个倍率。')}
            </Paragraph>
            <Paragraph style={{ marginTop: 8, lineHeight: 1.8 }}>
              {t('简单来说：同一个令牌分组，不同等级的用户可以享受不同的价格。')}
            </Paragraph>

            <GuideSection title={t('查看示例')}>
              <Paragraph size='small' type='tertiary' style={{ marginBottom: 8 }}>
                {t('场景：站点有 standard（倍率 1.0）和 premium（倍率 0.5）两个分组，希望 vip 用户使用 standard 令牌时也能享受折扣')}
              </Paragraph>
              <Paragraph size='small' style={{ marginBottom: 8, lineHeight: 1.8 }}>
                <Text strong>{t('不配置特殊倍率时：')}</Text>
              </Paragraph>
              <CodeBlock>
                {`${t('普通用户')} + standard ${t('令牌')} → ${t('倍率')} 1.0  (${t('原价')})\nvip ${t('用户')}  + standard ${t('令牌')} → ${t('倍率')} 1.0  (${t('原价，和普通用户一样')})`}
              </CodeBlock>
              <Paragraph size='small' style={{ marginTop: 10, marginBottom: 8, lineHeight: 1.8 }}>
                <Text strong>{t('配置特殊倍率后：')}</Text>
              </Paragraph>
              <CodeBlock>
                {`${t('用户分组')}    ${t('使用分组')}    ${t('倍率')}\n────────────────────────────\nvip       standard   0.8\nvip       premium    0.3`}
              </CodeBlock>
              <Paragraph size='small' style={{ marginTop: 10, lineHeight: 1.8 }}>
                {t('配置后的效果：')}
              </Paragraph>
              <CodeBlock>
                {`${t('普通用户')} + standard ${t('令牌')} → ${t('倍率')} 1.0  (${t('不变')})\nvip ${t('用户')}  + standard ${t('令牌')} → ${t('倍率')} 0.8  (${t('享受 8 折')})\nvip ${t('用户')}  + premium  ${t('令牌')} → ${t('倍率')} 0.3  (${t('从 0.5 降到 0.3')})`}
              </CodeBlock>
              <Paragraph size='small' type='tertiary' style={{ marginTop: 10, lineHeight: 1.8 }}>
                {t('只有配置了规则的组合才会覆盖，未配置的组合仍使用令牌分组的基础倍率。')}
              </Paragraph>
            </GuideSection>

            <GuideSection title={t('JSON 格式参考')}>
              <Paragraph size='small' style={{ marginBottom: 4 }}>
                <Text strong code>GroupGroupRatio</Text>{' — '}{t('嵌套映射：用户分组 → 使用分组 → 倍率')}
              </Paragraph>
              <CodeBlock>{`{\n  "vip": {\n    "standard": 0.8,\n    "premium": 0.3\n  }\n}`}</CodeBlock>
            </GuideSection>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab={t('可用分组')} itemKey='usable'>
          <div style={{ paddingTop: 20 }}>
            <Title heading={5}>{t('特殊可用分组规则')}</Title>
            <Paragraph style={{ marginTop: 12, lineHeight: 1.8 }}>
              {t('默认情况下，所有用户创建令牌时看到的可选分组列表是一样的（即「用户可选」列勾选的分组）。')}
            </Paragraph>
            <Paragraph style={{ marginTop: 8, lineHeight: 1.8 }}>
              {t('通过此功能，可以根据用户所在分组，为不同等级的用户展示不同的可选列表。')}
            </Paragraph>

            <GuideSection title={t('查看示例')}>
              <Paragraph size='small' type='tertiary' style={{ marginBottom: 8 }}>
                {t('场景：站点有 standard 和 premium 两个用户可选分组。希望 vip 用户额外看到 exclusive 分组，同时不再看到 standard 分组')}
              </Paragraph>
              <Paragraph size='small' style={{ marginBottom: 8, lineHeight: 1.8 }}>
                <Text strong>{t('不配置规则时，所有用户看到的下拉框一样：')}</Text>
              </Paragraph>
              <CodeBlock>
                {`${t('所有用户')} → ${t('创建令牌可选')}:\n  ├─ standard\n  └─ premium`}
              </CodeBlock>
              <Paragraph size='small' style={{ marginTop: 10, marginBottom: 8, lineHeight: 1.8 }}>
                <Text strong>{t('为 vip 用户配置规则：')}</Text>
              </Paragraph>
              <CodeBlock>
                {`${t('用户分组')}    ${t('操作')}        ${t('目标分组')}    ${t('描述')}\n──────────────────────────────────────────\nvip       ${t('添加')} (+:)   exclusive   ${t('专属分组')}\nvip       ${t('移除')} (-:)   standard    -`}
              </CodeBlock>
              <Paragraph size='small' style={{ marginTop: 10, lineHeight: 1.8 }}>
                {t('配置后的效果：')}
              </Paragraph>
              <CodeBlock>
                {`${t('普通用户')} → ${t('创建令牌可选')}:\n  ├─ standard\n  └─ premium\n\nvip ${t('用户')} → ${t('创建令牌可选')}:\n  ├─ premium     (${t('保留')})\n  └─ exclusive   (${t('新增')})\n\n  ${t('standard 已被移除，vip 用户看不到')}`}
              </CodeBlock>

              <Paragraph size='small' style={{ marginTop: 14, lineHeight: 1.8 }}>
                <Text strong>{t('三种操作的区别：')}</Text>
              </Paragraph>
              <CodeBlock>
                {`${t('添加')} (+:)  → ${t('在默认列表基础上新增一个分组')}\n${t('移除')} (-:)  → ${t('从默认列表中去掉一个分组')}\n${t('追加')}       → ${t('直接追加（和添加类似，但无前缀）')}`}
              </CodeBlock>
            </GuideSection>

            <GuideSection title={t('JSON 格式参考')}>
              <Paragraph size='small' style={{ marginBottom: 4 }}>
                <Text strong code>group_special_usable_group</Text>
              </Paragraph>
              <CodeBlock>{`{\n  "vip": {\n    "+:exclusive": "${t('专属分组')}",\n    "-:standard": "remove"\n  }\n}`}</CodeBlock>
              <Paragraph size='small' type='tertiary' style={{ marginTop: 6, lineHeight: 1.6 }}>
                {t('键的前缀 +: 表示添加，-: 表示移除，无前缀表示追加。值为分组描述（移除时填 "remove"）。')}
              </Paragraph>
            </GuideSection>
          </div>
        </Tabs.TabPane>
      </Tabs>
    </SideSheet>
  );

  return (
    <Spin spinning={loading}>
      <div style={{ marginBottom: 15 }}>
        <div className='flex items-center gap-3' style={{ marginTop: 12, marginBottom: 16 }}>
          <RadioGroup
            type='button'
            size='small'
            value={editMode}
            onChange={(e) => setEditMode(e.target.value)}
          >
            <Radio value='visual'>{t('可视化编辑')}</Radio>
            <Radio value='manual'>{t('手动编辑')}</Radio>
          </RadioGroup>
          <Button
            icon={<IconHelpCircle />}
            theme='borderless'
            type='tertiary'
            size='small'
            onClick={() => setShowGuide(true)}
          >
            {t('使用说明')}
          </Button>
        </div>
        {editMode === 'visual' ? renderVisualMode() : renderManualMode()}
      </div>
      <Button size='default' onClick={onSubmit}>
        {t('保存分组相关设置')}
      </Button>
      {renderGuide()}
    </Spin>
  );
}
