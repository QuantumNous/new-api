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
import SecureVerificationModal from '../../../common/modals/SecureVerificationModal';
import ChannelKeyDisplay from '../../../common/ui/ChannelKeyDisplay';
import { useSecureVerification } from '../../../../hooks/common/useSecureVerification';
import { createApiCalls } from '../../../../services/secureVerification';
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
  43,
]);

function type2secretPrompt(type) {
  // inputs.type === 15 ? '按照如下格式输入：APIKey|SecretKey' : (inputs.type === 18 ? '按照如下格式输入：APPID|APISecret|APIKey' : '请输入渠道对应的鉴权密钥')
  switch (type) {
    case 15:
      return 'channel.editModal.secretPrompt.apiKeySecretKey';
    case 18:
      return 'channel.editModal.secretPrompt.appCredentials';
    case 22:
      return 'channel.editModal.secretPrompt.apiKeyAppId';
    case 23:
      return 'channel.editModal.secretPrompt.tencent';
    case 33:
      return 'channel.editModal.secretPrompt.akSkRegion';
    case 50:
      return 'channel.editModal.secretPrompt.accessKeySecret';
    case 51:
      return 'channel.editModal.secretPrompt.accessKeyId';
    default:
      return 'channel.editModal.secretPrompt.generic';
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

  // 密钥显示状态
  const [keyDisplayState, setKeyDisplayState] = useState({
    showModal: false,
    keyData: '',
  });

  // 使用通用安全验证 Hook
  const {
    isModalVisible,
    verificationMethods,
    verificationState,
    withVerification,
    executeVerification,
    cancelVerification,
    setVerificationCode,
    switchVerificationMethod,
  } = useSecureVerification({
    onSuccess: (result) => {
      // 验证成功后显示密钥
      console.log('Verification success, result:', result);
      if (result && result.success && result.data?.key) {
        showSuccess(t('channel.editModal.keyFetchSuccess'));
        setKeyDisplayState({
          showModal: true,
          keyData: result.data.key,
        });
      } else if (result && result.key) {
        // 直接返回了 key（没有包装在 data 中）
        showSuccess(t('channel.editModal.keyFetchSuccess'));
        setKeyDisplayState({
          showModal: true,
          keyData: result.key,
        });
      }
    },
  });

  // 重置密钥显示状态
  const resetKeyDisplayState = () => {
    setKeyDisplayState({
      showModal: false,
      keyData: '',
    });
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
        title: t('channel.editModal.warningTitle'),
        content: t('channel.editModal.trailingV1Warning'),
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
          console.error('解析渠道设置失败:', error);
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
          console.error('解析其他设置失败:', error);
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

      if (
        data.type === 45 &&
        (!data.base_url ||
          (typeof data.base_url === 'string' && data.base_url.trim() === ''))
      ) {
        data.base_url = 'https://ark.cn-beijing.volces.com';
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
    //   showError(t('channel.editModal.openAiOnly'));
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
        showError(t('channel.editModal.enterKey'));
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
      showError(t('channel.editModal.fetchModelsFailed'));
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

  // 查看渠道密钥（透明验证）
  const handleShow2FAModal = async () => {
    try {
      // 使用 withVerification 包装，会自动处理需要验证的情况
      const result = await withVerification(
        createApiCalls.viewChannelKey(channelId),
        {
          title: t('channel.editModal.viewChannelKey'),
          description: t('channel.editModal.verifyIdentityNotice'),
          preferredMethod: 'passkey', // 优先使用 Passkey
        }
      );

      // 如果直接返回了结果（已验证），显示密钥
      if (result && result.success && result.data?.key) {
        showSuccess(t('channel.editModal.keyFetchSuccess'));
        setKeyDisplayState({
          showModal: true,
          keyData: result.data.key,
        });
      }
    } catch (error) {
      console.error('Failed to view channel key:', error);
      showError(error.message || t('channel.editModal.fetchKeyFailed'));
    }
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
    // 重置密钥显示状态
    resetKeyDisplayState();
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
          t('channel.editModal.parseFileFailed', {
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
          showInfo(t('channel.editModal.enterKeyAlert'));
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
              showError(t('channel.editModal.invalidJsonKey'));
              return;
            }
          } else if (!isEdit) {
            showInfo(t('channel.editModal.enterKeyAlert'));
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
              showError(t('channel.editModal.parseKeyFileFailed', { msg: err.message }));
              return;
            }
          }
          if (keys.length === 0) {
            if (!isEdit) {
              showInfo(t('channel.editModal.uploadKeyFileAlert'));
              return;
            } else {
              delete localInputs.key;
            }
          } else {
            localInputs.key = batch
              ? JSON.stringify(keys)
              : JSON.stringify(keys[0]);
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
      showInfo(t('channel.editModal.enterNameAndKey'));
      return;
    }
    if (!Array.isArray(localInputs.models) || localInputs.models.length === 0) {
      showInfo(t('channel.editModal.selectAtLeastOneModel'));
      return;
    }
    if (localInputs.type === 45 && (!localInputs.base_url || localInputs.base_url.trim() === '')) {
      showInfo(t('channel.editModal.enterApiUrl'));
      return;
    }
    if (
      localInputs.model_mapping &&
      localInputs.model_mapping !== '' &&
      !verifyJSON(localInputs.model_mapping)
    ) {
      showInfo(t('channel.editModal.modelMappingMustBeJson'));
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
          console.error('解析settings失败:', error);
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
        showSuccess(t('channel.editModal.updateSuccess'));
      } else {
        showSuccess(t('channel.editModal.createSuccess'));
        setInputs(originInputs);
      }
      props.refresh();
      props.handleClose();
    } else {
      showError(message);
    }
  };

  // 密钥去重函数
  const deduplicateKeys = () => {
    const currentKey = formApiRef.current?.getValue('key') || inputs.key || '';

    if (!currentKey.trim()) {
      showInfo(t('channel.editModal.enterKeyFirst'));
      return;
    }

    // 按行分割密钥
    const keyLines = currentKey.split('\n');
    const beforeCount = keyLines.length;

    // 使用哈希表去重，保持原有顺序
    const keySet = new Set();
    const deduplicatedKeys = [];

    keyLines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine && !keySet.has(trimmedLine)) {
        keySet.add(trimmedLine);
        deduplicatedKeys.push(trimmedLine);
      }
    });

    const afterCount = deduplicatedKeys.length;
    const deduplicatedKeyText = deduplicatedKeys.join('\n');

    // 更新表单和状态
    if (formApiRef.current) {
      formApiRef.current.setValue('key', deduplicatedKeyText);
    }
    handleInputChange('key', deduplicatedKeyText);

    // 显示去重结果
    const message = t('channel.editModal.deduplicateResult', {
      before: beforeCount,
      after: afterCount,
    });

    if (beforeCount === afterCount) {
      showInfo(t('channel.editModal.noDuplicateKeys'));
    } else {
      showSuccess(message);
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
        t('channel.editModal.addedModels', {
          count: addedModels.length,
          list: addedModels.join(', '),
        }),
      );
    } else {
      showInfo(t('channel.editModal.noNewModels'));
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
                title: t('channel.editModal.switchToSingleKeyTitle'),
                content: t('channel.editModal.keepFirstKeyFileConfirm'),
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
          {t('channel.editModal.batchCreate')}
        </Checkbox>
      )}
      {batch && (
        <>
          <Checkbox
            disabled={isEdit}
            checked={multiToSingle}
            onChange={() => {
              setMultiToSingle((prev) => {
                const nextValue = !prev;
                setInputs((prevInputs) => {
                  const newInputs = { ...prevInputs };
                  if (nextValue) {
                    newInputs.multi_key_mode = multiKeyMode;
                  } else {
                    delete newInputs.multi_key_mode;
                  }
                  return newInputs;
                });
                return nextValue;
              });
            }}
          >
            {t('channel.editModal.keyAggregationMode')}
          </Checkbox>

          {inputs.type !== 41 && (
            <Button
              size='small'
              type='tertiary'
              theme='outline'
              onClick={deduplicateKeys}
              style={{ textDecoration: 'underline' }}
            >
              {t('channel.editModal.deduplicateKeys')}
            </Button>
          )}
        </>
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
              {isEdit ? t('channel.editModal.edit') : t('channel.editModal.create')}
            </Tag>
            <Title heading={4} className='m-0'>
              {isEdit ? t('channel.editModal.updateChannelInfo') : t('channel.editModal.createNewChannel')}
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
                {t('channel.editModal.submit')}
              </Button>
              <Button
                theme='light'
                type='primary'
                onClick={handleCancel}
                icon={<IconClose />}
              >
                {t('channel.editModal.cancel')}
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
                        {t('channel.editModal.basicInfoTitle')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('channel.editModal.basicInfoDescription')}
                      </div>
                    </div>
                  </div>

                  <Form.Select
                    field='type'
                    label={t('channel.editModal.type')}
                    placeholder={t('channel.editModal.selectChannelType')}
                    rules={[{ required: true, message: t('channel.editModal.selectChannelType') }]}
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
                      label={t('channel.editModal.isEnterpriseAccount')}
                      checkedText={t('channel.editModal.yes')}
                      uncheckedText={t('channel.editModal.no')}
                      onChange={(value) => {
                        setIsEnterpriseAccount(value);
                        handleInputChange('is_enterprise_account', value);
                      }}
                      extraText={t('channel.editModal.enterpriseAccountHint')}
                      initValue={inputs.is_enterprise_account}
                    />
                  )}

                  <Form.Input
                    field='name'
                    label={t('channel.editModal.name')}
                    placeholder={t('channel.editModal.enterChannelName')}
                    rules={[{ required: true, message: t('channel.editModal.enterChannelName') }]}
                    showClear
                    onChange={(value) => handleInputChange('name', value)}
                    autoComplete='new-password'
                  />

                  {inputs.type === 41 && (
                    <Form.Select
                      field='vertex_key_type'
                      label={t('channel.editModal.keyFormat')}
                      placeholder={t('channel.editModal.selectKeyFormat')}
                      optionList={[
                        { label: 'JSON', value: 'json' },
                        { label: 'API Key', value: 'api_key' },
                      ]}
                      style={{ width: '100%' }}
                      value={inputs.vertex_key_type || 'json'}
                      onChange={(value) => {
                        // 更新设置中的 vertex_key_type
                        handleChannelOtherSettingsChange(
                          'vertex_key_type',
                          value,
                        );
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
                          ? t('channel.editModal.apiKeyModeBatchDisabled')
                          : t('channel.editModal.jsonModeInfo')
                      }
                    />
                  )}
                  {batch ? (
                    inputs.type === 41 &&
                    (inputs.vertex_key_type || 'json') === 'json' ? (
                      <Form.Upload
                        field='vertex_files'
                        label={t('channel.editModal.keyFileLabel')}
                        accept='.json'
                        multiple
                        draggable
                        dragIcon={<IconBolt />}
                        dragMainText={t('channel.editModal.uploadDragMain')}
                        dragSubText={t('channel.editModal.uploadDragSubMultiple')}
                        style={{ marginTop: 10 }}
                        uploadTrigger='custom'
                        beforeUpload={() => false}
                        onChange={handleVertexUploadChange}
                        fileList={vertexFileList}
                        rules={
                          isEdit
                            ? []
                            : [{ required: true, message: t('channel.editModal.uploadKeyFile') }]
                        }
                        extraText={batchExtra}
                      />
                    ) : (
                      <Form.TextArea
                        field='key'
                        label={t('channel.editModal.keyLabel')}
                        placeholder={t('channel.editModal.keyPlaceholderMulti')}
                        rules={
                          isEdit
                            ? []
                            : [{ required: true, message: t('channel.editModal.enterKeyMessage') }]
                        }
                        autosize
                        autoComplete='new-password'
                        onChange={(value) => handleInputChange('key', value)}
                        extraText={
                          <div className='flex items-center gap-2 flex-wrap'>
                            {isEdit &&
                              isMultiKeyChannel &&
                              keyMode === 'append' && (
                                <Text type='warning' size='small'>
                                  {t('channel.editModal.appendModeDescription')}
                                </Text>
                              )}
                            {isEdit && (
                              <Button
                                size='small'
                                type='primary'
                                theme='outline'
                                onClick={handleShow2FAModal}
                              >
                                {t('channel.editModal.viewKey')}
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
                      {inputs.type === 41 &&
                      (inputs.vertex_key_type || 'json') === 'json' ? (
                        <>
                          {!batch && (
                            <div className='flex items-center justify-between mb-3'>
                              <Text className='text-sm font-medium'>
                                {t('channel.editModal.keyInputMethod')}
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
                                  {t('channel.editModal.fileUpload')}
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
                                  {t('channel.editModal.manualInput')}
                                </Button>
                              </Space>
                            </div>
                          )}

                          {batch && (
                            <Banner
                              type='info'
                              description={t('channel.editModal.batchModeFileOnly')}
                              className='!rounded-lg mb-3'
                            />
                          )}

                          {useManualInput && !batch ? (
                            <Form.TextArea
                              field='key'
                              label={
                                isEdit
                                  ? t('channel.editModal.keyHiddenInEdit')
                                  : t('channel.editModal.keyLabel')
                              }
                              placeholder={t('channel.editModal.vertexManualPlaceholder')}
                              rules={
                                isEdit
                                  ? []
                                  : [
                                      {
                                        required: true,
                                        message: t('channel.editModal.enterKeyMessage'),
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
                                    {t('channel.editModal.enterFullJsonKey')}
                                  </Text>
                                  {isEdit &&
                                    isMultiKeyChannel &&
                                    keyMode === 'append' && (
                                      <Text type='warning' size='small'>
                                        {t('channel.editModal.appendModeDescription')}
                                      </Text>
                                    )}
                                  {isEdit && (
                                    <Button
                                      size='small'
                                      type='primary'
                                      theme='outline'
                                      onClick={handleShow2FAModal}
                                    >
                                      {t('channel.editModal.viewKey')}
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
                              label={t('channel.editModal.keyFileLabel')}
                              accept='.json'
                              draggable
                              dragIcon={<IconBolt />}
                              dragMainText={t('channel.editModal.uploadDragMain')}
                              dragSubText={t('channel.editModal.uploadDragSub')}
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
                                        message: t('channel.editModal.uploadKeyFile'),
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
                              ? t('channel.editModal.keyHiddenInEdit')
                              : t('channel.editModal.keyLabel')
                          }
                          placeholder={t(type2secretPrompt(inputs.type))}
                          rules={
                            isEdit
                              ? []
                              : [{ required: true, message: t('channel.editModal.enterKeyMessage') }]
                          }
                          autoComplete='new-password'
                          onChange={(value) => handleInputChange('key', value)}
                          extraText={
                            <div className='flex items-center gap-2'>
                              {isEdit &&
                                isMultiKeyChannel &&
                                keyMode === 'append' && (
                                  <Text type='warning' size='small'>
                                    {t('channel.editModal.appendModeDescription')}
                                  </Text>
                                )}
                              {isEdit && (
                                <Button
                                  size='small'
                                  type='primary'
                                  theme='outline'
                                  onClick={handleShow2FAModal}
                                >
                                  {t('channel.editModal.viewKey')}
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
                      label={t('channel.editModal.keyUpdateMode')}
                      placeholder={t('channel.editModal.selectKeyUpdateMode')}
                      optionList={[
                        { label: t('channel.editModal.appendExistingKeys'), value: 'append' },
                        { label: t('channel.editModal.replaceExistingKeys'), value: 'replace' },
                      ]}
                      style={{ width: '100%' }}
                      value={keyMode}
                      onChange={(value) => setKeyMode(value)}
                      extraText={
                        <Text type='tertiary' size='small'>
                          {keyMode === 'replace'
                            ? t('channel.editModal.replaceModeDescription')
                            : t('channel.editModal.appendModeDescription')}
                        </Text>
                      }
                    />
                  )}
                  {batch && multiToSingle && (
                    <>
                      <Form.Select
                        field='multi_key_mode'
                        label={t('channel.editModal.keyAggregationMode')}
                        placeholder={t('channel.editModal.selectMultiKeyStrategy')}
                        optionList={[
                          { label: t('channel.editModal.randomMode'), value: 'random' },
                          { label: t('channel.editModal.pollingMode'), value: 'polling' },
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
                          description={t('channel.editModal.pollingModeWarning')}
                          className='!rounded-lg mt-2'
                        />
                      )}
                    </>
                  )}

                  {inputs.type === 18 && (
                    <Form.Input
                      field='other'
                      label={t('channel.editModal.modelVersion')}
                      placeholder={
                        t('channel.editModal.sparkModelVersionPlaceholder')
                      }
                      onChange={(value) => handleInputChange('other', value)}
                      showClear
                    />
                  )}

                  {inputs.type === 41 && (
                    <JSONEditor
                      key={`region-${isEdit ? channelId : 'new'}`}
                      field='other'
                      label={t('channel.editModal.regionLabel')}
                      placeholder={t('channel.editModal.regionPlaceholder')}
                      value={inputs.other || ''}
                      onChange={(value) => handleInputChange('other', value)}
                      rules={[{ required: true, message: t('channel.editModal.enterRegion') }]}
                      template={REGION_EXAMPLE}
                      templateLabel={t('channel.editModal.fillTemplate')}
                      editorType='region'
                      formApi={formApiRef.current}
                      extraText={t('channel.editModal.regionExtra')}
                    />
                  )}

                  {inputs.type === 21 && (
                    <Form.Input
                      field='other'
                      label={t('channel.editModal.knowledgeBaseId')}
                      placeholder={t('channel.editModal.knowledgeBasePlaceholder')}
                      onChange={(value) => handleInputChange('other', value)}
                      showClear
                    />
                  )}

                  {inputs.type === 39 && (
                    <Form.Input
                      field='other'
                      label={t('channel.editModal.accountIdLabel')}
                      placeholder={
                        t('channel.editModal.accountIdPlaceholder')
                      }
                      onChange={(value) => handleInputChange('other', value)}
                      showClear
                    />
                  )}

                  {inputs.type === 49 && (
                    <Form.Input
                      field='other'
                      label={t('channel.editModal.agentId')}
                      placeholder={t('channel.editModal.agentIdPlaceholder')}
                      onChange={(value) => handleInputChange('other', value)}
                      showClear
                    />
                  )}

                  {inputs.type === 1 && (
                    <Form.Input
                      field='openai_organization'
                      label={t('channel.editModal.organization')}
                      placeholder={t('channel.editModal.organizationPlaceholder')}
                      showClear
                      helpText={t('channel.editModal.organizationHelp')}
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
                          {t('channel.editModal.apiConfigTitle')}
                        </Text>
                        <div className='text-xs text-gray-600'>
                          {t('channel.editModal.apiConfigDescription')}
                        </div>
                      </div>
                    </div>

                    {inputs.type === 40 && (
                      <Banner
                        type='info'
                        description={
                          <div>
                            <Text strong>{t('channel.editModal.inviteLink')}:</Text>
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
                          description={t('channel.editModal.azureModelNote')}
                          className='!rounded-lg'
                        />
                        <div>
                          <Form.Input
                            field='base_url'
                            label='AZURE_OPENAI_ENDPOINT'
                            placeholder={t('channel.editModal.azureEndpointPlaceholder')}
                            onChange={(value) =>
                              handleInputChange('base_url', value)
                            }
                            showClear
                          />
                        </div>
                        <div>
                          <Form.Input
                            field='other'
                            label={t('channel.editModal.defaultApiVersion')}
                            placeholder={t('channel.editModal.defaultApiVersionPlaceholder')}
                            onChange={(value) =>
                              handleInputChange('other', value)
                            }
                            showClear
                          />
                        </div>
                        <div>
                          <Form.Input
                            field='azure_responses_version'
                            label={t('channel.editModal.responsesVersionLabel')}
                            placeholder={t('channel.editModal.previewExample')}
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
                          description={t('channel.editModal.thirdPartyWarning')}
                          className='!rounded-lg'
                        />
                        <div>
                          <Form.Input
                            field='base_url'
                            label={t('channel.editModal.fullBaseUrlLabel')}
                            placeholder={t('channel.editModal.fullUrlPlaceholder')}
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
                        description={t('channel.editModal.difyWarning')}
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
                            label={t('channel.editModal.apiAddress')}
                            placeholder={t('channel.editModal.customApiPlaceholder')}
                            onChange={(value) =>
                              handleInputChange('base_url', value)
                            }
                            showClear
                            extraText={t('channel.editModal.customApiExtra')}
                          />
                        </div>
                      )}

                    {inputs.type === 22 && (
                      <div>
                        <Form.Input
                          field='base_url'
                          label={t('channel.editModal.privateDeploymentUrl')}
                          placeholder={t('channel.editModal.privateDeploymentPlaceholder')}
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
                          label={t('channel.editModal.nonChatWarningLabel')}
                          placeholder={t('channel.editModal.nonChatPlaceholder')}
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
                              label={t('channel.editModal.apiAddress')}
                              placeholder={t('channel.editModal.selectApiAddress')}
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
                        {t('channel.editModal.modelConfigTitle')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('channel.editModal.modelConfigDescription')}
                      </div>
                    </div>
                  </div>

                  <Form.Select
                    field='models'
                    label={t('channel.editModal.modelLabel')}
                    placeholder={t('channel.editModal.selectSupportedModels')}
                    rules={[{ required: true, message: t('channel.editModal.selectModel') }]}
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
                            title={t('channel.editModal.copyModelNameTooltip')}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = await copy(modelName);
                              if (ok) {
                                showSuccess(
                                  t('channel.editModal.copiedModelName', { name: modelName }),
                                );
                              } else {
                                showError(t('channel.editModal.copyFailed'));
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
                          {t('channel.editModal.fillRelatedModels')}
                        </Button>
                        <Button
                          size='small'
                          type='secondary'
                          onClick={() =>
                            handleInputChange('models', fullModels)
                          }
                        >
                          {t('channel.editModal.fillAllModels')}
                        </Button>
                        {MODEL_FETCHABLE_TYPES.has(inputs.type) && (
                          <Button
                            size='small'
                            type='tertiary'
                            onClick={() => fetchUpstreamModelList('models')}
                          >
                            {t('channel.editModal.fetchModelList')}
                          </Button>
                        )}
                        <Button
                          size='small'
                          type='warning'
                          onClick={() => handleInputChange('models', [])}
                        >
                          {t('channel.editModal.clearAllModels')}
                        </Button>
                        <Button
                          size='small'
                          type='tertiary'
                          onClick={() => {
                            if (inputs.models.length === 0) {
                              showInfo(t('channel.editModal.noModelsToCopy'));
                              return;
                            }
                            try {
                              copy(inputs.models.join(','));
                              showSuccess(t('channel.editModal.modelsCopied'));
                            } catch (error) {
                              showError(t('channel.editModal.copyFailed'));
                            }
                          }}
                        >
                          {t('channel.editModal.copyAllModels')}
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
                    label={t('channel.editModal.customModelName')}
                    placeholder={t('channel.editModal.customModelPlaceholder')}
                    onChange={(value) => setCustomModel(value.trim())}
                    value={customModel}
                    suffix={
                      <Button
                        size='small'
                        type='primary'
                        onClick={addCustomModels}
                      >
                        {t('channel.editModal.fill')}
                      </Button>
                    }
                  />

                  <Form.Input
                    field='test_model'
                    label={t('channel.editModal.defaultTestModel')}
                    placeholder={t('channel.editModal.defaultTestModelPlaceholder')}
                    onChange={(value) => handleInputChange('test_model', value)}
                    showClear
                  />

                  <JSONEditor
                    key={`model_mapping-${isEdit ? channelId : 'new'}`}
                    field='model_mapping'
                    label={t('channel.editModal.modelRedirect')}
                    placeholder={
                      t('channel.editModal.modelRedirectDescription') + `\n${JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2)}`
                    }
                    value={inputs.model_mapping || ''}
                    onChange={(value) =>
                      handleInputChange('model_mapping', value)
                    }
                    template={MODEL_MAPPING_EXAMPLE}
                    templateLabel={t('channel.editModal.fillTemplate')}
                    editorType='keyValue'
                    formApi={formApiRef.current}
                    extraText={t('channel.editModal.modelRedirectExtra')}
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
                        {t('channel.editModal.advancedSettingsTitle')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('channel.editModal.advancedSettingsDescription')}
                      </div>
                    </div>
                  </div>

                  <Form.Select
                    field='groups'
                    label={t('channel.editModal.groupsLabel')}
                    placeholder={t('channel.editModal.selectGroupsPlaceholder')}
                    multiple
                    allowAdditions
                    additionLabel={t('channel.editModal.groupEditHint')}
                    optionList={groupOptions}
                    style={{ width: '100%' }}
                    onChange={(value) => handleInputChange('groups', value)}
                  />

                  <Form.Input
                    field='tag'
                    label={t('channel.editModal.channelTag')}
                    placeholder={t('channel.editModal.channelTag')}
                    showClear
                    onChange={(value) => handleInputChange('tag', value)}
                  />
                  <Form.TextArea
                    field='remark'
                    label={t('channel.editModal.remark')}
                    placeholder={t('channel.editModal.remarkPlaceholder')}
                    maxLength={255}
                    showClear
                    onChange={(value) => handleInputChange('remark', value)}
                  />

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.InputNumber
                        field='priority'
                        label={t('channel.editModal.channelPriority')}
                        placeholder={t('channel.editModal.channelPriority')}
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
                        label={t('channel.editModal.channelWeight')}
                        placeholder={t('channel.editModal.channelWeight')}
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
                    label={t('channel.editModal.autoBanLabel')}
                    checkedText={t('channel.editModal.toggleOn')}
                    uncheckedText={t('channel.editModal.toggleOff')}
                    onChange={(value) => setAutoBan(value)}
                    extraText={t('channel.editModal.autoBanHint')}
                    initValue={autoBan}
                  />

                  <Form.TextArea
                    field='param_override'
                    label={t('channel.editModal.paramOverride')}
                    placeholder={
                      t('channel.editModal.paramOverrideDescription') +
                      '\n' +
                      t('channel.editModal.paramOverrideOldFormat') +
                      '\n{\n  "temperature": 0,\n  "max_tokens": 1000\n}' +
                      '\n\n' +
                      t('channel.editModal.paramOverrideNewFormat') +
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
                          {t('channel.editModal.oldFormatTemplate')}
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
                          {t('channel.editModal.newFormatTemplate')}
                        </Text>
                      </div>
                    }
                    showClear
                  />

                  <Form.TextArea
                    field='header_override'
                    label={t('channel.editModal.headerOverride')}
                    placeholder={
                      t('channel.editModal.headerOverrideDescription') +
                      '\n' +
                      t('channel.editModal.formatExample') +
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
                          {t('channel.editModal.formatTemplate')}
                        </Text>
                      </div>
                    }
                    showClear
                  />

                  <JSONEditor
                    key={`status_code_mapping-${isEdit ? channelId : 'new'}`}
                    field='status_code_mapping'
                    label={t('channel.editModal.statusCodeOverride')}
                    placeholder={
                      t('channel.editModal.statusCodeOverrideDescription') +
                      '\n' +
                      JSON.stringify(STATUS_CODE_MAPPING_EXAMPLE, null, 2)
                    }
                    value={inputs.status_code_mapping || ''}
                    onChange={(value) =>
                      handleInputChange('status_code_mapping', value)
                    }
                    template={STATUS_CODE_MAPPING_EXAMPLE}
                    templateLabel={t('channel.editModal.fillTemplate')}
                    editorType='keyValue'
                    formApi={formApiRef.current}
                    extraText={t('channel.editModal.statusCodeOverrideExtra')}
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
                        {t('channel.editModal.extraSettingsTitle')}
                      </Text>
                    </div>
                  </div>

                  {inputs.type === 1 && (
                    <Form.Switch
                      field='force_format'
                      label={t('channel.editModal.forceFormat')}
                      checkedText={t('channel.editModal.toggleOn')}
                      uncheckedText={t('channel.editModal.toggleOff')}
                      onChange={(value) =>
                        handleChannelSettingsChange('force_format', value)
                      }
                      extraText={t('channel.editModal.forceFormatDescription')}
                    />
                  )}

                  <Form.Switch
                    field='thinking_to_content'
                    label={t('channel.editModal.thinkingToContent')}
                    checkedText={t('channel.editModal.toggleOn')}
                    uncheckedText={t('channel.editModal.toggleOff')}
                    onChange={(value) =>
                      handleChannelSettingsChange('thinking_to_content', value)
                    }
                    extraText={t('channel.editModal.thinkingToContentDescription')}
                  />

                  <Form.Switch
                    field='pass_through_body_enabled'
                    label={t('channel.editModal.passThroughBody')}
                    checkedText={t('channel.editModal.toggleOn')}
                    uncheckedText={t('channel.editModal.toggleOff')}
                    onChange={(value) =>
                      handleChannelSettingsChange(
                        'pass_through_body_enabled',
                        value,
                      )
                    }
                    extraText={t('channel.editModal.passThroughBodyDescription')}
                  />

                  <Form.Input
                    field='proxy'
                    label={t('channel.editModal.proxyAddress')}
                    placeholder={t('channel.editModal.proxyPlaceholder')}
                    onChange={(value) =>
                      handleChannelSettingsChange('proxy', value)
                    }
                    showClear
                    extraText={t('channel.editModal.proxyDescription')}
                  />

                  <Form.TextArea
                    field='system_prompt'
                    label={t('channel.editModal.systemPrompt')}
                    placeholder={t('channel.editModal.systemPromptPlaceholder')}
                    onChange={(value) =>
                      handleChannelSettingsChange('system_prompt', value)
                    }
                    autosize
                    showClear
                    extraText={t('channel.editModal.systemPromptDescription')}
                  />
                  <Form.Switch
                    field='system_prompt_override'
                    label={t('channel.editModal.systemPromptOverride')}
                    checkedText={t('channel.editModal.toggleOn')}
                    uncheckedText={t('channel.editModal.toggleOff')}
                    onChange={(value) =>
                      handleChannelSettingsChange(
                        'system_prompt_override',
                        value,
                      )
                    }
                    extraText={t('channel.editModal.systemPromptOverrideDescription')}
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
      {/* 使用通用安全验证模态框 */}
      <SecureVerificationModal
        visible={isModalVisible}
        verificationMethods={verificationMethods}
        verificationState={verificationState}
        onVerify={executeVerification}
        onCancel={cancelVerification}
        onCodeChange={setVerificationCode}
        onMethodSwitch={switchVerificationMethod}
        title={verificationState.title}
        description={verificationState.description}
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
            {t('channel.editModal.channelKeyInfo')}
          </div>
        }
        visible={keyDisplayState.showModal}
        onCancel={resetKeyDisplayState}
        footer={
          <Button type='primary' onClick={resetKeyDisplayState}>
            {t('channel.editModal.done')}
          </Button>
        }
        width={700}
        style={{ maxWidth: '90vw' }}
      >
        <ChannelKeyDisplay
          keyData={keyDisplayState.keyData}
          showSuccessIcon={true}
          successText={t('channel.editModal.keyFetchSuccess')}
          showWarning={true}
          warningText={t('channel.editModal.keyWarning')}
        />
      </Modal>

      <ModelSelectModal
        visible={modelModalVisible}
        models={fetchedModels}
        selected={inputs.models}
        onConfirm={(selectedModels) => {
          handleInputChange('models', selectedModels);
          showSuccess(t('channel.editModal.modelListUpdated'));
          setModelModalVisible(false);
        }}
        onCancel={() => setModelModalVisible(false)}
      />
    </>
  );
};

export default EditChannelModal;
