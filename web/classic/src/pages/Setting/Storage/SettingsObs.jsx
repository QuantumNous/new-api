import React, { useEffect, useState, useRef } from 'react';
import { Banner, Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

// 系统设置 → 媒体存储(OBS)。字段与后端 setting/system_setting/media_storage.go
// 的 json tag 一一对应，key 前缀 media_storage.。AK/SK 经 GET 过滤不回显，
// 表单留空表示「保持不变」；启用总开关时后端会跑一次连通性校验。
const ENABLED_KEY = 'media_storage.enabled';
const SECRET_KEYS = [
  'media_storage.access_key_id',
  'media_storage.secret_access_key',
];

export default function SettingsObs(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'media_storage.enabled': false,
    'media_storage.provider': 'obs',
    'media_storage.credential_type': 'static',
    'media_storage.endpoint': '',
    'media_storage.region': '',
    'media_storage.bucket': '',
    'media_storage.access_key_id': '',
    'media_storage.secret_access_key': '',
    'media_storage.signed_url_ttl_hours': 168,
    'media_storage.max_object_size_mb': 200,
    'media_storage.nfs_output_root': '/nfs-output',
    'media_storage.ingest_nfs_path': true,
    'media_storage.ingest_upstream_url': true,
    'media_storage.upstream_url_allowed_hosts': '',
    'media_storage.async_worker_count': 4,
    'media_storage.stats_snapshot_interval_minutes': 60,
    'media_storage.bucket_warn_threshold_tb': 2,
    'media_storage.bucket_critical_threshold_tb': 3,
    'media_storage.alert_webhook': '',
    'media_storage.alert_dedup_hours': 24,
  });
  const [inputsRow, setInputsRow] = useState(inputs);
  const refForm = useRef();

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((prev) => ({ ...prev, [fieldName]: value }));
    };
  }

  async function putOption(key, value) {
    const res = await API.put('/api/option/', { key, value: String(value) });
    return res;
  }

  async function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));

    // 启用开关放到最后应用：后端在此时用「已保存的完整配置」跑连通性校验。
    const others = updateArray.filter((i) => i.key !== ENABLED_KEY);
    const enabledItem = updateArray.find((i) => i.key === ENABLED_KEY);

    setLoading(true);
    try {
      for (const item of others) {
        // 未修改的 AK/SK 保持为空字符串，compareObjects 不会纳入，无需担心误清空。
        const res = await putOption(item.key, inputs[item.key]);
        if (!res?.data?.success) {
          showError(res?.data?.message || t('保存失败，请重试'));
          props.refresh();
          return;
        }
      }
      if (enabledItem) {
        const res = await putOption(ENABLED_KEY, inputs[ENABLED_KEY]);
        if (!res?.data?.success) {
          // 典型场景：启用时 OBS 连通性校验失败，后端返回具体原因。
          showError(res?.data?.message || t('启用失败'));
          props.refresh();
          return;
        }
      }
      showSuccess(t('保存成功'));
      props.refresh();
    } catch (e) {
      showError(t('保存失败，请重试'));
      props.refresh();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        if (typeof inputs[key] === 'boolean') {
          currentInputs[key] =
            props.options[key] === 'true' || props.options[key] === true;
        } else if (typeof inputs[key] === 'number') {
          const n = parseFloat(props.options[key]);
          currentInputs[key] = isNaN(n) ? inputs[key] : n;
        } else {
          currentInputs[key] = props.options[key];
        }
      }
    }
    // AK/SK 后端不回显，始终以空串加载（留空=不修改）。
    for (const k of SECRET_KEYS) currentInputs[k] = '';
    const merged = { ...inputs, ...currentInputs };
    setInputs(merged);
    setInputsRow(merged);
    if (refForm.current) {
      refForm.current.setValues(merged);
    }
  }, [props.options]);

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section text={t('基础')}>
          <Banner
            type='info'
            description={t(
              '开启后，所有生成的图片/视频（自建模型经 GPUStack 返回的 nfs_path、第三方渠道的上游 URL）会统一落盘到 OBS，对外只返回带签名的 OBS URL（默认 7 天有效）。启用时后端会用当前已保存的 Endpoint / Bucket / AK/SK 跑一次连通性校验（PutObject + DeleteObject），失败则拒绝启用。请先填好下面各项并保存，再打开此开关。',
            )}
            style={{ marginBottom: 16 }}
          />
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Switch
                field={ENABLED_KEY}
                label={t('启用媒体存储')}
                extraText={t('总开关；关闭时回退为透传原始 URL / nfs_path')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                onChange={handleFieldChange(ENABLED_KEY)}
              />
            </Col>
          </Row>
        </Form.Section>

        <Form.Section text={t('连接配置')}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Select
                field={'media_storage.provider'}
                label={t('存储提供商')}
                style={{ width: '100%' }}
                optionList={[{ label: 'OBS', value: 'obs' }]}
                onChange={handleFieldChange('media_storage.provider')}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Select
                field={'media_storage.credential_type'}
                label={t('凭证类型')}
                style={{ width: '100%' }}
                optionList={[
                  { label: t('永久 AK/SK (static)'), value: 'static' },
                  { label: t('临时凭证 (sts)'), value: 'sts' },
                ]}
                onChange={handleFieldChange('media_storage.credential_type')}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Input
                field={'media_storage.bucket'}
                label={t('桶名 Bucket')}
                placeholder={'prod-newapi-media-cn-central-221'}
                onChange={handleFieldChange('media_storage.bucket')}
                showClear
              />
            </Col>
            <Col xs={24} sm={12} md={12}>
              <Form.Input
                field={'media_storage.endpoint'}
                label={t('Endpoint')}
                placeholder={'https://obs.cn-central-221.ovaijisuan.com'}
                onChange={handleFieldChange('media_storage.endpoint')}
                showClear
              />
            </Col>
            <Col xs={24} sm={12} md={12}>
              <Form.Input
                field={'media_storage.region'}
                label={t('Region')}
                placeholder={'cn-central-221'}
                onChange={handleFieldChange('media_storage.region')}
                showClear
              />
            </Col>
          </Row>
        </Form.Section>

        <Form.Section text={t('凭证（AK/SK）')}>
          <Banner
            type='warning'
            description={t(
              'AK/SK 加密后入库，保存后不回显。留空表示保持现有值不变；也可改用环境变量 OBS_AK / OBS_SK（优先级更高，且不入库）。',
            )}
            style={{ marginBottom: 16 }}
          />
          <Row gutter={16}>
            <Col xs={24} sm={12} md={12}>
              <Form.Input
                field={'media_storage.access_key_id'}
                label={t('AccessKeyID')}
                mode='password'
                placeholder={t('留空表示不修改')}
                onChange={handleFieldChange('media_storage.access_key_id')}
                showClear
              />
            </Col>
            <Col xs={24} sm={12} md={12}>
              <Form.Input
                field={'media_storage.secret_access_key'}
                label={t('SecretAccessKey')}
                mode='password'
                placeholder={t('留空表示不修改')}
                onChange={handleFieldChange('media_storage.secret_access_key')}
                showClear
              />
            </Col>
          </Row>
        </Form.Section>

        <Form.Section text={t('落盘策略')}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.InputNumber
                field={'media_storage.signed_url_ttl_hours'}
                label={t('签名 URL 有效期 (小时)')}
                extraText={t(
                  '图片=视频统一，默认 168 (7 天)，不应超过对象寿命 7 天',
                )}
                min={1}
                max={168}
                onChange={handleFieldChange(
                  'media_storage.signed_url_ttl_hours',
                )}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.InputNumber
                field={'media_storage.max_object_size_mb'}
                label={t('单文件上限 (MB)')}
                extraText={t('超过直接拒绝落盘')}
                min={1}
                onChange={handleFieldChange('media_storage.max_object_size_mb')}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.InputNumber
                field={'media_storage.async_worker_count'}
                label={t('异步 worker 数')}
                min={1}
                onChange={handleFieldChange('media_storage.async_worker_count')}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Input
                field={'media_storage.nfs_output_root'}
                label={t('NFS 挂载根')}
                extraText={t('容器内 SFS 只读挂载点，只搬此前缀下的文件')}
                placeholder={'/nfs-output'}
                onChange={handleFieldChange('media_storage.nfs_output_root')}
                showClear
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Switch
                field={'media_storage.ingest_nfs_path'}
                label={t('nfs_path 落盘')}
                extraText={t('自建模型返回 nfs_path 时搬 OBS')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                onChange={handleFieldChange('media_storage.ingest_nfs_path')}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Switch
                field={'media_storage.ingest_upstream_url'}
                label={t('上游 URL 落盘')}
                extraText={t('第三方渠道上游 URL 搬 OBS')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                onChange={handleFieldChange(
                  'media_storage.ingest_upstream_url',
                )}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Input
                field={'media_storage.upstream_url_allowed_hosts'}
                label={t('上游 URL host 白名单')}
                extraText={t(
                  '逗号分隔，支持子域（填 example.com 放行 cdn.example.com）；留空不限 host，仅做私网过滤',
                )}
                placeholder={'oaidalleapiprodscus.blob.core.windows.net'}
                onChange={handleFieldChange(
                  'media_storage.upstream_url_allowed_hosts',
                )}
                showClear
              />
            </Col>
          </Row>
          <Banner
            type='info'
            description={t(
              'OBS 生命周期保留期固定为 7 天（由运维在 HCSO 控制台配置），此处不可改。',
            )}
            style={{ marginTop: 8 }}
          />
        </Form.Section>

        <Form.Section text={t('桶用量监控与告警')}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.InputNumber
                field={'media_storage.bucket_warn_threshold_tb'}
                label={t('warn 阈值 (TB)')}
                extraText={t('首次跨越推送 webhook 提醒')}
                min={0}
                step={0.5}
                onChange={handleFieldChange(
                  'media_storage.bucket_warn_threshold_tb',
                )}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.InputNumber
                field={'media_storage.bucket_critical_threshold_tb'}
                label={t('critical 阈值 (TB)')}
                extraText={t('紧急处置阈值')}
                min={0}
                step={0.5}
                onChange={handleFieldChange(
                  'media_storage.bucket_critical_threshold_tb',
                )}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.InputNumber
                field={'media_storage.stats_snapshot_interval_minutes'}
                label={t('用量快照间隔 (分钟)')}
                min={1}
                onChange={handleFieldChange(
                  'media_storage.stats_snapshot_interval_minutes',
                )}
              />
            </Col>
            <Col xs={24} sm={12} md={16}>
              <Form.Input
                field={'media_storage.alert_webhook'}
                label={t('告警 Webhook')}
                placeholder={'https://qyapi.weixin.qq.com/cgi-bin/webhook/...'}
                extraText={t('飞书/钉钉/企微机器人地址')}
                onChange={handleFieldChange('media_storage.alert_webhook')}
                showClear
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.InputNumber
                field={'media_storage.alert_dedup_hours'}
                label={t('告警去重窗口 (小时)')}
                min={1}
                onChange={handleFieldChange('media_storage.alert_dedup_hours')}
              />
            </Col>
          </Row>
        </Form.Section>

        <Row>
          <Button size='default' onClick={onSubmit}>
            {t('保存媒体存储设置')}
          </Button>
        </Row>
      </Form>
    </Spin>
  );
}
