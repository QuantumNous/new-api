import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  API,
  isMobile,
  showError,
  showInfo,
  showSuccess,
  verifyJSON,
} from '../../helpers';
import { CHANNEL_OPTIONS } from '../../constants';
import {
  SideSheet,
  Space,
  Spin,
  Button,
  Typography,
  Checkbox,
  Banner,
  Modal,
  ImagePreview,
  Card,
  Tag,
  Avatar,
  Form,
  Row,
  Col,
} from '@douyinfe/semi-ui';
import { getChannelModels, copy } from '../../helpers';
import {
  IconSave,
  IconClose,
  IconServer,
  IconSetting,
  IconCode,
  IconGlobe,
} from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const MODEL_MAPPING_EXAMPLE = {
  'gpt-3.5-turbo': 'gpt-3.5-turbo-0125',
};

const STATUS_CODE_MAPPING_EXAMPLE = {
  400: '500',
};

const REGION_EXAMPLE = {
  default: 'us-central1',
  'claude-3-5-sonnet-20240620': 'europe-west1',
};

function type2secretPrompt(type) {
  // inputs.type === 15 ? '按照如下格式输入：APIKey|SecretKey' : (inputs.type === 18 ? '按照如下格式输入：APPID|APISecret|APIKey' : '请输入渠道对应的鉴权密钥')
  switch (type) {
    case 15:
      return '按照如下格式输入：APIKey|SecretKey';
    case 18:
      return '按照如下格式输入：APPID|APISecret|APIKey';
    case 22:
      return '按照如下格式输入：APIKey-AppId，例如：fastgpt-0sp2gtvfdgyi4k30jwlgwf1i-64f335d84283f05518e9e041';
    case 23:
      return '按照如下格式输入：AppId|SecretId|SecretKey';
    case 33:
      return '按照如下格式输入：Ak|Sk|Region';
    case 50:
      return '按照如下格式输入: AccessKey|SecretKey';
    case 51:
      return '按照如下格式输入: Access Key ID|Secret Access Key';
    default:
      return '请输入渠道对应的鉴权密钥';
  }
}

const EditChannel = (props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const channelId = props.editingChannel.id;
  const isEdit = channelId !== undefined;
  const [loading, setLoading] = useState(isEdit);
  const handleCancel = () => {
    props.handleClose();
  };
  const originInputs = {
    name: '',
    type: 1,
    key: '',
    openai_organization: '',
    max_input_tokens: 0,
    base_url: '',
    other: '',
    model_mapping: '',
    status_code_mapping: '',
    models: [],
    auto_ban: 1,
    test_model: '',
    groups: ['default'],
    priority: 0,
    weight: 0,
    tag: '',
  };
  const [batch, setBatch] = useState(false);
  const [autoBan, setAutoBan] = useState(true);
  // const [autoBan, setAutoBan] = useState(true);
  const [inputs, setInputs] = useState(originInputs);
  const [originModelOptions, setOriginModelOptions] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [basicModels, setBasicModels] = useState([]);
  const [fullModels, setFullModels] = useState([]);
  const [customModel, setCustomModel] = useState('');
  const [modalImageUrl, setModalImageUrl] = useState('');
  const [isModalOpenurl, setIsModalOpenurl] = useState(false);
  const formApiRef = useRef(null);
  const getInitValues = () => ({ ...originInputs });
  const handleInputChange = (name, value) => {
    if (formApiRef.current) {
      formApiRef.current.setValue(name, value);
    }
    if (name === 'models' && Array.isArray(value)) {
      value = Array.from(new Set(value.map((m) => (m || '').trim())));
    }

    if (name === 'base_url' && value.endsWith('/v1')) {
      Modal.confirm({
        title: '警告',
        content:
          '不需要在末尾加/v1，New API会自动处理，添加后可能导致请求失败，是否继续？',
        onOk: () => {
          setInputs((inputs) => ({ ...inputs, [name]: value }));
        },
      });
      return;
    }
    setInputs((inputs) => ({ ...inputs, [name]: value }));
    if (name === 'type') {
      let localModels = [];
      switch (value) {
        case 2:
          localModels = [
            'mj_imagine',
            'mj_variation',
            'mj_reroll',
            'mj_blend',
            'mj_upscale',
            'mj_describe',
            'mj_uploads',
          ];
          break;
        case 5:
          localModels = [
            'swap_face',
            'mj_imagine',
            'mj_video',
            'mj_edits',
            'mj_variation',
            'mj_reroll',
            'mj_blend',
            'mj_upscale',
            'mj_describe',
            'mj_zoom',
            'mj_shorten',
            'mj_modal',
            'mj_inpaint',
            'mj_custom_zoom',
            'mj_high_variation',
            'mj_low_variation',
            'mj_pan',
            'mj_uploads',
          ];
          break;
        case 36:
          localModels = ['suno_music', 'suno_lyrics'];
          break;
        default:
          localModels = getChannelModels(value);
          break;
      }
      if (inputs.models.length === 0) {
        setInputs((inputs) => ({ ...inputs, models: localModels }));
      }
      setBasicModels(localModels);
    }
    //setAutoBan
  };

  const loadChannel = async () => {
    setLoading(true);
    let res = await API.get(`/api/channel/${channelId}`);
    if (res === undefined) {
      return;
    }
    const { success, message, data } = res.data;
    if (success) {
      if (data.models === '') {
        data.models = [];
      } else {
        data.models = data.models.split(',');
      }
      if (data.group === '') {
        data.groups = [];
      } else {
        data.groups = data.group.split(',');
      }
      if (data.model_mapping !== '') {
        data.model_mapping = JSON.stringify(
          JSON.parse(data.model_mapping),
          null,
          2,
        );
      }
      setInputs(data);
      if (formApiRef.current) {
        formApiRef.current.setValues(data);
      }
      if (data.auto_ban === 0) {
        setAutoBan(false);
      } else {
        setAutoBan(true);
      }
      setBasicModels(getChannelModels(data.type));
      // console.log(data);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const fetchUpstreamModelList = async (name) => {
    // if (inputs['type'] !== 1) {
    //   showError(t('仅支持 OpenAI 接口格式'));
    //   return;
    // }
    setLoading(true);
    const models = inputs['models'] || [];
    let err = false;

    if (isEdit) {
      // 如果是编辑模式，使用已有的channel id获取模型列表
      const res = await API.get('/api/channel/fetch_models/' + channelId);
      if (res.data && res.data?.success) {
        models.push(...res.data.data);
      } else {
        err = true;
      }
    } else {
      // 如果是新建模式，通过后端代理获取模型列表
      if (!inputs?.['key']) {
        showError(t('请填写密钥'));
        err = true;
      } else {
        try {
          const res = await API.post('/api/channel/fetch_models', {
            base_url: inputs['base_url'],
            type: inputs['type'],
            key: inputs['key'],
          });

          if (res.data && res.data.success) {
            models.push(...res.data.data);
          } else {
            err = true;
          }
        } catch (error) {
          console.error('Error fetching models:', error);
          err = true;
        }
      }
    }

    if (!err) {
      handleInputChange(name, Array.from(new Set(models)));
      showSuccess(t('获取模型列表成功'));
    } else {
      showError(t('获取模型列表失败'));
    }
    setLoading(false);
  };

  const fetchModels = async () => {
    try {
      let res = await API.get(`/api/channel/models`);
      const localModelOptions = res.data.data.map((model) => {
        const id = (model.id || '').trim();
        return {
          key: id,
          label: id,
          value: id,
        };
      });
      setOriginModelOptions(localModelOptions);
      setFullModels(res.data.data.map((model) => model.id));
      setBasicModels(
        res.data.data
          .filter((model) => {
            return model.id.startsWith('gpt-') || model.id.startsWith('text-');
          })
          .map((model) => model.id),
      );
    } catch (error) {
      showError(error.message);
    }
  };

  const fetchGroups = async () => {
    try {
      let res = await API.get(`/api/group/`);
      if (res === undefined) {
        return;
      }
      setGroupOptions(
        res.data.data.map((group) => ({
          label: group,
          value: group,
        })),
      );
    } catch (error) {
      showError(error.message);
    }
  };

  useEffect(() => {
    const modelMap = new Map();

    originModelOptions.forEach(option => {
      const v = (option.value || '').trim();
      if (!modelMap.has(v)) {
        modelMap.set(v, option);
      }
    });

    inputs.models.forEach(model => {
      const v = (model || '').trim();
      if (!modelMap.has(v)) {
        modelMap.set(v, {
          key: v,
          label: v,
          value: v,
        });
      }
    });

    setModelOptions(Array.from(modelMap.values()));
  }, [originModelOptions, inputs.models]);

  useEffect(() => {
    fetchModels().then();
    fetchGroups().then();
    if (!isEdit) {
      setInputs(originInputs);
      if (formApiRef.current) {
        formApiRef.current.setValues(originInputs);
      }
      let localModels = getChannelModels(inputs.type);
      setBasicModels(localModels);
      setInputs((inputs) => ({ ...inputs, models: localModels }));
    }
  }, [props.editingChannel.id]);

  useEffect(() => {
    if (formApiRef.current) {
      formApiRef.current.setValues(inputs);
    }
  }, [inputs]);

  useEffect(() => {
    if (props.visible) {
      if (isEdit) {
        loadChannel();
      } else {
        formApiRef.current?.setValues(getInitValues());
      }
    } else {
      formApiRef.current?.reset();
    }
  }, [props.visible, channelId]);

  const submit = async () => {
    const formValues = formApiRef.current ? formApiRef.current.getValues() : {};
    let localInputs = { ...formValues };

    if (!isEdit && (!localInputs.name || !localInputs.key)) {
      showInfo(t('请填写渠道名称和渠道密钥！'));
      return;
    }
    if (!Array.isArray(localInputs.models) || localInputs.models.length === 0) {
      showInfo(t('请至少选择一个模型！'));
      return;
    }
    if (localInputs.model_mapping && localInputs.model_mapping !== '' && !verifyJSON(localInputs.model_mapping)) {
      showInfo(t('模型映射必须是合法的 JSON 格式！'));
      return;
    }
    if (localInputs.base_url && localInputs.base_url.endsWith('/')) {
      localInputs.base_url = localInputs.base_url.slice(
        0,
        localInputs.base_url.length - 1,
      );
    }
    if (localInputs.type === 18 && localInputs.other === '') {
      localInputs.other = 'v2.1';
    }
    let res;
    localInputs.auto_ban = localInputs.auto_ban ? 1 : 0;
    localInputs.models = localInputs.models.join(',');
    localInputs.group = (localInputs.groups || []).join(',');
    if (isEdit) {
      res = await API.put(`/api/channel/`, {
        ...localInputs,
        id: parseInt(channelId),
      });
    } else {
      res = await API.post(`/api/channel/`, localInputs);
    }
    const { success, message } = res.data;
    if (success) {
      if (isEdit) {
        showSuccess(t('渠道更新成功！'));
      } else {
        showSuccess(t('渠道创建成功！'));
        setInputs(originInputs);
      }
      props.refresh();
      props.handleClose();
    } else {
      showError(message);
    }
  };

  const addCustomModels = () => {
    if (customModel.trim() === '') return;
    const modelArray = customModel.split(',').map((model) => model.trim());

    let localModels = [...inputs.models];
    let localModelOptions = [...modelOptions];
    const addedModels = [];

    modelArray.forEach((model) => {
      if (model && !localModels.includes(model)) {
        localModels.push(model);
        localModelOptions.push({
          key: model,
          label: model,
          value: model,
        });
        addedModels.push(model);
      }
    });

    setModelOptions(localModelOptions);
    setCustomModel('');
    handleInputChange('models', localModels);

    if (addedModels.length > 0) {
      showSuccess(
        t('已新增 {{count}} 个模型：{{list}}', {
          count: addedModels.length,
          list: addedModels.join(', '),
        })
      );
    } else {
      showInfo(t('未发现新增模型'));
    }
  };

  const batchAllowed = !isEdit && inputs.type !== 41;
  const batchExtra = batchAllowed ? (
    <Checkbox checked={batch} onChange={() => setBatch(!batch)}>{t('批量创建')}</Checkbox>
  ) : null;

  return (
    <>
      <SideSheet
        placement={isEdit ? 'right' : 'left'}
        title={
          <Space>
            <Tag color="blue" shape="circle">{isEdit ? t('编辑') : t('新建')}</Tag>
            <Title heading={4} className="m-0">
              {isEdit ? t('更新渠道信息') : t('创建新的渠道')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: '0' }}
        visible={props.visible}
        width={isMobile() ? '100%' : 600}
        footer={
          <div className="flex justify-end bg-white">
            <Space>
              <Button
                theme="solid"
                onClick={() => formApiRef.current?.submitForm()}
                icon={<IconSave />}
              >
                {t('提交')}
              </Button>
              <Button
                theme="light"
                type="primary"
                onClick={handleCancel}
                icon={<IconClose />}
              >
                {t('取消')}
              </Button>
            </Space>
          </div>
        }
        closeIcon={null}
        onCancel={() => handleCancel()}
      >
        <Form
          key={isEdit ? 'edit' : 'new'}
          initValues={originInputs}
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={submit}
        >
          {() => (
            <Spin spinning={loading}>
              <div className="p-2">
                <Card className="!rounded-2xl shadow-sm border-0 mb-6">
                  {/* Header: Basic Info */}
                  <div className="flex items-center mb-2">
                    <Avatar size="small" color="blue" className="mr-2 shadow-md">
                      <IconServer size={16} />
                    </Avatar>
                    <div>
                      <Text className="text-lg font-medium">{t('基本信息')}</Text>
                      <div className="text-xs text-gray-600">{t('渠道的基本配置信息')}</div>
                    </div>
                  </div>

                  <Form.Select
                    field='type'
                    label={t('类型')}
                    placeholder={t('请选择渠道类型')}
                    rules={[{ required: true, message: t('请选择渠道类型') }]}
                    optionList={CHANNEL_OPTIONS}
                    style={{ width: '100%' }}
                    filter
                    searchPosition='dropdown'
                    onChange={(value) => handleInputChange('type', value)}
                  />

                  <Form.Input
                    field='name'
                    label={t('名称')}
                    placeholder={t('请为渠道命名')}
                    rules={[{ required: true, message: t('请为渠道命名') }]}
                    showClear
                    onChange={(value) => handleInputChange('name', value)}
                    autoComplete='new-password'
                  />

                  {batch ? (
                    <Form.TextArea
                      field='key'
                      label={t('密钥')}
                      placeholder={t('请输入密钥，一行一个')}
                      rules={isEdit ? [] : [{ required: true, message: t('请输入密钥') }]}
                      autosize={{ minRows: 6, maxRows: 6 }}
                      autoComplete='new-password'
                      onChange={(value) => handleInputChange('key', value)}
                      extraText={batchExtra}
                    />
                  ) : (
                    <>
                      {inputs.type === 41 ? (
                        <Form.TextArea
                          field='key'
                          label={t('密钥')}
                          placeholder={
                            '{\n' +
                            '  "type": "service_account",\n' +
                            '  "project_id": "abc-bcd-123-456",\n' +
                            '  "private_key_id": "123xxxxx456",\n' +
                            '  "private_key": "-----BEGIN PRIVATE KEY-----xxxx\n' +
                            '  "client_email": "xxx@developer.gserviceaccount.com",\n' +
                            '  "client_id": "111222333",\n' +
                            '  "auth_uri": "https://accounts.google.com/o/oauth2/auth",\n' +
                            '  "token_uri": "https://oauth2.googleapis.com/token",\n' +
                            '  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",\n' +
                            '  "client_x509_cert_url": "https://xxxxx.gserviceaccount.com",\n' +
                            '  "universe_domain": "googleapis.com"\n' +
                            '}'
                          }
                          rules={isEdit ? [] : [{ required: true, message: t('请输入密钥') }]}
                          autosize={{ minRows: 10 }}
                          autoComplete='new-password'
                          onChange={(value) => handleInputChange('key', value)}
                          extraText={batchExtra}
                        />
                      ) : (
                        <Form.Input
                          field='key'
                          label={t('密钥')}
                          placeholder={t(type2secretPrompt(inputs.type))}
                          rules={isEdit ? [] : [{ required: true, message: t('请输入密钥') }]}
                          autoComplete='new-password'
                          onChange={(value) => handleInputChange('key', value)}
                          extraText={batchExtra}
                        />
                      )}
                    </>
                  )}
                </Card>

                {/* API Configuration Card */}
                <Card className="!rounded-2xl shadow-sm border-0 mb-6">
                  {/* Header: API Config */}
                  <div className="flex items-center mb-2">
                    <Avatar size="small" color="green" className="mr-2 shadow-md">
                      <IconGlobe size={16} />
                    </Avatar>
                    <div>
                      <Text className="text-lg font-medium">{t('API 配置')}</Text>
                      <div className="text-xs text-gray-600">{t('API 地址和相关配置')}</div>
                    </div>
                  </div>

                  {inputs.type === 40 && (
                    <Banner
                      type='info'
                      description={
                        <div>
                          <Text strong>{t('邀请链接')}:</Text>
                          <Text
                            link
                            underline
                            className="ml-2 cursor-pointer"
                            onClick={() => window.open('https://cloud.siliconflow.cn/i/hij0YNTZ')}
                          >
                            https://cloud.siliconflow.cn/i/hij0YNTZ
                          </Text>
                        </div>
                      }
                      className='!rounded-lg'
                    />
                  )}

                  {inputs.type === 3 && (
                    <>
                      <Banner
                        type='warning'
                        description={t('2025年5月10日后添加的渠道，不需要再在部署的时候移除模型名称中的"."')}
                        className='!rounded-lg'
                      />
                      <div>
                        <Form.Input
                          field='base_url'
                          label='AZURE_OPENAI_ENDPOINT'
                          placeholder={t('请输入 AZURE_OPENAI_ENDPOINT，例如：https://docs-test-001.openai.azure.com')}
                          onChange={(value) => handleInputChange('base_url', value)}
                          showClear
                        />
                      </div>
                      <div>
                        <Form.Input
                          field='other'
                          label={t('默认 API 版本')}
                          placeholder={t('请输入默认 API 版本，例如：2025-04-01-preview')}
                          onChange={(value) => handleInputChange('other', value)}
                          showClear
                        />
                      </div>
                    </>
                  )}

                  {inputs.type === 8 && (
                    <>
                      <Banner
                        type='warning'
                        description={t('如果你对接的是上游One API或者New API等转发项目，请使用OpenAI类型，不要使用此类型，除非你知道你在做什么。')}
                        className='!rounded-lg'
                      />
                      <div>
                        <Form.Input
                          field='base_url'
                          label={t('完整的 Base URL，支持变量{model}')}
                          placeholder={t('请输入完整的URL，例如：https://api.openai.com/v1/chat/completions')}
                          onChange={(value) => handleInputChange('base_url', value)}
                          showClear
                        />
                      </div>
                    </>
                  )}

                  {inputs.type === 37 && (
                    <Banner
                      type='warning'
                      description={t('Dify渠道只适配chatflow和agent，并且agent不支持图片！')}
                      className='!rounded-lg'
                    />
                  )}

                  {inputs.type !== 3 && inputs.type !== 8 && inputs.type !== 22 && inputs.type !== 36 && inputs.type !== 45 && (
                    <div>
                      <Form.Input
                        field='base_url'
                        label={t('API地址')}
                        placeholder={t('此项可选，用于通过自定义API地址来进行 API 调用，末尾不要带/v1和/')}
                        onChange={(value) => handleInputChange('base_url', value)}
                        showClear
                        extraText={t('对于官方渠道，new-api已经内置地址，除非是第三方代理站点或者Azure的特殊接入地址，否则不需要填写')}
                      />
                    </div>
                  )}

                  {inputs.type === 22 && (
                    <div>
                      <Form.Input
                        field='base_url'
                        label={t('私有部署地址')}
                        placeholder={t('请输入私有部署地址，格式为：https://fastgpt.run/api/openapi')}
                        onChange={(value) => handleInputChange('base_url', value)}
                        showClear
                      />
                    </div>
                  )}

                  {inputs.type === 36 && (
                    <div>
                      <Form.Input
                        field='base_url'
                        label={t('注意非Chat API，请务必填写正确的API地址，否则可能导致无法使用')}
                        placeholder={t('请输入到 /suno 前的路径，通常就是域名，例如：https://api.example.com')}
                        onChange={(value) => handleInputChange('base_url', value)}
                        showClear
                      />
                    </div>
                  )}

                  {inputs.type === 52 && (
                      <>
                        <div>
                          <Form.Input
                              field='base_url'
                              label={t('完整的 Base URL')}
                              placeholder={t('请输入完整的URL，例如：https://api.openai.com/v1')}
                              onChange={(value) => handleInputChange('base_url', value)}
                              showClear
                          />
                        </div>
                      </>
                  )}
                </Card>

                {/* Model Configuration Card */}
                <Card className="!rounded-2xl shadow-sm border-0 mb-6">
                  {/* Header: Model Config */}
                  <div className="flex items-center mb-2">
                    <Avatar size="small" color="purple" className="mr-2 shadow-md">
                      <IconCode size={16} />
                    </Avatar>
                    <div>
                      <Text className="text-lg font-medium">{t('模型配置')}</Text>
                      <div className="text-xs text-gray-600">{t('模型选择和映射设置')}</div>
                    </div>
                  </div>

                  <Form.Select
                    field='models'
                    label={t('模型')}
                    placeholder={isEdit ? t('请选择该渠道所支持的模型') : t('创建后可在编辑渠道时获取上游模型列表')}
                    rules={[{ required: true, message: t('请选择模型') }]}
                    multiple
                    filter
                    searchPosition='dropdown'
                    optionList={modelOptions}
                    style={{ width: '100%' }}
                    onChange={(value) => handleInputChange('models', value)}
                    extraText={(
                      <Space wrap>
                        <Button size='small' type='primary' onClick={() => handleInputChange('models', basicModels)}>
                          {t('填入相关模型')}
                        </Button>
                        <Button size='small' type='secondary' onClick={() => handleInputChange('models', fullModels)}>
                          {t('填入所有模型')}
                        </Button>
                        {isEdit && (
                          <Button size='small' type='tertiary' onClick={() => fetchUpstreamModelList('models')}>
                            {t('获取模型列表')}
                          </Button>
                        )}
                        <Button size='small' type='warning' onClick={() => handleInputChange('models', [])}>
                          {t('清除所有模型')}
                        </Button>
                        <Button
                          size='small'
                          type='tertiary'
                          onClick={() => {
                            if (inputs.models.length === 0) {
                              showInfo(t('没有模型可以复制'));
                              return;
                            }
                            try {
                              copy(inputs.models.join(','));
                              showSuccess(t('模型列表已复制到剪贴板'));
                            } catch (error) {
                              showError(t('复制失败'));
                            }
                          }}
                        >
                          {t('复制所有模型')}
                        </Button>
                      </Space>
                    )}
                  />

                  <Form.Input
                    field='custom_model'
                    label={t('自定义模型名称')}
                    placeholder={t('输入自定义模型名称')}
                    onChange={(value) => setCustomModel(value.trim())}
                    value={customModel}
                    suffix={
                      <Button size='small' type='primary' onClick={addCustomModels}>
                        {t('填入')}
                      </Button>
                    }
                  />

                  <Form.Input
                    field='test_model'
                    label={t('默认测试模型')}
                    placeholder={t('不填则为模型列表第一个')}
                    onChange={(value) => handleInputChange('test_model', value)}
                    showClear
                  />

                  <Form.TextArea
                    field='model_mapping'
                    label={t('模型重定向')}
                    placeholder={
                      t('此项可选，用于修改请求体中的模型名称，为一个 JSON 字符串，键为请求中模型名称，值为要替换的模型名称，例如：') +
                      `\n${JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2)}`
                    }
                    autosize
                    onChange={(value) => handleInputChange('model_mapping', value)}
                    extraText={
                      <Text
                        className="!text-semi-color-primary cursor-pointer"
                        onClick={() => handleInputChange('model_mapping', JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2))}
                      >
                        {t('填入模板')}
                      </Text>
                    }
                    showClear
                  />
                </Card>

                {/* Advanced Settings Card */}
                <Card className="!rounded-2xl shadow-sm border-0 mb-6">
                  {/* Header: Advanced Settings */}
                  <div className="flex items-center mb-2">
                    <Avatar size="small" color="orange" className="mr-2 shadow-md">
                      <IconSetting size={16} />
                    </Avatar>
                    <div>
                      <Text className="text-lg font-medium">{t('高级设置')}</Text>
                      <div className="text-xs text-gray-600">{t('渠道的高级配置选项')}</div>
                    </div>
                  </div>

                  <Form.Select
                    field='groups'
                    label={t('分组')}
                    placeholder={t('请选择可以使用该渠道的分组')}
                    multiple
                    allowAdditions
                    additionLabel={t('请在系统设置页面编辑分组倍率以添加新的分组：')}
                    optionList={groupOptions}
                    style={{ width: '100%' }}
                    onChange={(value) => handleInputChange('groups', value)}
                  />

                  {inputs.type === 18 && (
                    <Form.Input
                      field='other'
                      label={t('模型版本')}
                      placeholder={'请输入星火大模型版本，注意是接口地址中的版本号，例如：v2.1'}
                      onChange={(value) => handleInputChange('other', value)}
                      showClear
                    />
                  )}

                  {inputs.type === 41 && (
                    <Form.TextArea
                      field='other'
                      label={t('部署地区')}
                      placeholder={t(
                        '请输入部署地区，例如：us-central1\n支持使用模型映射格式\n{\n    "default": "us-central1",\n    "claude-3-5-sonnet-20240620": "europe-west1"\n}'
                      )}
                      autosize={{ minRows: 2 }}
                      onChange={(value) => handleInputChange('other', value)}
                      extraText={
                        <Text
                          className="!text-semi-color-primary cursor-pointer"
                          onClick={() => handleInputChange('other', JSON.stringify(REGION_EXAMPLE, null, 2))}
                        >
                          {t('填入模板')}
                        </Text>
                      }
                    />
                  )}

                  {inputs.type === 21 && (
                    <Form.Input
                      field='other'
                      label={t('知识库 ID')}
                      placeholder={'请输入知识库 ID，例如：123456'}
                      onChange={(value) => handleInputChange('other', value)}
                      showClear
                    />
                  )}

                  {inputs.type === 39 && (
                    <Form.Input
                      field='other'
                      label='Account ID'
                      placeholder={'请输入Account ID，例如：d6b5da8hk1awo8nap34ube6gh'}
                      onChange={(value) => handleInputChange('other', value)}
                      showClear
                    />
                  )}

                  {inputs.type === 49 && (
                    <Form.Input
                      field='other'
                      label={t('智能体ID')}
                      placeholder={'请输入智能体ID，例如：7342866812345'}
                      onChange={(value) => handleInputChange('other', value)}
                      showClear
                    />
                  )}

                  {inputs.type === 1 && (
                    <Form.Input
                      field='openai_organization'
                      label={t('组织')}
                      placeholder={t('请输入组织org-xxx')}
                      showClear
                      helpText={t('组织，可选，不填则为默认组织')}
                      onChange={(value) => handleInputChange('openai_organization', value)}
                    />
                  )}

                  <Form.Input
                    field='tag'
                    label={t('渠道标签')}
                    placeholder={t('渠道标签')}
                    showClear
                    onChange={(value) => handleInputChange('tag', value)}
                  />

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.InputNumber
                        field='priority'
                        label={t('渠道优先级')}
                        placeholder={t('渠道优先级')}
                        min={0}
                        onNumberChange={(value) => handleInputChange('priority', value)}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={12}>
                      <Form.InputNumber
                        field='weight'
                        label={t('渠道权重')}
                        placeholder={t('渠道权重')}
                        min={0}
                        onNumberChange={(value) => handleInputChange('weight', value)}
                        style={{ width: '100%' }}
                      />
                    </Col>
                  </Row>

                  <Form.Switch
                    field='auto_ban'
                    label={t('是否自动禁用')}
                    checkedText={t('开')}
                    uncheckedText={t('关')}
                    onChange={(val) => setAutoBan(val)}
                    extraText={t('仅当自动禁用开启时有效，关闭后不会自动禁用该渠道')}
                    initValue={autoBan}
                  />

                  <Form.TextArea
                    field='param_override'
                    label={t('参数覆盖')}
                    placeholder={
                      t('此项可选，用于覆盖请求参数。不支持覆盖 stream 参数。为一个 JSON 字符串，例如：') +
                      '\n{\n  "temperature": 0\n}'
                    }
                    autosize
                    onChange={(value) => handleInputChange('param_override', value)}
                    extraText={
                      <Text
                        className="!text-semi-color-primary cursor-pointer"
                        onClick={() => handleInputChange('param_override', JSON.stringify({ temperature: 0 }, null, 2))}
                      >
                        {t('填入模板')}
                      </Text>
                    }
                    showClear
                  />

                  <Form.TextArea
                    field='status_code_mapping'
                    label={t('状态码复写')}
                    placeholder={
                      t('此项可选，用于复写返回的状态码，仅影响本地判断，不修改返回到上游的状态码，比如将claude渠道的400错误复写为500（用于重试），请勿滥用该功能，例如：') +
                      '\n' +
                      JSON.stringify(STATUS_CODE_MAPPING_EXAMPLE, null, 2)
                    }
                    autosize
                    onChange={(value) => handleInputChange('status_code_mapping', value)}
                    extraText={
                      <Text
                        className="!text-semi-color-primary cursor-pointer"
                        onClick={() => handleInputChange('status_code_mapping', JSON.stringify(STATUS_CODE_MAPPING_EXAMPLE, null, 2))}
                      >
                        {t('填入模板')}
                      </Text>
                    }
                    showClear
                  />

                  <Form.TextArea
                    field='setting'
                    label={t('渠道额外设置')}
                    placeholder={
                      t('此项可选，用于配置渠道特定设置，为一个 JSON 字符串，例如：') +
                      '\n{\n  "force_format": true\n}'
                    }
                    autosize
                    onChange={(value) => handleInputChange('setting', value)}
                    extraText={(
                      <Space wrap>
                        <Text
                          className="!text-semi-color-primary cursor-pointer"
                          onClick={() => handleInputChange('setting', JSON.stringify({ force_format: true }, null, 2))}
                        >
                          {t('填入模板')}
                        </Text>
                        <Text
                          className="!text-semi-color-primary cursor-pointer"
                          onClick={() => window.open('https://github.com/QuantumNous/new-api/blob/main/docs/channel/other_setting.md')}
                        >
                          {t('设置说明')}
                        </Text>
                      </Space>
                    )}
                    showClear
                  />
                </Card>
              </div>
            </Spin>
          )}
        </Form>
        <ImagePreview
          src={modalImageUrl}
          visible={isModalOpenurl}
          onVisibleChange={(visible) => setIsModalOpenurl(visible)}
        />
      </SideSheet>
    </>
  );
};

export default EditChannel;
