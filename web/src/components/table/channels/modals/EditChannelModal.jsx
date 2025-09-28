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

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  verifyJSON,
} from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { CHANNEL_OPTIONS } from '../../../../constants';
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
  Highlight,
  Input,
} from '@douyinfe/semi-ui';
import {
  getChannelModels,
  copy,
  getChannelIcon,
  getModelCategories,
  selectFilter,
} from '../../../../helpers';
import ModelSelectModal from './ModelSelectModal';
import JSONEditor from '../../../common/ui/JSONEditor';
import TwoFactorAuthModal from '../../../common/modals/TwoFactorAuthModal';
import ChannelKeyDisplay from '../../../common/ui/ChannelKeyDisplay';
import {
  IconSave,
  IconClose,
  IconServer,
  IconSetting,
  IconCode,
  IconGlobe,
  IconBolt,
} from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const MODEL_MAPPING_EXAMPLE = {
  'gpt-3.5-turbo': 'gpt-3.5-turbo-0125',
};

const STATUS_CODE_MAPPING_EXAMPLE = {
  400: '500',
};

const REGION_EXAMPLE = {
  default: 'global',
  'gemini-1.5-pro-002': 'europe-west2',
  'gemini-1.5-flash-002': 'europe-west2',
  'claude-3-5-sonnet-20240620': 'europe-west1',
};

// 支持并且已适配通过接口获取模型列表的渠道类型
const MODEL_FETCHABLE_TYPES = new Set([
  1,
  4,
  14,
  34,
  17,
  26,
  24,
  47,
  25,
  20,
  23,
  31,
  35,
  40,
  42,
  48,
]);

function type2secretPrompt(type, t) {
  // inputs.type === 15 ? '按照如下格式输入：APIKey|SecretKey' : (inputs.type === 18 ? '按照如下格式输入：APPID|APISecret|APIKey' : '请输入渠道对应的鉴权密钥')
  switch (type) {
    case 15:
      return t('modals.channels.edit.prompts.apiKeySecretKey');
    case 18:
      return t('modals.channels.edit.prompts.appIdApiSecretApiKey');
    case 22:
      return t('modals.channels.edit.prompts.apiKeyAppId');
    case 23:
      return t('modals.channels.edit.prompts.appIdSecretIdSecretKey');
    case 33:
      return t('modals.channels.edit.prompts.akSkRegion');
    case 50:
      return t('modals.channels.edit.prompts.accessKeySecretKey');
    case 51:
      return t('modals.channels.edit.prompts.accessKeyIdSecretAccessKey');
    default:
      return t('modals.channels.edit.prompts.default');
  }
}

const EditChannelModal = (props) => {
  const { t } = useTranslation();
  const channelId = props.editingChannel.id;
  const isEdit = channelId !== undefined;
  const [loading, setLoading] = useState(isEdit);
  const isMobile = useIsMobile();
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
    multi_key_mode: 'random',
    // 渠道额外设置的默认值
    force_format: false,
    thinking_to_content: false,
    proxy: '',
    pass_through_body_enabled: false,
    system_prompt: '',
    system_prompt_override: false,
    settings: '',
    // 仅 Vertex: 密钥格式（存入 settings.vertex_key_type）
    vertex_key_type: 'json',
    // 企业账户设置
    is_enterprise_account: false,
  };
  const [batch, setBatch] = useState(false);
  const [multiToSingle, setMultiToSingle] = useState(false);
  const [multiKeyMode, setMultiKeyMode] = useState('random');
  const [autoBan, setAutoBan] = useState(true);
  const [inputs, setInputs] = useState(originInputs);
  const [originModelOptions, setOriginModelOptions] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [basicModels, setBasicModels] = useState([]);
  const [fullModels, setFullModels] = useState([]);
  const [modelGroups, setModelGroups] = useState([]);
  const [customModel, setCustomModel] = useState('');
  const [modalImageUrl, setModalImageUrl] = useState('');
  const [isModalOpenurl, setIsModalOpenurl] = useState(false);
  const [modelModalVisible, setModelModalVisible] = useState(false);
  const [fetchedModels, setFetchedModels] = useState([]);
  const formApiRef = useRef(null);
  const [vertexKeys, setVertexKeys] = useState([]);
  const [vertexFileList, setVertexFileList] = useState([]);
  const vertexErroredNames = useRef(new Set()); // 避免重复报错
  const [isMultiKeyChannel, setIsMultiKeyChannel] = useState(false);
  const [channelSearchValue, setChannelSearchValue] = useState('');
  const [useManualInput, setUseManualInput] = useState(false); // 是否使用手动输入模式
  const [keyMode, setKeyMode] = useState('append'); // 密钥模式：replace（覆盖）或 append（追加）
  const [isEnterpriseAccount, setIsEnterpriseAccount] = useState(false); // 是否为企业账户

  // 2FA验证查看密钥相关状态
  const [twoFAState, setTwoFAState] = useState({
    showModal: false,
    code: '',
    loading: false,
    showKey: false,
    keyData: '',
  });

  // 专门的2FA验证状态（用于TwoFactorAuthModal）
  const [show2FAVerifyModal, setShow2FAVerifyModal] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  // 2FA状态更新辅助函数
  const updateTwoFAState = (updates) => {
    setTwoFAState((prev) => ({ ...prev, ...updates }));
  };

  // 重置2FA状态
  const resetTwoFAState = () => {
    setTwoFAState({
      showModal: false,
      code: '',
      loading: false,
      showKey: false,
      keyData: '',
    });
  };

  // 重置2FA验证状态
  const reset2FAVerifyState = () => {
    setShow2FAVerifyModal(false);
    setVerifyCode('');
    setVerifyLoading(false);
  };

  // 渠道额外设置状态
  const [channelSettings, setChannelSettings] = useState({
    force_format: false,
    thinking_to_content: false,
    proxy: '',
    pass_through_body_enabled: false,
    system_prompt: '',
  });
  const showApiConfigCard = true; // 控制是否显示 API 配置卡片
  const getInitValues = () => ({ ...originInputs });

  // 处理渠道额外设置的更新
  const handleChannelSettingsChange = (key, value) => {
    // 更新内部状态
    setChannelSettings((prev) => ({ ...prev, [key]: value }));

    // 同步更新到表单字段
    if (formApiRef.current) {
      formApiRef.current.setValue(key, value);
    }

    // 同步更新inputs状态
    setInputs((prev) => ({ ...prev, [key]: value }));

    // 生成setting JSON并更新
    const newSettings = { ...channelSettings, [key]: value };
    const settingsJson = JSON.stringify(newSettings);
    handleInputChange('setting', settingsJson);
  };

  const handleChannelOtherSettingsChange = (key, value) => {
    // 更新内部状态
    setChannelSettings((prev) => ({ ...prev, [key]: value }));

    // 同步更新到表单字段
    if (formApiRef.current) {
      formApiRef.current.setValue(key, value);
    }

    // 同步更新inputs状态
    setInputs((prev) => ({ ...prev, [key]: value }));

    // 需要更新settings，是一个json，例如{"azure_responses_version": "preview"}
    let settings = {};
    if (inputs.settings) {
      try {
        settings = JSON.parse(inputs.settings);
      } catch (error) {
        console.error('解析设置失败:', error);
      }
    }
    settings[key] = value;
    const settingsJson = JSON.stringify(settings);
    handleInputChange('settings', settingsJson);
  };

  const handleInputChange = (name, value) => {
    if (formApiRef.current) {
      formApiRef.current.setValue(name, value);
    }
    if (name === 'models' && Array.isArray(value)) {
      value = Array.from(new Set(value.map((m) => (m || '').trim())));
    }

    if (name === 'base_url' && value.endsWith('/v1')) {
      Modal.confirm({
        title: t('modals.channels.edit.warning'),
        content: t('modals.channels.edit.warningContent'),
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
        case 45:
          localModels = getChannelModels(value);
          setInputs((prevInputs) => ({ ...prevInputs, base_url: 'https://ark.cn-beijing.volces.com' }));
          break;
        default:
          localModels = getChannelModels(value);
          break;
      }
      if (inputs.models.length === 0) {
        setInputs((inputs) => ({ ...inputs, models: localModels }));
      }
      setBasicModels(localModels);

      // 重置手动输入模式状态
      setUseManualInput(false);
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
      const chInfo = data.channel_info || {};
      const isMulti = chInfo.is_multi_key === true;
      setIsMultiKeyChannel(isMulti);
      if (isMulti) {
        setBatch(true);
        setMultiToSingle(true);
        const modeVal = chInfo.multi_key_mode || 'random';
        setMultiKeyMode(modeVal);
        data.multi_key_mode = modeVal;
      } else {
        setBatch(false);
        setMultiToSingle(false);
      }
      // 解析渠道额外设置并合并到data中
      if (data.setting) {
        try {
          const parsedSettings = JSON.parse(data.setting);
          data.force_format = parsedSettings.force_format || false;
          data.thinking_to_content =
            parsedSettings.thinking_to_content || false;
          data.proxy = parsedSettings.proxy || '';
          data.pass_through_body_enabled =
            parsedSettings.pass_through_body_enabled || false;
          data.system_prompt = parsedSettings.system_prompt || '';
          data.system_prompt_override =
            parsedSettings.system_prompt_override || false;
        } catch (error) {
          console.error(t('modals.channels.edit.parseSettingsFailed'), error);
          data.force_format = false;
          data.thinking_to_content = false;
          data.proxy = '';
          data.pass_through_body_enabled = false;
          data.system_prompt = '';
          data.system_prompt_override = false;
        }
      } else {
        data.force_format = false;
        data.thinking_to_content = false;
        data.proxy = '';
        data.pass_through_body_enabled = false;
        data.system_prompt = '';
        data.system_prompt_override = false;
      }

      if (data.settings) {
        try {
          const parsedSettings = JSON.parse(data.settings);
          data.azure_responses_version =
            parsedSettings.azure_responses_version || '';
          // 读取 Vertex 密钥格式
          data.vertex_key_type = parsedSettings.vertex_key_type || 'json';
          // 读取企业账户设置
          data.is_enterprise_account = parsedSettings.openrouter_enterprise === true;
        } catch (error) {
          console.error(t('modals.channels.edit.parseOtherSettingsFailed'), error);
          data.azure_responses_version = '';
          data.region = '';
          data.vertex_key_type = 'json';
          data.is_enterprise_account = false;
        }
      } else {
        // 兼容历史数据：老渠道没有 settings 时，默认按 json 展示
        data.vertex_key_type = 'json';
        data.is_enterprise_account = false;
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
      // 同步企业账户状态
      setIsEnterpriseAccount(data.is_enterprise_account || false);
      setBasicModels(getChannelModels(data.type));
      // 同步更新channelSettings状态显示
      setChannelSettings({
        force_format: data.force_format,
        thinking_to_content: data.thinking_to_content,
        proxy: data.proxy,
        pass_through_body_enabled: data.pass_through_body_enabled,
        system_prompt: data.system_prompt,
        system_prompt_override: data.system_prompt_override || false,
      });
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
    const models = [];
    let err = false;

    if (isEdit) {
      // 如果是编辑模式，使用已有的 channelId 获取模型列表
      const res = await API.get('/api/channel/fetch_models/' + channelId, {
        skipErrorHandler: true,
      });
      if (res && res.data && res.data.success) {
        models.push(...res.data.data);
      } else {
        err = true;
      }
    } else {
      // 如果是新建模式，通过后端代理获取模型列表
      if (!inputs?.['key']) {
        showError(t('modals.channels.edit.keyRequired'));
        err = true;
      } else {
        try {
          const res = await API.post(
            '/api/channel/fetch_models',
            {
              base_url: inputs['base_url'],
              type: inputs['type'],
              key: inputs['key'],
            },
            { skipErrorHandler: true },
          );

          if (res && res.data && res.data.success) {
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
      const uniqueModels = Array.from(new Set(models));
      setFetchedModels(uniqueModels);
      setModelModalVisible(true);
    } else {
      showError(t('modals.channels.edit.fetchModelsFailed'));
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

  const fetchModelGroups = async () => {
    try {
      const res = await API.get('/api/prefill_group?type=model');
      if (res?.data?.success) {
        setModelGroups(res.data.data || []);
      }
    } catch (error) {
      // ignore
    }
  };

  // 使用TwoFactorAuthModal的验证函数
  const handleVerify2FA = async () => {
    if (!verifyCode) {
      showError(t('modals.channels.edit.verificationCodeRequired'));
      return;
    }

    setVerifyLoading(true);
    try {
      const res = await API.post(`/api/channel/${channelId}/key`, {
        code: verifyCode,
      });
      if (res.data.success) {
        // 验证成功，显示密钥
        updateTwoFAState({
          showModal: true,
          showKey: true,
          keyData: res.data.data.key,
        });
        reset2FAVerifyState();
        showSuccess(t('modals.channels.edit.verificationSuccess'));
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('modals.channels.edit.getKeyFailed'));
    } finally {
      setVerifyLoading(false);
    }
  };

  // 显示2FA验证模态框 - 使用TwoFactorAuthModal
  const handleShow2FAModal = () => {
    setShow2FAVerifyModal(true);
  };

  useEffect(() => {
    const modelMap = new Map();

    originModelOptions.forEach((option) => {
      const v = (option.value || '').trim();
      if (!modelMap.has(v)) {
        modelMap.set(v, option);
      }
    });

    inputs.models.forEach((model) => {
      const v = (model || '').trim();
      if (!modelMap.has(v)) {
        modelMap.set(v, {
          key: v,
          label: v,
          value: v,
        });
      }
    });

    const categories = getModelCategories(t);
    const optionsWithIcon = Array.from(modelMap.values()).map((opt) => {
      const modelName = opt.value;
      let icon = null;
      for (const [key, category] of Object.entries(categories)) {
        if (key !== 'all' && category.filter({ model_name: modelName })) {
          icon = category.icon;
          break;
        }
      }
      return {
        ...opt,
        label: (
          <span className='flex items-center gap-1'>
            {icon}
            {modelName}
          </span>
        ),
      };
    });

    setModelOptions(optionsWithIcon);
  }, [originModelOptions, inputs.models, t]);

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
      fetchModelGroups();
      // 重置手动输入模式状态
      setUseManualInput(false);
    } else {
      // 统一的模态框关闭重置逻辑
      resetModalState();
    }
  }, [props.visible, channelId]);

  // 统一的模态框重置函数
  const resetModalState = () => {
    formApiRef.current?.reset();
    // 重置渠道设置状态
    setChannelSettings({
      force_format: false,
      thinking_to_content: false,
      proxy: '',
      pass_through_body_enabled: false,
      system_prompt: '',
      system_prompt_override: false,
    });
    // 重置密钥模式状态
    setKeyMode('append');
    // 重置企业账户状态
    setIsEnterpriseAccount(false);
    // 清空表单中的key_mode字段
    if (formApiRef.current) {
      formApiRef.current.setValue('key_mode', undefined);
    }
    // 重置本地输入，避免下次打开残留上一次的 JSON 字段值
    setInputs(getInitValues());
    // 重置2FA状态
    resetTwoFAState();
    // 重置2FA验证状态
    reset2FAVerifyState();
  };

  const handleVertexUploadChange = ({ fileList }) => {
    vertexErroredNames.current.clear();
    (async () => {
      let validFiles = [];
      let keys = [];
      const errorNames = [];
      for (const item of fileList) {
        const fileObj = item.fileInstance;
        if (!fileObj) continue;
        try {
          const txt = await fileObj.text();
          keys.push(JSON.parse(txt));
          validFiles.push(item);
        } catch (err) {
          if (!vertexErroredNames.current.has(item.name)) {
            errorNames.push(item.name);
            vertexErroredNames.current.add(item.name);
          }
        }
      }

      // 非批量模式下只保留一个文件（最新选择的），避免重复叠加
      if (!batch && validFiles.length > 1) {
        validFiles = [validFiles[validFiles.length - 1]];
        keys = [keys[keys.length - 1]];
      }

      setVertexKeys(keys);
      setVertexFileList(validFiles);
      if (formApiRef.current) {
        formApiRef.current.setValue('vertex_files', validFiles);
      }
      setInputs((prev) => ({ ...prev, vertex_files: validFiles }));

      if (errorNames.length > 0) {
        showError(
          t('modals.channels.edit.fileParseFailed', {
            list: errorNames.join(', '),
          }),
        );
      }
    })();
  };

  const submit = async () => {
    const formValues = formApiRef.current ? formApiRef.current.getValues() : {};
    let localInputs = { ...formValues };

    if (localInputs.type === 41) {
      const keyType = localInputs.vertex_key_type || 'json';
      if (keyType === 'api_key') {
        // 直接作为普通字符串密钥处理
        if (!isEdit && (!localInputs.key || localInputs.key.trim() === '')) {
          showInfo(t('modals.channels.edit.keyRequired'));
          return;
        }
      } else {
        // JSON 服务账号密钥
        if (useManualInput) {
          if (localInputs.key && localInputs.key.trim() !== '') {
            try {
              const parsedKey = JSON.parse(localInputs.key);
              localInputs.key = JSON.stringify(parsedKey);
            } catch (err) {
              showError(t('modals.channels.edit.invalidKeyFormat'));
              return;
            }
          } else if (!isEdit) {
            showInfo(t('modals.channels.edit.keyRequired'));
            return;
          }
        } else {
          // 文件上传模式
          let keys = vertexKeys;
          if (keys.length === 0 && vertexFileList.length > 0) {
            try {
              const parsed = await Promise.all(
                vertexFileList.map(async (item) => {
                  const fileObj = item.fileInstance;
                  if (!fileObj) return null;
                  const txt = await fileObj.text();
                  return JSON.parse(txt);
                }),
              );
              keys = parsed.filter(Boolean);
            } catch (err) {
              showError(t('modals.channels.edit.parseKeyFileFailed', { msg: err.message }));
              return;
            }
          }
          if (keys.length === 0) {
            if (!isEdit) {
              showInfo(t('modals.channels.edit.uploadKeyFileRequired'));
              return;
            } else {
              delete localInputs.key;
            }
          } else {
            localInputs.key = batch ? JSON.stringify(keys) : JSON.stringify(keys[0]);
          }
        }
      }
    }

    // 如果是编辑模式且 key 为空字符串，避免提交空值覆盖旧密钥
    if (isEdit && (!localInputs.key || localInputs.key.trim() === '')) {
      delete localInputs.key;
    }
    delete localInputs.vertex_files;

    if (!isEdit && (!localInputs.name || !localInputs.key)) {
      showInfo(t('modals.channels.edit.nameAndKeyRequired'));
      return;
    }
    if (!Array.isArray(localInputs.models) || localInputs.models.length === 0) {
      showInfo(t('modals.channels.edit.modelRequired'));
      return;
    }
    if (localInputs.type === 45 && (!localInputs.base_url || localInputs.base_url.trim() === '')) {
      showInfo(t('modals.channels.edit.apiUrlRequired'));
      return;
    }
    if (
      localInputs.model_mapping &&
      localInputs.model_mapping !== '' &&
      !verifyJSON(localInputs.model_mapping)
    ) {
      showInfo(t('modals.channels.edit.invalidModelMapping'));
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

    // 生成渠道额外设置JSON
    const channelExtraSettings = {
      force_format: localInputs.force_format || false,
      thinking_to_content: localInputs.thinking_to_content || false,
      proxy: localInputs.proxy || '',
      pass_through_body_enabled: localInputs.pass_through_body_enabled || false,
      system_prompt: localInputs.system_prompt || '',
      system_prompt_override: localInputs.system_prompt_override || false,
    };
    localInputs.setting = JSON.stringify(channelExtraSettings);

    // 处理type === 20的企业账户设置
    if (localInputs.type === 20) {
      let settings = {};
      if (localInputs.settings) {
        try {
          settings = JSON.parse(localInputs.settings);
        } catch (error) {
          console.error(t('modals.channels.edit.parseSettingsFailed'), error);
        }
      }
      // 设置企业账户标识，无论是true还是false都要传到后端
      settings.openrouter_enterprise = localInputs.is_enterprise_account === true;
      localInputs.settings = JSON.stringify(settings);
    }

    // 清理不需要发送到后端的字段
    delete localInputs.force_format;
    delete localInputs.thinking_to_content;
    delete localInputs.proxy;
    delete localInputs.pass_through_body_enabled;
    delete localInputs.system_prompt;
    delete localInputs.system_prompt_override;
    delete localInputs.is_enterprise_account;
    // 顶层的 vertex_key_type 不应发送给后端
    delete localInputs.vertex_key_type;

    let res;
    localInputs.auto_ban = localInputs.auto_ban ? 1 : 0;
    localInputs.models = localInputs.models.join(',');
    localInputs.group = (localInputs.groups || []).join(',');

    let mode = 'single';
    if (batch) {
      mode = multiToSingle ? 'multi_to_single' : 'batch';
    }

    if (isEdit) {
      res = await API.put(`/api/channel/`, {
        ...localInputs,
        id: parseInt(channelId),
        key_mode: isMultiKeyChannel ? keyMode : undefined, // 只在多key模式下传递
      });
    } else {
      res = await API.post(`/api/channel/`, {
        mode: mode,
        multi_key_mode: mode === 'multi_to_single' ? multiKeyMode : undefined,
        channel: localInputs,
      });
    }
    const { success, message } = res.data;
    if (success) {
      if (isEdit) {
        showSuccess(t('modals.channels.edit.updateSuccess'));
      } else {
        showSuccess(t('modals.channels.edit.createSuccess'));
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
        t('modals.channels.edit.modelsAdded', {
          count: addedModels.length,
          list: addedModels.join(', '),
        }),
      );
    } else {
      showInfo(t('modals.channels.edit.noNewModels'));
    }
  };

  const batchAllowed = !isEdit || isMultiKeyChannel;
  const batchExtra = batchAllowed ? (
    <Space>
      {!isEdit && (
        <Checkbox
          disabled={isEdit}
          checked={batch}
          onChange={(e) => {
            const checked = e.target.checked;

            if (!checked && vertexFileList.length > 1) {
              Modal.confirm({
                title: t('modals.channels.edit.singleKeyMode'),
                content: t('modals.channels.edit.singleKeyModeContent'),
                onOk: () => {
                  const firstFile = vertexFileList[0];
                  const firstKey = vertexKeys[0] ? [vertexKeys[0]] : [];

                  setVertexFileList([firstFile]);
                  setVertexKeys(firstKey);

                  formApiRef.current?.setValue('vertex_files', [firstFile]);
                  setInputs((prev) => ({ ...prev, vertex_files: [firstFile] }));

                  setBatch(false);
                  setMultiToSingle(false);
                  setMultiKeyMode('random');
                },
                onCancel: () => {
                  setBatch(true);
                },
                centered: true,
              });
              return;
            }

            setBatch(checked);
            if (!checked) {
              setMultiToSingle(false);
              setMultiKeyMode('random');
            } else {
              // 批量模式下禁用手动输入，并清空手动输入的内容
              setUseManualInput(false);
              if (inputs.type === 41) {
                // 清空手动输入的密钥内容
                if (formApiRef.current) {
                  formApiRef.current.setValue('key', '');
                }
                handleInputChange('key', '');
              }
            }
          }}
        >
          {t('modals.channels.edit.batchCreate')}
        </Checkbox>
      )}
      {batch && (
        <Checkbox
          disabled={isEdit}
          checked={multiToSingle}
          onChange={() => {
            setMultiToSingle((prev) => !prev);
            setInputs((prev) => {
              const newInputs = { ...prev };
              if (!multiToSingle) {
                newInputs.multi_key_mode = multiKeyMode;
              } else {
                delete newInputs.multi_key_mode;
              }
              return newInputs;
            });
          }}
        >
          {t('modals.channels.edit.keyAggregationMode')}
        </Checkbox>
      )}
    </Space>
  ) : null;

  const channelOptionList = useMemo(
    () =>
      CHANNEL_OPTIONS.map((opt) => ({
        ...opt,
        // 保持 label 为纯文本以支持搜索
        label: opt.label,
      })),
    [],
  );

  const renderChannelOption = (renderProps) => {
    const {
      disabled,
      selected,
      label,
      value,
      focused,
      className,
      style,
      onMouseEnter,
      onClick,
      ...rest
    } = renderProps;

    const searchWords = channelSearchValue ? [channelSearchValue] : [];

    // 构建样式类名
    const optionClassName = [
      'flex items-center gap-3 px-3 py-2 transition-all duration-200 rounded-lg mx-2 my-1',
      focused && 'bg-blue-50 shadow-sm',
      selected &&
        'bg-blue-100 text-blue-700 shadow-lg ring-2 ring-blue-200 ring-opacity-50',
      disabled && 'opacity-50 cursor-not-allowed',
      !disabled && 'hover:bg-gray-50 hover:shadow-md cursor-pointer',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        style={style}
        className={optionClassName}
        onClick={() => !disabled && onClick()}
        onMouseEnter={(e) => onMouseEnter()}
      >
        <div className='flex items-center gap-3 w-full'>
          <div className='flex-shrink-0 w-5 h-5 flex items-center justify-center'>
            {getChannelIcon(value)}
          </div>
          <div className='flex-1 min-w-0'>
            <Highlight
              sourceString={label}
              searchWords={searchWords}
              className='text-sm font-medium truncate'
            />
          </div>
          {selected && (
            <div className='flex-shrink-0 text-blue-600'>
              <svg
                width='16'
                height='16'
                viewBox='0 0 16 16'
                fill='currentColor'
              >
                <path d='M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z' />
              </svg>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <SideSheet
        placement={isEdit ? 'right' : 'left'}
        title={
          <Space>
            <Tag color='blue' shape='circle'>
              {isEdit ? t('编辑') : t('新建')}
            </Tag>
            <Title heading={4} className='m-0'>
              {isEdit ? t('更新渠道信息') : t('创建新的渠道')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: '0' }}
        visible={props.visible}
        width={isMobile ? '100%' : 600}
        footer={
          <div className='flex justify-end bg-white'>
            <Space>
              <Button
                theme='solid'
                onClick={() => formApiRef.current?.submitForm()}
                icon={<IconSave />}
              >
                {t('提交')}
              </Button>
              <Button
                theme='light'
                type='primary'
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
              <div className='p-2'>
                <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
                  {/* Header: Basic Info */}
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='blue'
                      className='mr-2 shadow-md'
                    >
                      <IconServer size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('modals.channels.edit.basicInfo')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('modals.channels.edit.basicInfoDesc')}
                      </div>
                    </div>
                  </div>

                  <Form.Select
                    field='type'
                    label={t('modals.channels.edit.type')}
                    placeholder={t('modals.channels.edit.typePlaceholder')}
                    rules={[{ required: true, message: t('modals.channels.edit.typeRequired') }]}
                    optionList={channelOptionList}
                    style={{ width: '100%' }}
                    filter={selectFilter}
                    autoClearSearchValue={false}
                    searchPosition='dropdown'
                    onSearch={(value) => setChannelSearchValue(value)}
                    renderOptionItem={renderChannelOption}
                    onChange={(value) => handleInputChange('type', value)}
                  />

                  {inputs.type === 20 && (
                    <Form.Switch
                      field='is_enterprise_account'
                      label={t('modals.channels.edit.isEnterpriseAccount')}
                      checkedText={t('modals.channels.edit.yes')}
                      uncheckedText={t('modals.channels.edit.no')}
                      onChange={(value) => {
                        setIsEnterpriseAccount(value);
                        handleInputChange('is_enterprise_account', value);
                      }}
                      extraText={t('modals.channels.edit.isEnterpriseAccountDesc')}
                      initValue={inputs.is_enterprise_account}
                    />
                  )}

                  <Form.Input
                    field='name'
                    label={t('modals.channels.edit.name')}
                    placeholder={t('modals.channels.edit.namePlaceholder')}
                    rules={[{ required: true, message: t('modals.channels.edit.nameRequired') }]}
                    showClear
                    onChange={(value) => handleInputChange('name', value)}
                    autoComplete='new-password'
                  />

                  {inputs.type === 41 && (
                    <Form.Select
                      field='vertex_key_type'
                      label={t('modals.channels.edit.keyFormat')}
                      placeholder={t('modals.channels.edit.keyFormatPlaceholder')}
                      optionList={[
                        { label: t('modals.channels.edit.json'), value: 'json' },
                        { label: t('modals.channels.edit.apiKey'), value: 'api_key' },
                      ]}
                      style={{ width: '100%' }}
                      value={inputs.vertex_key_type || 'json'}
                      onChange={(value) => {
                        // 更新设置中的 vertex_key_type
                        handleChannelOtherSettingsChange('vertex_key_type', value);
                        // 切换为 api_key 时，关闭批量与手动/文件切换，并清理已选文件
                        if (value === 'api_key') {
                          setBatch(false);
                          setUseManualInput(false);
                          setVertexKeys([]);
                          setVertexFileList([]);
                          if (formApiRef.current) {
                            formApiRef.current.setValue('vertex_files', []);
                          }
                        }
                      }}
                      extraText={
                        inputs.vertex_key_type === 'api_key'
                          ? t('modals.channels.edit.apiKeyNoBatch')
                          : t('modals.channels.edit.jsonSupport')
                      }
                    />
                  )}
                  {batch ? (
                    inputs.type === 41 && (inputs.vertex_key_type || 'json') === 'json' ? (
                      <Form.Upload
                        field='vertex_files'
                        label={t('modals.channels.edit.keyFileJson')}
                        accept='.json'
                        multiple
                        draggable
                        dragIcon={<IconBolt />}
                        dragMainText={t('modals.channels.edit.uploadDragMain')}
                        dragSubText={t('modals.channels.edit.uploadDragSubJsonMulti')}
                        style={{ marginTop: 10 }}
                        uploadTrigger='custom'
                        beforeUpload={() => false}
                        onChange={handleVertexUploadChange}
                        fileList={vertexFileList}
                        rules={
                          isEdit
                            ? []
                            : [{ required: true, message: t('modals.channels.edit.uploadKeyFileRequired') }]
                        }
                        extraText={batchExtra}
                      />
                    ) : (
                      <Form.TextArea
                        field='key'
                        label={t('modals.channels.edit.key')}
                        placeholder={t('modals.channels.edit.keyPlaceholderBatch')}
                        rules={
                          isEdit
                            ? []
                            : [{ required: true, message: t('modals.channels.edit.keyRequired') }]
                        }
                        autosize
                        autoComplete='new-password'
                        onChange={(value) => handleInputChange('key', value)}
                        extraText={
                          <div className='flex items-center gap-2'>
                            {isEdit &&
                              isMultiKeyChannel &&
                              keyMode === 'append' && (
                                <Text type='warning' size='small'>
                                  {t('modals.channels.edit.appendModeDesc')}
                                </Text>
                              )}
                            {isEdit && (
                              <Button
                                size='small'
                                type='primary'
                                theme='outline'
                                onClick={handleShow2FAModal}
                              >
                                {t('modals.channels.edit.viewKey')}
                              </Button>
                            )}
                            {batchExtra}
                          </div>
                        }
                        showClear
                      />
                    )
                  ) : (
                    <>
                      {inputs.type === 41 && (inputs.vertex_key_type || 'json') === 'json' ? (
                        <>
                          {!batch && (
                            <div className='flex items-center justify-between mb-3'>
                              <Text className='text-sm font-medium'>
                                {t('modals.channels.edit.keyInputMethod')}
                              </Text>
                              <Space>
                                <Button
                                  size='small'
                                  type={
                                    !useManualInput ? 'primary' : 'tertiary'
                                  }
                                  onClick={() => {
                                    setUseManualInput(false);
                                    // 切换到文件上传模式时清空手动输入的密钥
                                    if (formApiRef.current) {
                                      formApiRef.current.setValue('key', '');
                                    }
                                    handleInputChange('key', '');
                                  }}
                                >
                                  {t('modals.channels.edit.fileUpload')}
                                </Button>
                                <Button
                                  size='small'
                                  type={useManualInput ? 'primary' : 'tertiary'}
                                  onClick={() => {
                                    setUseManualInput(true);
                                    // 切换到手动输入模式时清空文件上传相关状态
                                    setVertexKeys([]);
                                    setVertexFileList([]);
                                    if (formApiRef.current) {
                                      formApiRef.current.setValue(
                                        'vertex_files',
                                        [],
                                      );
                                    }
                                    setInputs((prev) => ({
                                      ...prev,
                                      vertex_files: [],
                                    }));
                                  }}
                                >
                                  {t('modals.channels.edit.manualInput')}
                                </Button>
                              </Space>
                            </div>
                          )}

                          {batch && (
                            <Banner
                              type='info'
                              description={t('modals.channels.edit.batchFileUploadOnly')}
                              className='!rounded-lg mb-3'
                            />
                          )}

                          {useManualInput && !batch ? (
                            <Form.TextArea
                              field='key'
                              label={
                                isEdit
                                  ? t('modals.channels.edit.keyEditHidden')
                                  : t('modals.channels.edit.key')
                              }
                              placeholder={t('modals.channels.edit.jsonKeyPlaceholder')}
                              rules={
                                isEdit
                                  ? []
                                  : [
                                      {
                                        required: true,
                                        message: t('modals.channels.edit.keyRequired'),
                                      },
                                    ]
                              }
                              autoComplete='new-password'
                              onChange={(value) =>
                                handleInputChange('key', value)
                              }
                              extraText={
                                <div className='flex items-center gap-2'>
                                  <Text type='tertiary' size='small'>
                                    {t('modals.channels.edit.jsonKeyDesc')}
                                  </Text>
                                  {isEdit &&
                                    isMultiKeyChannel &&
                                    keyMode === 'append' && (
                                      <Text type='warning' size='small'>
                                        {t('modals.channels.edit.appendModeDesc')}
                                      </Text>
                                    )}
                                  {isEdit && (
                                    <Button
                                      size='small'
                                      type='primary'
                                      theme='outline'
                                      onClick={handleShow2FAModal}
                                    >
                                      {t('modals.channels.edit.viewKey')}
                                    </Button>
                                  )}
                                  {batchExtra}
                                </div>
                              }
                              autosize
                              showClear
                            />
                          ) : (
                            <Form.Upload
                              field='vertex_files'
                              label={t('modals.channels.edit.keyFileJson')}
                              accept='.json'
                              draggable
                              dragIcon={<IconBolt />}
                              dragMainText={t('modals.channels.edit.uploadDragMain')}
                              dragSubText={t('modals.channels.edit.uploadDragSubJson')}
                              style={{ marginTop: 10 }}
                              uploadTrigger='custom'
                              beforeUpload={() => false}
                              onChange={handleVertexUploadChange}
                              fileList={vertexFileList}
                              rules={
                                isEdit
                                  ? []
                                  : [
                                      {
                                        required: true,
                                        message: t('modals.channels.edit.uploadKeyFileRequired'),
                                      },
                                    ]
                              }
                              extraText={batchExtra}
                            />
                          )}
                        </>
                      ) : (
                        <Form.Input
                          field='key'
                          label={
                            isEdit
                              ? t('modals.channels.edit.keyEditHidden')
                              : t('modals.channels.edit.key')
                          }
                          placeholder={type2secretPrompt(inputs.type, t)}
                          rules={
                            isEdit
                              ? []
                              : [{ required: true, message: t('modals.channels.edit.keyRequired') }]
                          }
                          autoComplete='new-password'
                          onChange={(value) => handleInputChange('key', value)}
                          extraText={
                            <div className='flex items-center gap-2'>
                              {isEdit &&
                                isMultiKeyChannel &&
                                keyMode === 'append' && (
                                  <Text type='warning' size='small'>
                                    {t('modals.channels.edit.appendModeDesc')}
                                  </Text>
                                )}
                              {isEdit && (
                                <Button
                                  size='small'
                                  type='primary'
                                  theme='outline'
                                  onClick={handleShow2FAModal}
                                >
                                  {t('modals.channels.edit.viewKey')}
                                </Button>
                              )}
                              {batchExtra}
                            </div>
                          }
                          showClear
                        />
                      )}
                    </>
                  )}

                  {isEdit && isMultiKeyChannel && (
                    <Form.Select
                      field='key_mode'
                      label={t('modals.channels.edit.keyUpdateMode')}
                      placeholder={t('modals.channels.edit.keyUpdateModePlaceholder')}
                      optionList={[
                        { label: t('modals.channels.edit.appendToExisting'), value: 'append' },
                        { label: t('modals.channels.edit.overwriteExisting'), value: 'replace' },
                      ]}
                      style={{ width: '100%' }}
                      value={keyMode}
                      onChange={(value) => setKeyMode(value)}
                      extraText={
                        <Text type='tertiary' size='small'>
                          {keyMode === 'replace'
                            ? t('modals.channels.edit.overwriteModeDesc')
                            : t('modals.channels.edit.appendModeDescLong')}
                        </Text>
                      }
                    />
                  )}
                  {batch && multiToSingle && (
                    <>
                      <Form.Select
                        field='multi_key_mode'
                        label={t('modals.channels.edit.keyAggregationMode')}
                        placeholder={t('modals.channels.edit.keyAggregationModePlaceholder')}
                        optionList={[
                          { label: t('modals.channels.edit.random'), value: 'random' },
                          { label: t('modals.channels.edit.polling'), value: 'polling' },
                        ]}
                        style={{ width: '100%' }}
                        value={inputs.multi_key_mode || 'random'}
                        onChange={(value) => {
                          setMultiKeyMode(value);
                          handleInputChange('multi_key_mode', value);
                        }}
                      />
                      {inputs.multi_key_mode === 'polling' && (
                        <Banner
                          type='warning'
                          description={t('modals.channels.edit.pollingWarning')}
                          className='!rounded-lg mt-2'
                        />
                      )}
                    </>
                  )}

                  {inputs.type === 18 && (
                    <Form.Input
                      field='other'
                      label={t('modals.channels.edit.modelVersion')}
                      placeholder={t('modals.channels.edit.modelVersionPlaceholder')}
                      onChange={(value) => handleInputChange('other', value)}
                      showClear
                    />
                  )}

                  {inputs.type === 41 && (
                    <JSONEditor
                      key={`region-${isEdit ? channelId : 'new'}`}
                      field='other'
                      label={t('modals.channels.edit.deploymentRegion')}
                      placeholder={t('modals.channels.edit.deploymentRegionPlaceholder')}
                      value={inputs.other || ''}
                      onChange={(value) => handleInputChange('other', value)}
                      rules={[{ required: true, message: t('modals.channels.edit.deploymentRegionRequired') }]}
                      template={REGION_EXAMPLE}
                      templateLabel={t('modals.channels.edit.fillTemplate')}
                      editorType='region'
                      formApi={formApiRef.current}
                      extraText={t('modals.channels.edit.deploymentRegionDesc')}
                    />
                  )}

                  {inputs.type === 21 && (
                    <Form.Input
                      field='other'
                      label={t('modals.channels.edit.knowledgeBaseId')}
                      placeholder={t('modals.channels.edit.knowledgeBaseIdPlaceholder')}
                      onChange={(value) => handleInputChange('other', value)}
                      showClear
                    />
                  )}

                  {inputs.type === 39 && (
                    <Form.Input
                      field='other'
                      label={t('modals.channels.edit.accountId')}
                      placeholder={t('modals.channels.edit.accountIdPlaceholder')}
                      onChange={(value) => handleInputChange('other', value)}
                      showClear
                    />
                  )}

                  {inputs.type === 49 && (
                    <Form.Input
                      field='other'
                      label={t('modals.channels.edit.agentId')}
                      placeholder={t('modals.channels.edit.agentIdPlaceholder')}
                      onChange={(value) => handleInputChange('other', value)}
                      showClear
                    />
                  )}

                  {inputs.type === 1 && (
                    <Form.Input
                      field='openai_organization'
                      label={t('modals.channels.edit.organization')}
                      placeholder={t('modals.channels.edit.organizationPlaceholder')}
                      showClear
                      helpText={t('modals.channels.edit.organizationDesc')}
                      onChange={(value) =>
                        handleInputChange('openai_organization', value)
                      }
                    />
                  )}
                </Card>

                {/* API Configuration Card */}
                {showApiConfigCard && (
                  <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
                    {/* Header: API Config */}
                    <div className='flex items-center mb-2'>
                      <Avatar
                        size='small'
                        color='green'
                        className='mr-2 shadow-md'
                      >
                        <IconGlobe size={16} />
                      </Avatar>
                      <div>
                        <Text className='text-lg font-medium'>
                          {t('modals.channels.edit.apiConfig')}
                        </Text>
                        <div className='text-xs text-gray-600'>
                          {t('modals.channels.edit.apiConfigDesc')}
                        </div>
                      </div>
                    </div>

                    {inputs.type === 40 && (
                      <Banner
                        type='info'
                        description={
                          <div>
                            <Text strong>{t('modals.channels.edit.inviteLink')}:</Text>
                            <Text
                              link
                              underline
                              className='ml-2 cursor-pointer'
                              onClick={() =>
                                window.open(
                                  'https://cloud.siliconflow.cn/i/hij0YNTZ',
                                )
                              }
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
                          description={t('modals.channels.edit.azureApiWarning')}
                          className='!rounded-lg'
                        />
                        <div>
                          <Form.Input
                            field='base_url'
                            label='AZURE_OPENAI_ENDPOINT'
                            placeholder={t('modals.channels.edit.azureEndpointPlaceholder')}
                            onChange={(value) =>
                              handleInputChange('base_url', value)
                            }
                            showClear
                          />
                        </div>
                        <div>
                          <Form.Input
                            field='other'
                            label={t('modals.channels.edit.defaultApiVersion')}
                            placeholder={t('modals.channels.edit.defaultApiVersionPlaceholder')}
                            onChange={(value) =>
                              handleInputChange('other', value)
                            }
                            showClear
                          />
                        </div>
                        <div>
                          <Form.Input
                            field='azure_responses_version'
                            label={t('modals.channels.edit.defaultResponsesApiVersion')}
                            placeholder={t('modals.channels.edit.defaultResponsesApiVersionPlaceholder')}
                            onChange={(value) =>
                              handleChannelOtherSettingsChange(
                                'azure_responses_version',
                                value,
                              )
                            }
                            showClear
                          />
                        </div>
                      </>
                    )}

                    {inputs.type === 8 && (
                      <>
                        <Banner
                          type='warning'
                          description={t('modals.channels.edit.customApiWarning')}
                          className='!rounded-lg'
                        />
                        <div>
                          <Form.Input
                            field='base_url'
                            label={t('modals.channels.edit.customApiBaseUrl')}
                            placeholder={t('modals.channels.edit.customApiBaseUrlPlaceholder')}
                            onChange={(value) =>
                              handleInputChange('base_url', value)
                            }
                            showClear
                          />
                        </div>
                      </>
                    )}

                    {inputs.type === 37 && (
                      <Banner
                        type='warning'
                        description={t('modals.channels.edit.difyWarning')}
                        className='!rounded-lg'
                      />
                    )}

                    {inputs.type !== 3 &&
                      inputs.type !== 8 &&
                      inputs.type !== 22 &&
                      inputs.type !== 36 &&
                      inputs.type !== 45 && (
                        <div>
                          <Form.Input
                            field='base_url'
                            label={t('modals.channels.edit.apiUrl')}
                            placeholder={t('modals.channels.edit.apiUrlPlaceholder')}
                            onChange={(value) =>
                              handleInputChange('base_url', value)
                            }
                            showClear
                            extraText={t('modals.channels.edit.apiUrlDesc')}
                          />
                        </div>
                      )}

                    {inputs.type === 22 && (
                      <div>
                        <Form.Input
                          field='base_url'
                          label={t('modals.channels.edit.privateDeploymentAddress')}
                          placeholder={t('modals.channels.edit.privateDeploymentAddressPlaceholder')}
                          onChange={(value) =>
                            handleInputChange('base_url', value)
                          }
                          showClear
                        />
                      </div>
                    )}

                    {inputs.type === 36 && (
                      <div>
                        <Form.Input
                          field='base_url'
                          label={t('modals.channels.edit.sunoApiAddress')}
                          placeholder={t('modals.channels.edit.sunoApiAddressPlaceholder')}
                          onChange={(value) =>
                            handleInputChange('base_url', value)
                          }
                          showClear
                        />
                      </div>
                    )}

                    {inputs.type === 45 && (
                        <div>
                          <Form.Select
                              field='base_url'
                              label={t('modals.channels.edit.apiUrl')}
                              placeholder={t('modals.channels.edit.apiUrlSelectPlaceholder')}
                              onChange={(value) =>
                                  handleInputChange('base_url', value)
                              }
                              optionList={[
                                {
                                  value: 'https://ark.cn-beijing.volces.com',
                                  label: 'https://ark.cn-beijing.volces.com'
                                },
                                {
                                  value: 'https://ark.ap-southeast.bytepluses.com',
                                  label: 'https://ark.ap-southeast.bytepluses.com'
                                }
                              ]}
                              defaultValue='https://ark.cn-beijing.volces.com'
                          />
                        </div>
                    )}
                  </Card>
                )}

                {/* Model Configuration Card */}
                <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
                  {/* Header: Model Config */}
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='purple'
                      className='mr-2 shadow-md'
                    >
                      <IconCode size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('modals.channels.edit.modelConfig')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('modals.channels.edit.modelConfigDesc')}
                      </div>
                    </div>
                  </div>

                  <Form.Select
                    field='models'
                    label={t('modals.channels.edit.models')}
                    placeholder={t('modals.channels.edit.modelsPlaceholder')}
                    rules={[{ required: true, message: t('modals.channels.edit.modelRequired') }]}
                    multiple
                    filter={selectFilter}
                    autoClearSearchValue={false}
                    searchPosition='dropdown'
                    optionList={modelOptions}
                    style={{ width: '100%' }}
                    onChange={(value) => handleInputChange('models', value)}
                    renderSelectedItem={(optionNode) => {
                      const modelName = String(optionNode?.value ?? '');
                      return {
                        isRenderInTag: true,
                        content: (
                          <span
                            className='cursor-pointer select-none'
                            role='button'
                            tabIndex={0}
                            title={t('modals.channels.edit.copyModelName')}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = await copy(modelName);
                              if (ok) {
                                showSuccess(
                                  t('modals.channels.edit.copied', { name: modelName }),
                                );
                              } else {
                                showError(t('modals.channels.edit.copyFailed'));
                              }
                            }}
                          >
                            {optionNode.label || modelName}
                          </span>
                        ),
                      };
                    }}
                    extraText={
                      <Space wrap>
                        <Button
                          size='small'
                          type='primary'
                          onClick={() =>
                            handleInputChange('models', basicModels)
                          }
                        >
                          {t('modals.channels.edit.fillRelatedModels')}
                        </Button>
                        <Button
                          size='small'
                          type='secondary'
                          onClick={() =>
                            handleInputChange('models', fullModels)
                          }
                        >
                          {t('modals.channels.edit.fillAllModels')}
                        </Button>
                        {MODEL_FETCHABLE_TYPES.has(inputs.type) && (
                          <Button
                            size='small'
                            type='tertiary'
                            onClick={() => fetchUpstreamModelList('models')}
                          >
                            {t('modals.channels.edit.fetchModelList')}
                          </Button>
                        )}
                        <Button
                          size='small'
                          type='warning'
                          onClick={() => handleInputChange('models', [])}
                        >
                          {t('modals.channels.edit.clearAllModels')}
                        </Button>
                        <Button
                          size='small'
                          type='tertiary'
                          onClick={() => {
                            if (inputs.models.length === 0) {
                              showInfo(t('modals.channels.edit.noModelsToCopy'));
                              return;
                            }
                            try {
                              copy(inputs.models.join(','));
                              showSuccess(t('modals.channels.edit.modelListCopied'));
                            } catch (error) {
                              showError(t('modals.channels.edit.copyFailed'));
                            }
                          }}
                        >
                          {t('modals.channels.edit.copyAllModels')}
                        </Button>
                        {modelGroups &&
                          modelGroups.length > 0 &&
                          modelGroups.map((group) => (
                            <Button
                              key={group.id}
                              size='small'
                              type='primary'
                              onClick={() => {
                                let items = [];
                                try {
                                  if (Array.isArray(group.items)) {
                                    items = group.items;
                                  } else if (typeof group.items === 'string') {
                                    const parsed = JSON.parse(
                                      group.items || '[]',
                                    );
                                    if (Array.isArray(parsed)) items = parsed;
                                  }
                                } catch {}
                                const current =
                                  formApiRef.current?.getValue('models') ||
                                  inputs.models ||
                                  [];
                                const merged = Array.from(
                                  new Set(
                                    [...current, ...items]
                                      .map((m) => (m || '').trim())
                                      .filter(Boolean),
                                  ),
                                );
                                handleInputChange('models', merged);
                              }}
                            >
                              {group.name}
                            </Button>
                          ))}
                      </Space>
                    }
                  />

                  <Form.Input
                    field='custom_model'
                    label={t('modals.channels.edit.customModelName')}
                    placeholder={t('modals.channels.edit.customModelNamePlaceholder')}
                    onChange={(value) => setCustomModel(value.trim())}
                    value={customModel}
                    suffix={
                      <Button
                        size='small'
                        type='primary'
                        onClick={addCustomModels}
                      >
                        {t('modals.channels.edit.fill')}
                      </Button>
                    }
                  />

                  <Form.Input
                    field='test_model'
                    label={t('modals.channels.edit.defaultTestModel')}
                    placeholder={t('modals.channels.edit.defaultTestModelPlaceholder')}
                    onChange={(value) => handleInputChange('test_model', value)}
                    showClear
                  />

                  <JSONEditor
                    key={`model_mapping-${isEdit ? channelId : 'new'}`}
                    field='model_mapping'
                    label={t('modals.channels.edit.modelRedirect')}
                    placeholder={t('modals.channels.edit.modelRedirectPlaceholder') + `\n${JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2)}`}
                    value={inputs.model_mapping || ''}
                    onChange={(value) =>
                      handleInputChange('model_mapping', value)
                    }
                    template={MODEL_MAPPING_EXAMPLE}
                    templateLabel={t('modals.channels.edit.fillTemplate')}
                    editorType='keyValue'
                    formApi={formApiRef.current}
                    extraText={t('modals.channels.edit.modelRedirectDesc')}
                  />
                </Card>

                {/* Advanced Settings Card */}
                <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
                  {/* Header: Advanced Settings */}
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='orange'
                      className='mr-2 shadow-md'
                    >
                      <IconSetting size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('modals.channels.edit.advancedSettings')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('modals.channels.edit.advancedSettingsDesc')}
                      </div>
                    </div>
                  </div>

                  <Form.Select
                    field='groups'
                    label={t('modals.channels.edit.group')}
                    placeholder={t('modals.channels.edit.groupPlaceholder')}
                    multiple
                    allowAdditions
                    additionLabel={t('modals.channels.edit.groupAdditionLabel')}
                    optionList={groupOptions}
                    style={{ width: '100%' }}
                    onChange={(value) => handleInputChange('groups', value)}
                  />

                  <Form.Input
                    field='tag'
                    label={t('modals.channels.edit.channelTag')}
                    placeholder={t('modals.channels.edit.channelTagPlaceholder')}
                    showClear
                    onChange={(value) => handleInputChange('tag', value)}
                  />
                  <Form.TextArea
                    field='remark'
                    label={t('modals.channels.edit.remark')}
                    placeholder={t('modals.channels.edit.remarkPlaceholder')}
                    maxLength={255}
                    showClear
                    onChange={(value) => handleInputChange('remark', value)}
                  />

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.InputNumber
                        field='priority'
                        label={t('modals.channels.edit.channelPriority')}
                        placeholder={t('modals.channels.edit.channelPriorityPlaceholder')}
                        min={0}
                        onNumberChange={(value) =>
                          handleInputChange('priority', value)
                        }
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={12}>
                      <Form.InputNumber
                        field='weight'
                        label={t('modals.channels.edit.channelWeight')}
                        placeholder={t('modals.channels.edit.channelWeightPlaceholder')}
                        min={0}
                        onNumberChange={(value) =>
                          handleInputChange('weight', value)
                        }
                        style={{ width: '100%' }}
                      />
                    </Col>
                  </Row>

                  <Form.Switch
                    field='auto_ban'
                    label={t('modals.channels.edit.autoDisable')}
                    checkedText={t('modals.channels.edit.on')}
                    uncheckedText={t('modals.channels.edit.off')}
                    onChange={(value) => setAutoBan(value)}
                    extraText={t('modals.channels.edit.autoDisableDesc')}
                    initValue={autoBan}
                  />

                  <Form.TextArea
                    field='param_override'
                    label={t('modals.channels.edit.paramOverride')}
                    placeholder={
                      t('modals.channels.edit.paramOverridePlaceholder.intro') +
                      '\n' +
                      t('modals.channels.edit.paramOverridePlaceholder.oldFormat') +
                      '\n{\n  "temperature": 0,\n  "max_tokens": 1000\n}' +
                      '\n\n' +
                      t('modals.channels.edit.paramOverridePlaceholder.newFormat') +
                      '\n{\n  "operations": [\n    {\n      "path": "temperature",\n      "mode": "set",\n      "value": 0.7,\n      "conditions": [\n        {\n          "path": "model",\n          "mode": "prefix",\n          "value": "gpt"\n        }\n      ]\n    }\n  ]\n}'
                    }
                    autosize
                    onChange={(value) =>
                      handleInputChange('param_override', value)
                    }
                    extraText={
                      <div className='flex gap-2 flex-wrap'>
                        <Text
                          className='!text-semi-color-primary cursor-pointer'
                          onClick={() =>
                            handleInputChange(
                              'param_override',
                              JSON.stringify({ temperature: 0 }, null, 2),
                            )
                          }
                        >
                          {t('modals.channels.edit.oldFormatTemplate')}
                        </Text>
                        <Text
                          className='!text-semi-color-primary cursor-pointer'
                          onClick={() =>
                            handleInputChange(
                              'param_override',
                              JSON.stringify(
                                {
                                  operations: [
                                    {
                                      path: 'temperature',
                                      mode: 'set',
                                      value: 0.7,
                                      conditions: [
                                        {
                                          path: 'model',
                                          mode: 'prefix',
                                          value: 'gpt',
                                        },
                                      ],
                                      logic: 'AND',
                                    },
                                  ],
                                },
                                null,
                                2,
                              ),
                            )
                          }
                        >
                          {t('modals.channels.edit.newFormatTemplate')}
                        </Text>
                      </div>
                    }
                    showClear
                  />

                  <Form.TextArea
                    field='header_override'
                    label={t('modals.channels.edit.headerOverride')}
                    placeholder={
                      t('modals.channels.edit.headerOverridePlaceholder.intro') +
                      '\n' +
                      t('modals.channels.edit.headerOverridePlaceholder.example') +
                      '\n{\n  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0"\n}'
                    }
                    autosize
                    onChange={(value) =>
                      handleInputChange('header_override', value)
                    }
                    extraText={
                      <div className='flex gap-2 flex-wrap'>
                        <Text
                          className='!text-semi-color-primary cursor-pointer'
                          onClick={() =>
                            handleInputChange(
                              'header_override',
                              JSON.stringify(
                                {
                                  'User-Agent':
                                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
                                },
                                null,
                                2,
                              ),
                            )
                          }
                        >
                          {t('modals.channels.edit.formatTemplate')}
                        </Text>
                      </div>
                    }
                    showClear
                  />

                  <JSONEditor
                    key={`status_code_mapping-${isEdit ? channelId : 'new'}`}
                    field='status_code_mapping'
                    label={t('modals.channels.edit.statusCodeRewrite')}
                    placeholder={
                      t('modals.channels.edit.statusCodeRewritePlaceholder') +
                      '\n' +
                      JSON.stringify(STATUS_CODE_MAPPING_EXAMPLE, null, 2)
                    }
                    value={inputs.status_code_mapping || ''}
                    onChange={(value) =>
                      handleInputChange('status_code_mapping', value)
                    }
                    template={STATUS_CODE_MAPPING_EXAMPLE}
                    templateLabel={t('modals.channels.edit.fillTemplate')}
                    editorType='keyValue'
                    formApi={formApiRef.current}
                    extraText={t('modals.channels.edit.statusCodeRewriteDesc')}
                  />
                </Card>

                {/* Channel Extra Settings Card */}
                <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
                  {/* Header: Channel Extra Settings */}
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='violet'
                      className='mr-2 shadow-md'
                    >
                      <IconBolt size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('modals.channels.edit.channelExtraSettings')}
                      </Text>
                    </div>
                  </div>

                  {inputs.type === 1 && (
                    <Form.Switch
                      field='force_format'
                      label={t('modals.channels.edit.forceFormat')}
                      checkedText={t('modals.channels.edit.on')}
                      uncheckedText={t('modals.channels.edit.off')}
                      onChange={(value) =>
                        handleChannelSettingsChange('force_format', value)
                      }
                      extraText={t('modals.channels.edit.forceFormatDesc')}
                    />
                  )}

                  <Form.Switch
                    field='thinking_to_content'
                    label={t('modals.channels.edit.thinkingToContent')}
                    checkedText={t('modals.channels.edit.on')}
                    uncheckedText={t('modals.channels.edit.off')}
                    onChange={(value) =>
                      handleChannelSettingsChange('thinking_to_content', value)
                    }
                    extraText={t('modals.channels.edit.thinkingToContentDesc')}
                  />

                  <Form.Switch
                    field='pass_through_body_enabled'
                    label={t('modals.channels.edit.passThroughBody')}
                    checkedText={t('modals.channels.edit.on')}
                    uncheckedText={t('modals.channels.edit.off')}
                    onChange={(value) =>
                      handleChannelSettingsChange(
                        'pass_through_body_enabled',
                        value,
                      )
                    }
                    extraText={t('modals.channels.edit.passThroughBodyDesc')}
                  />

                  <Form.Input
                    field='proxy'
                    label={t('modals.channels.edit.proxyAddress')}
                    placeholder={t('modals.channels.edit.proxyAddressPlaceholder')}
                    onChange={(value) =>
                      handleChannelSettingsChange('proxy', value)
                    }
                    showClear
                    extraText={t('modals.channels.edit.proxyAddressDesc')}
                  />

                  <Form.TextArea
                    field='system_prompt'
                    label={t('modals.channels.edit.systemPrompt')}
                    placeholder={t('modals.channels.edit.systemPromptPlaceholder')}
                    onChange={(value) =>
                      handleChannelSettingsChange('system_prompt', value)
                    }
                    autosize
                    showClear
                    extraText={t('modals.channels.edit.systemPromptDesc')}
                  />
                  <Form.Switch
                    field='system_prompt_override'
                    label={t('modals.channels.edit.systemPromptOverride')}
                    checkedText={t('modals.channels.edit.on')}
                    uncheckedText={t('modals.channels.edit.off')}
                    onChange={(value) =>
                      handleChannelSettingsChange(
                        'system_prompt_override',
                        value,
                      )
                    }
                    extraText={t('modals.channels.edit.systemPromptOverrideDesc')}
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
      {/* 使用TwoFactorAuthModal组件进行2FA验证 */}
      <TwoFactorAuthModal
        visible={show2FAVerifyModal}
        code={verifyCode}
        loading={verifyLoading}
        onCodeChange={setVerifyCode}
        onVerify={handleVerify2FA}
        onCancel={reset2FAVerifyState}
        title={t('modals.channels.edit.viewChannelKey')}
        description={t('modals.channels.edit.twoFactorAuthDescription')}
        placeholder={t('modals.channels.edit.twoFactorAuthPlaceholder')}
      />

      {/* 使用ChannelKeyDisplay组件显示密钥 */}
      <Modal
        title={
          <div className='flex items-center'>
            <div className='w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mr-3'>
              <svg
                className='w-4 h-4 text-green-600 dark:text-green-400'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            {t('modals.channels.edit.channelKeyInfo')}
          </div>
        }
        visible={twoFAState.showModal && twoFAState.showKey}
        onCancel={resetTwoFAState}
        footer={
          <Button type='primary' onClick={resetTwoFAState}>
            {t('modals.channels.edit.done')}
          </Button>
        }
        width={700}
        style={{ maxWidth: '90vw' }}
      >
        <ChannelKeyDisplay
          keyData={twoFAState.keyData}
          showSuccessIcon={true}
          successText={t('modals.channels.edit.keyFetchSuccess')}
          showWarning={true}
          warningText={t('modals.channels.edit.keyWarning')}
        />
      </Modal>

      <ModelSelectModal
        visible={modelModalVisible}
        models={fetchedModels}
        selected={inputs.models}
        onConfirm={(selectedModels) => {
          handleInputChange('models', selectedModels);
          showSuccess(t('modals.channels.edit.modelListUpdated'));
          setModelModalVisible(false);
        }}
        onCancel={() => setModelModalVisible(false)}
      />
    </>
  );
};

export default EditChannelModal;
