import React, { useEffect, useState } from 'react';
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
  Input,
  Typography,
  Select,
  TextArea,
  Checkbox,
  Banner,
  Modal,
  ImagePreview,
  Card,
  Tag,
  Avatar,
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
  const handleInputChange = (name, value) => {
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
    if (isEdit) {
      loadChannel().then(() => { });
    } else {
      setInputs(originInputs);
      let localModels = getChannelModels(inputs.type);
      setBasicModels(localModels);
      setInputs((inputs) => ({ ...inputs, models: localModels }));
    }
  }, [props.editingChannel.id]);

  const submit = async () => {
    if (!isEdit && (inputs.name === '' || inputs.key === '')) {
      showInfo(t('请填写渠道名称和渠道密钥！'));
      return;
    }
    if (inputs.models.length === 0) {
      showInfo(t('请至少选择一个模型！'));
      return;
    }
    if (inputs.model_mapping !== '' && !verifyJSON(inputs.model_mapping)) {
      showInfo(t('模型映射必须是合法的 JSON 格式！'));
      return;
    }
    let localInputs = { ...inputs };
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
    if (!Array.isArray(localInputs.models)) {
      showError(t('提交失败，请勿重复提交！'));
      handleCancel();
      return;
    }
    localInputs.auto_ban = autoBan ? 1 : 0;
    localInputs.models = localInputs.models.join(',');
    localInputs.group = localInputs.groups.join(',');
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
                onClick={submit}
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

              <div className="space-y-4">
                <div>
                  <Text strong className="block mb-2">{t('类型')}</Text>
                  <Select
                    name='type'
                    required
                    optionList={CHANNEL_OPTIONS}
                    value={inputs.type}
                    onChange={(value) => handleInputChange('type', value)}
                    style={{ width: '100%' }}
                    filter
                    searchPosition='dropdown'
                    placeholder={t('请选择渠道类型')}
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('名称')}</Text>
                  <Input
                    required
                    name='name'
                    placeholder={t('请为渠道命名')}
                    onChange={(value) => {
                      handleInputChange('name', value);
                    }}
                    value={inputs.name}
                    autoComplete='new-password'
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('密钥')}</Text>
                  {batch ? (
                    <TextArea
                      name='key'
                      required
                      placeholder={t('请输入密钥，一行一个')}
                      onChange={(value) => {
                        handleInputChange('key', value);
                      }}
                      value={inputs.key}
                      autosize={{ minRows: 6, maxRows: 6 }}
                      autoComplete='new-password'
                    />
                  ) : (
                    <>
                      {inputs.type === 41 ? (
                        <TextArea
                          name='key'
                          required
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
                          onChange={(value) => {
                            handleInputChange('key', value);
                          }}
                          autosize={{ minRows: 10 }}
                          value={inputs.key}
                          autoComplete='new-password'
                        />
                      ) : (
                        <Input
                          name='key'
                          required
                          placeholder={t(type2secretPrompt(inputs.type))}
                          onChange={(value) => {
                            handleInputChange('key', value);
                          }}
                          value={inputs.key}
                          autoComplete='new-password'
                        />
                      )}
                    </>
                  )}
                </div>

                {!isEdit && (
                  <div className="flex items-center">
                    <Checkbox
                      checked={batch}
                      onChange={() => setBatch(!batch)}
                    />
                    <Text strong className="ml-2">{t('批量创建')}</Text>
                  </div>
                )}
              </div>
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

              <div className="space-y-4">
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
                      <Text strong className="block mb-2">AZURE_OPENAI_ENDPOINT</Text>
                      <Input
                        name='azure_base_url'
                        placeholder={t('请输入 AZURE_OPENAI_ENDPOINT，例如：https://docs-test-001.openai.azure.com')}
                        onChange={(value) => handleInputChange('base_url', value)}
                        value={inputs.base_url}
                        autoComplete='new-password'
                      />
                    </div>
                    <div>
                      <Text strong className="block mb-2">{t('默认 API 版本')}</Text>
                      <Input
                        name='azure_other'
                        placeholder={t('请输入默认 API 版本，例如：2025-04-01-preview')}
                        onChange={(value) => handleInputChange('other', value)}
                        value={inputs.other}
                        autoComplete='new-password'
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
                      <Text strong className="block mb-2">{t('完整的 Base URL，支持变量{model}')}</Text>
                      <Input
                        name='base_url'
                        placeholder={t('请输入完整的URL，例如：https://api.openai.com/v1/chat/completions')}
                        onChange={(value) => handleInputChange('base_url', value)}
                        value={inputs.base_url}
                        autoComplete='new-password'
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
                    <Text strong className="block mb-2">{t('API地址')}</Text>
                    <Input
                      name='base_url'
                      placeholder={t('此项可选，用于通过自定义API地址来进行 API 调用，末尾不要带/v1和/')}
                      onChange={(value) => handleInputChange('base_url', value)}
                      value={inputs.base_url}
                      autoComplete='new-password'
                    />
                    <Text type="tertiary" className="mt-1 text-xs">
                      {t('对于官方渠道，new-api已经内置地址，除非是第三方代理站点或者Azure的特殊接入地址，否则不需要填写')}
                    </Text>
                  </div>
                )}

                {inputs.type === 22 && (
                  <div>
                    <Text strong className="block mb-2">{t('私有部署地址')}</Text>
                    <Input
                      name='base_url'
                      placeholder={t('请输入私有部署地址，格式为：https://fastgpt.run/api/openapi')}
                      onChange={(value) => handleInputChange('base_url', value)}
                      value={inputs.base_url}
                      autoComplete='new-password'
                    />
                  </div>
                )}

                {inputs.type === 36 && (
                  <div>
                    <Text strong className="block mb-2">
                      {t('注意非Chat API，请务必填写正确的API地址，否则可能导致无法使用')}
                    </Text>
                    <Input
                      name='base_url'
                      placeholder={t('请输入到 /suno 前的路径，通常就是域名，例如：https://api.example.com')}
                      onChange={(value) => handleInputChange('base_url', value)}
                      value={inputs.base_url}
                      autoComplete='new-password'
                    />
                  </div>
                )}
              </div>
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

              <div className="space-y-4">
                <div>
                  <Text strong className="block mb-2">{t('模型')}</Text>
                  <Select
                    placeholder={t('请选择该渠道所支持的模型')}
                    name='models'
                    required
                    multiple
                    selection
                    filter
                    searchPosition='dropdown'
                    onChange={(value) => handleInputChange('models', value)}
                    value={inputs.models}
                    autoComplete='new-password'
                    optionList={modelOptions}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type='primary'
                    onClick={() => handleInputChange('models', basicModels)}
                  >
                    {t('填入相关模型')}
                  </Button>
                  <Button
                    type='secondary'
                    onClick={() => handleInputChange('models', fullModels)}
                  >
                    {t('填入所有模型')}
                  </Button>
                  {isEdit ? (
                    <Button
                      type='tertiary'
                      onClick={() => fetchUpstreamModelList('models')}
                    >
                      {t('获取模型列表')}
                    </Button>
                  ) : null}
                  <Button
                    type='warning'
                    onClick={() => handleInputChange('models', [])}
                  >
                    {t('清除所有模型')}
                  </Button>
                  <Button
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
                </div>

                {!isEdit && (
                  <Banner
                    type='info'
                    description={t('创建后可在编辑渠道时获取上游模型列表')}
                    className='!rounded-lg'
                  />
                )}

                <div>
                  <Input
                    addonAfter={
                      <Button type='primary' onClick={addCustomModels} className="!rounded-r-lg">
                        {t('填入')}
                      </Button>
                    }
                    placeholder={t('输入自定义模型名称')}
                    value={customModel}
                    onChange={(value) => setCustomModel(value.trim())}
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('模型重定向')}</Text>
                  <TextArea
                    placeholder={
                      t('此项可选，用于修改请求体中的模型名称，为一个 JSON 字符串，键为请求中模型名称，值为要替换的模型名称，例如：') +
                      `\n${JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2)}`
                    }
                    name='model_mapping'
                    onChange={(value) => handleInputChange('model_mapping', value)}
                    autosize
                    value={inputs.model_mapping}
                    autoComplete='new-password'
                  />
                  <Text
                    className="!text-semi-color-primary cursor-pointer mt-1 block"
                    onClick={() => handleInputChange('model_mapping', JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2))}
                  >
                    {t('填入模板')}
                  </Text>
                </div>

                <div>
                  <Text strong className="block mb-2">{t('默认测试模型')}</Text>
                  <Input
                    name='test_model'
                    placeholder={t('不填则为模型列表第一个')}
                    onChange={(value) => handleInputChange('test_model', value)}
                    value={inputs.test_model}
                  />
                </div>
              </div>
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

              <div className="space-y-4">
                <div>
                  <Text strong className="block mb-2">{t('分组')}</Text>
                  <Select
                    placeholder={t('请选择可以使用该渠道的分组')}
                    name='groups'
                    required
                    multiple
                    selection
                    allowAdditions
                    additionLabel={t('请在系统设置页面编辑分组倍率以添加新的分组：')}
                    onChange={(value) => handleInputChange('groups', value)}
                    value={inputs.groups}
                    autoComplete='new-password'
                    optionList={groupOptions}
                  />
                </div>

                {inputs.type === 18 && (
                  <div>
                    <Text strong className="block mb-2">{t('模型版本')}</Text>
                    <Input
                      name='other'
                      placeholder={'请输入星火大模型版本，注意是接口地址中的版本号，例如：v2.1'}
                      onChange={(value) => handleInputChange('other', value)}
                      value={inputs.other}
                      autoComplete='new-password'
                    />
                  </div>
                )}

                {inputs.type === 41 && (
                  <div>
                    <Text strong className="block mb-2">{t('部署地区')}</Text>
                    <TextArea
                      name='other'
                      placeholder={t(
                        '请输入部署地区，例如：us-central1\n支持使用模型映射格式\n' +
                        '{\n' +
                        '    "default": "us-central1",\n' +
                        '    "claude-3-5-sonnet-20240620": "europe-west1"\n' +
                        '}'
                      )}
                      autosize={{ minRows: 2 }}
                      onChange={(value) => handleInputChange('other', value)}
                      value={inputs.other}
                      autoComplete='new-password'
                    />
                    <Text
                      className="!text-semi-color-primary cursor-pointer mt-1 block"
                      onClick={() => handleInputChange('other', JSON.stringify(REGION_EXAMPLE, null, 2))}
                    >
                      {t('填入模板')}
                    </Text>
                  </div>
                )}

                {inputs.type === 21 && (
                  <div>
                    <Text strong className="block mb-2">{t('知识库 ID')}</Text>
                    <Input
                      name='other'
                      placeholder={'请输入知识库 ID，例如：123456'}
                      onChange={(value) => handleInputChange('other', value)}
                      value={inputs.other}
                      autoComplete='new-password'
                    />
                  </div>
                )}

                {inputs.type === 39 && (
                  <div>
                    <Text strong className="block mb-2">Account ID</Text>
                    <Input
                      name='other'
                      placeholder={'请输入Account ID，例如：d6b5da8hk1awo8nap34ube6gh'}
                      onChange={(value) => handleInputChange('other', value)}
                      value={inputs.other}
                      autoComplete='new-password'
                    />
                  </div>
                )}

                {inputs.type === 49 && (
                  <div>
                    <Text strong className="block mb-2">{t('智能体ID')}</Text>
                    <Input
                      name='other'
                      placeholder={'请输入智能体ID，例如：7342866812345'}
                      onChange={(value) => handleInputChange('other', value)}
                      value={inputs.other}
                      autoComplete='new-password'
                    />
                  </div>
                )}

                <div>
                  <Text strong className="block mb-2">{t('渠道标签')}</Text>
                  <Input
                    name='tag'
                    placeholder={t('渠道标签')}
                    onChange={(value) => handleInputChange('tag', value)}
                    value={inputs.tag}
                    autoComplete='new-password'
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('渠道优先级')}</Text>
                  <Input
                    name='priority'
                    placeholder={t('渠道优先级')}
                    onChange={(value) => {
                      const number = parseInt(value);
                      if (isNaN(number)) {
                        handleInputChange('priority', value);
                      } else {
                        handleInputChange('priority', number);
                      }
                    }}
                    value={inputs.priority}
                    autoComplete='new-password'
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('渠道权重')}</Text>
                  <Input
                    name='weight'
                    placeholder={t('渠道权重')}
                    onChange={(value) => {
                      const number = parseInt(value);
                      if (isNaN(number)) {
                        handleInputChange('weight', value);
                      } else {
                        handleInputChange('weight', number);
                      }
                    }}
                    value={inputs.weight}
                    autoComplete='new-password'
                  />
                </div>

                <div>
                  <Text strong className="block mb-2">{t('渠道额外设置')}</Text>
                  <TextArea
                    placeholder={
                      t('此项可选，用于配置渠道特定设置，为一个 JSON 字符串，例如：') +
                      '\n{\n  "force_format": true\n}'
                    }
                    name='setting'
                    onChange={(value) => handleInputChange('setting', value)}
                    autosize
                    value={inputs.setting}
                    autoComplete='new-password'
                  />
                  <div className="flex gap-2 mt-1">
                    <Text
                      className="!text-semi-color-primary cursor-pointer"
                      onClick={() => {
                        handleInputChange(
                          'setting',
                          JSON.stringify({ force_format: true }, null, 2),
                        );
                      }}
                    >
                      {t('填入模板')}
                    </Text>
                    <Text
                      className="!text-semi-color-primary cursor-pointer"
                      onClick={() => {
                        window.open(
                          'https://github.com/QuantumNous/new-api/blob/main/docs/channel/other_setting.md',
                        );
                      }}
                    >
                      {t('设置说明')}
                    </Text>
                  </div>
                </div>

                <div>
                  <Text strong className="block mb-2">{t('参数覆盖')}</Text>
                  <TextArea
                    placeholder={
                      t('此项可选，用于覆盖请求参数。不支持覆盖 stream 参数。为一个 JSON 字符串，例如：') +
                      '\n{\n  "temperature": 0\n}'
                    }
                    name='param_override'
                    onChange={(value) => handleInputChange('param_override', value)}
                    autosize
                    value={inputs.param_override}
                    autoComplete='new-password'
                  />
                </div>

                {inputs.type === 1 && (
                  <div>
                    <Text strong className="block mb-2">{t('组织')}</Text>
                    <Input
                      name='openai_organization'
                      placeholder={t('请输入组织org-xxx')}
                      onChange={(value) => handleInputChange('openai_organization', value)}
                      value={inputs.openai_organization}
                    />
                    <Text type="tertiary" className="mt-1 text-xs">
                      {t('组织，可选，不填则为默认组织')}
                    </Text>
                  </div>
                )}

                <div className="flex items-center">
                  <Checkbox
                    checked={autoBan}
                    onChange={() => setAutoBan(!autoBan)}
                  />
                  <Text strong className="ml-2">
                    {t('是否自动禁用（仅当自动禁用开启时有效），关闭后不会自动禁用该渠道')}
                  </Text>
                </div>

                <div>
                  <Text strong className="block mb-2">
                    {t('状态码复写（仅影响本地判断，不修改返回到上游的状态码）')}
                  </Text>
                  <TextArea
                    placeholder={
                      t('此项可选，用于复写返回的状态码，比如将claude渠道的400错误复写为500（用于重试），请勿滥用该功能，例如：') +
                      '\n' +
                      JSON.stringify(STATUS_CODE_MAPPING_EXAMPLE, null, 2)
                    }
                    name='status_code_mapping'
                    onChange={(value) => handleInputChange('status_code_mapping', value)}
                    autosize
                    value={inputs.status_code_mapping}
                    autoComplete='new-password'
                  />
                  <Text
                    className="!text-semi-color-primary cursor-pointer mt-1 block"
                    onClick={() => {
                      handleInputChange(
                        'status_code_mapping',
                        JSON.stringify(STATUS_CODE_MAPPING_EXAMPLE, null, 2),
                      );
                    }}
                  >
                    {t('填入模板')}
                  </Text>
                </div>
              </div>
            </Card>
          </div>
        </Spin>
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
