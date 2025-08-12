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
import { useIsMobile } from '../../../../hooks/common/useIsMobile.js';
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
} from '@douyinfe/semi-ui';
import { getChannelModels, copy, getChannelIcon, getModelCategories, selectFilter } from '../../../../helpers';
import ModelSelectModal from './ModelSelectModal';
import JSONEditor from '../../../common/ui/JSONEditor';
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
  "default": 'global',
  "gemini-1.5-pro-002": "europe-west2",
  "gemini-1.5-flash-002": "europe-west2",
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
      return '按照如下格式输入: AccessKey|SecretKey, 如果上游是New API，则直接输ApiKey';
    case 51:
      return '按照如下格式输入: Access Key ID|Secret Access Key';
    default:
      return '请输入渠道对应的鉴权密钥';
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
  // 渠道额外设置状态
  const [channelSettings, setChannelSettings] = useState({
    force_format: false,
    thinking_to_content: false,
    proxy: '',
    pass_through_body_enabled: false,
    system_prompt: '',
  });
  const showApiConfigCard = inputs.type !== 45;  // 控制是否显示 API 配置卡片（仅当渠道类型不是 豆包 时显示）
  const getInitValues = () => ({ ...originInputs });

  // 处理渠道额外设置的更新
  const handleChannelSettingsChange = (key, value) => {
    // 更新内部状态
    setChannelSettings(prev => ({ ...prev, [key]: value }));

    // 同步更新到表单字段
    if (formApiRef.current) {
      formApiRef.current.setValue(key, value);
    }

    // 同步更新inputs状态
    setInputs(prev => ({ ...prev, [key]: value }));

    // 生成setting JSON并更新
    const newSettings = { ...channelSettings, [key]: value };
    const settingsJson = JSON.stringify(newSettings);
    handleInputChange('setting', settingsJson);
  };

  const handleChannelOtherSettingsChange = (key, value) => {
    // 更新内部状态
    setChannelSettings(prev => ({ ...prev, [key]: value }));

    // 同步更新到表单字段
    if (formApiRef.current) {
      formApiRef.current.setValue(key, value);
    }

    // 同步更新inputs状态
    setInputs(prev => ({ ...prev, [key]: value }));

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
  }

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
          data.thinking_to_content = parsedSettings.thinking_to_content || false;
          data.proxy = parsedSettings.proxy || '';
          data.pass_through_body_enabled = parsedSettings.pass_through_body_enabled || false;
          data.system_prompt = parsedSettings.system_prompt || '';
          data.system_prompt_override = parsedSettings.system_prompt_override || false;
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
          data.azure_responses_version = parsedSettings.azure_responses_version || '';
        } catch (error) {
          console.error('解析其他设置失败:', error);
          data.azure_responses_version = '';
          data.region = '';
        }
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
      const res = await API.get('/api/channel/fetch_models/' + channelId, { skipErrorHandler: true });
      if (res && res.data && res.data.success) {
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
          <span className="flex items-center gap-1">
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
      // 清空表单中的key_mode字段
      if (formApiRef.current) {
        formApiRef.current.setValue('key_mode', undefined);
      }
      // 重置本地输入，避免下次打开残留上一次的 JSON 字段值
      setInputs(getInitValues());
    }
  }, [props.visible, channelId]);

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
        showError(t('以下文件解析失败，已忽略：{{list}}', { list: errorNames.join(', ') }));
      }
    })();
  };

  const submit = async () => {
    const formValues = formApiRef.current ? formApiRef.current.getValues() : {};
    let localInputs = { ...formValues };

    if (localInputs.type === 41) {
      if (useManualInput) {
        // 手动输入模式
        if (localInputs.key && localInputs.key.trim() !== '') {
          try {
            // 验证 JSON 格式
            const parsedKey = JSON.parse(localInputs.key);
            // 确保是有效的密钥格式
            localInputs.key = JSON.stringify(parsedKey);
          } catch (err) {
            showError(t('密钥格式无效，请输入有效的 JSON 格式密钥'));
            return;
          }
        } else if (!isEdit) {
          showInfo(t('请输入密钥！'));
          return;
        }
      } else {
        // 文件上传模式
        let keys = vertexKeys;

        // 若当前未选择文件，尝试从已上传文件列表解析（异步读取）
        if (keys.length === 0 && vertexFileList.length > 0) {
          try {
            const parsed = await Promise.all(
              vertexFileList.map(async (item) => {
                const fileObj = item.fileInstance;
                if (!fileObj) return null;
                const txt = await fileObj.text();
                return JSON.parse(txt);
              })
            );
            keys = parsed.filter(Boolean);
          } catch (err) {
            showError(t('解析密钥文件失败: {{msg}}', { msg: err.message }));
            return;
          }
        }

        // 创建模式必须上传密钥；编辑模式可选
        if (keys.length === 0) {
          if (!isEdit) {
            showInfo(t('请上传密钥文件！'));
            return;
          } else {
            // 编辑模式且未上传新密钥，不修改 key
            delete localInputs.key;
          }
        } else {
          // 有新密钥，则覆盖
          if (batch) {
            localInputs.key = JSON.stringify(keys);
          } else {
            localInputs.key = JSON.stringify(keys[0]);
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

    // 清理不需要发送到后端的字段
    delete localInputs.force_format;
    delete localInputs.thinking_to_content;
    delete localInputs.proxy;
    delete localInputs.pass_through_body_enabled;
    delete localInputs.system_prompt;
    delete localInputs.system_prompt_override;

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
                title: t('切换为单密钥模式'),
                content: t('将仅保留第一个密钥文件，其余文件将被移除，是否继续？'),
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
          {t('批量创建')}
        </Checkbox>
      )}
      {batch && (
        <Checkbox disabled={isEdit} checked={multiToSingle} onChange={() => {
          setMultiToSingle(prev => !prev);
          setInputs(prev => {
            const newInputs = { ...prev };
            if (!multiToSingle) {
              newInputs.multi_key_mode = multiKeyMode;
            } else {
              delete newInputs.multi_key_mode;
            }
            return newInputs;
          });
        }}>{t('密钥聚合模式')}</Checkbox>
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
      selected && 'bg-blue-100 text-blue-700 shadow-lg ring-2 ring-blue-200 ring-opacity-50',
      disabled && 'opacity-50 cursor-not-allowed',
      !disabled && 'hover:bg-gray-50 hover:shadow-md cursor-pointer',
      className
    ].filter(Boolean).join(' ');

    return (
      <div
        style={style}
        className={optionClassName}
        onClick={() => !disabled && onClick()}
        onMouseEnter={e => onMouseEnter()}
      >
        <div className="flex items-center gap-3 w-full">
          <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            {getChannelIcon(value)}
          </div>
          <div className="flex-1 min-w-0">
            <Highlight
              sourceString={label}
              searchWords={searchWords}
              className="text-sm font-medium truncate"
            />
          </div>
          {selected && (
            <div className="flex-shrink-0 text-blue-600">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
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
            <Tag color="blue" shape="circle">{isEdit ? t('编辑') : t('新建')}</Tag>
            <Title heading={4} className="m-0">
              {isEdit ? t('更新渠道信息') : t('创建新的渠道')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: '0' }}
        visible={props.visible}
        width={isMobile ? '100%' : 600}
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
                    optionList={channelOptionList}
                    style={{ width: '100%' }}
                    filter={selectFilter}
                    autoClearSearchValue={false}
                    searchPosition='dropdown'
                    onSearch={(value) => setChannelSearchValue(value)}
                    renderOptionItem={renderChannelOption}
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
                    inputs.type === 41 ? (
                      <Form.Upload
                        field='vertex_files'
                        label={t('密钥文件 (.json)')}
                        accept='.json'
                        multiple
                        draggable
                        dragIcon={<IconBolt />}
                        dragMainText={t('点击上传文件或拖拽文件到这里')}
                        dragSubText={t('仅支持 JSON 文件，支持多文件')}
                        style={{ marginTop: 10 }}
                        uploadTrigger='custom'
                        beforeUpload={() => false}
                        onChange={handleVertexUploadChange}
                        fileList={vertexFileList}
                        rules={isEdit ? [] : [{ required: true, message: t('请上传密钥文件') }]}
                        extraText={batchExtra}
                      />
                    ) : (
                      <Form.TextArea
                        field='key'
                        label={t('密钥')}
                        placeholder={t('请输入密钥，一行一个')}
                        rules={isEdit ? [] : [{ required: true, message: t('请输入密钥') }]}
                        autosize
                        autoComplete='new-password'
                        onChange={(value) => handleInputChange('key', value)}
                        extraText={
                          <div className="flex items-center gap-2">
                            {isEdit && isMultiKeyChannel && keyMode === 'append' && (
                              <Text type="warning" size="small">
                                {t('追加模式：新密钥将添加到现有密钥列表的末尾')}
                              </Text>
                            )}
                            {batchExtra}
                          </div>
                        }
                        showClear
                      />
                    )
                  ) : (
                    <>
                      {inputs.type === 41 ? (
                        <>
                          {!batch && (
                            <div className="flex items-center justify-between mb-3">
                              <Text className="text-sm font-medium">{t('密钥输入方式')}</Text>
                              <Space>
                                <Button
                                  size="small"
                                  type={!useManualInput ? 'primary' : 'tertiary'}
                                  onClick={() => {
                                    setUseManualInput(false);
                                    // 切换到文件上传模式时清空手动输入的密钥
                                    if (formApiRef.current) {
                                      formApiRef.current.setValue('key', '');
                                    }
                                    handleInputChange('key', '');
                                  }}
                                >
                                  {t('文件上传')}
                                </Button>
                                <Button
                                  size="small"
                                  type={useManualInput ? 'primary' : 'tertiary'}
                                  onClick={() => {
                                    setUseManualInput(true);
                                    // 切换到手动输入模式时清空文件上传相关状态
                                    setVertexKeys([]);
                                    setVertexFileList([]);
                                    if (formApiRef.current) {
                                      formApiRef.current.setValue('vertex_files', []);
                                    }
                                    setInputs((prev) => ({ ...prev, vertex_files: [] }));
                                  }}
                                >
                                  {t('手动输入')}
                                </Button>
                              </Space>
                            </div>
                          )}

                          {batch && (
                            <Banner
                              type='info'
                              description={t('批量创建模式下仅支持文件上传，不支持手动输入')}
                              className='!rounded-lg mb-3'
                            />
                          )}

                          {useManualInput && !batch ? (
                            <Form.TextArea
                              field='key'
                              label={isEdit ? t('密钥（编辑模式下，保存的密钥不会显示）') : t('密钥')}
                              placeholder={t('请输入 JSON 格式的密钥内容，例如：\n{\n  "type": "service_account",\n  "project_id": "your-project-id",\n  "private_key_id": "...",\n  "private_key": "...",\n  "client_email": "...",\n  "client_id": "...",\n  "auth_uri": "...",\n  "token_uri": "...",\n  "auth_provider_x509_cert_url": "...",\n  "client_x509_cert_url": "..."\n}')}
                              rules={isEdit ? [] : [{ required: true, message: t('请输入密钥') }]}
                              autoComplete='new-password'
                              onChange={(value) => handleInputChange('key', value)}
                              extraText={
                                <div className="flex items-center gap-2">
                                  <Text type="tertiary" size="small">
                                    {t('请输入完整的 JSON 格式密钥内容')}
                                  </Text>
                                  {isEdit && isMultiKeyChannel && keyMode === 'append' && (
                                    <Text type="warning" size="small">
                                      {t('追加模式：新密钥将添加到现有密钥列表的末尾')}
                                    </Text>
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
                              label={t('密钥文件 (.json)')}
                              accept='.json'
                              draggable
                              dragIcon={<IconBolt />}
                              dragMainText={t('点击上传文件或拖拽文件到这里')}
                              dragSubText={t('仅支持 JSON 文件')}
                              style={{ marginTop: 10 }}
                              uploadTrigger='custom'
                              beforeUpload={() => false}
                              onChange={handleVertexUploadChange}
                              fileList={vertexFileList}
                              rules={isEdit ? [] : [{ required: true, message: t('请上传密钥文件') }]}
                              extraText={batchExtra}
                            />
                          )}
                        </>
                      ) : (
                        <Form.Input
                          field='key'
                          label={isEdit ? t('密钥（编辑模式下，保存的密钥不会显示）') : t('密钥')}
                          placeholder={t(type2secretPrompt(inputs.type))}
                          rules={isEdit ? [] : [{ required: true, message: t('请输入密钥') }]}
                          autoComplete='new-password'
                          onChange={(value) => handleInputChange('key', value)}
                          extraText={
                            <div className="flex items-center gap-2">
                              {isEdit && isMultiKeyChannel && keyMode === 'append' && (
                                <Text type="warning" size="small">
                                  {t('追加模式：新密钥将添加到现有密钥列表的末尾')}
                                </Text>
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
                      label={t('密钥更新模式')}
                      placeholder={t('请选择密钥更新模式')}
                      optionList={[
                        { label: t('追加到现有密钥'), value: 'append' },
                        { label: t('覆盖现有密钥'), value: 'replace' },
                      ]}
                      style={{ width: '100%' }}
                      value={keyMode}
                      onChange={(value) => setKeyMode(value)}
                      extraText={
                        <Text type="tertiary" size="small">
                          {keyMode === 'replace'
                            ? t('覆盖模式：将完全替换现有的所有密钥')
                            : t('追加模式：将新密钥添加到现有密钥列表末尾')
                          }
                        </Text>
                      }
                    />
                  )}
                  {batch && multiToSingle && (
                    <>
                      <Form.Select
                        field='multi_key_mode'
                        label={t('密钥聚合模式')}
                        placeholder={t('请选择多密钥使用策略')}
                        optionList={[
                          { label: t('随机'), value: 'random' },
                          { label: t('轮询'), value: 'polling' },
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
                          description={t('轮询模式必须搭配Redis和内存缓存功能使用，否则性能将大幅降低，并且无法实现轮询功能')}
                          className='!rounded-lg mt-2'
                        />
                      )}
                    </>
                  )}

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
                    <JSONEditor
                      key={`region-${isEdit ? channelId : 'new'}`}
                      field='other'
                      label={t('部署地区')}
                      placeholder={t(
                        '请输入部署地区，例如：us-central1\n支持使用模型映射格式\n{\n    "default": "us-central1",\n    "claude-3-5-sonnet-20240620": "europe-west1"\n}'
                      )}
                      value={inputs.other || ''}
                      onChange={(value) => handleInputChange('other', value)}
                      rules={[{ required: true, message: t('请填写部署地区') }]}
                      template={REGION_EXAMPLE}
                      templateLabel={t('填入模板')}
                      editorType="region"
                      formApi={formApiRef.current}
                      extraText={t('设置默认地区和特定模型的专用地区')}
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
                      helpText={t('组织，不填则为默认组织')}
                      onChange={(value) => handleInputChange('openai_organization', value)}
                    />
                  )}
                </Card>

                {/* API Configuration Card */}
                {showApiConfigCard && (
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
                        <div>
                          <Form.Input
                            field='azure_responses_version'
                            label={t('默认 Responses API 版本，为空则使用上方版本')}
                            placeholder={t('例如：preview')}
                            onChange={(value) => handleChannelOtherSettingsChange('azure_responses_version', value)}
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
                  </Card>
                )}

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
                    placeholder={t('请选择该渠道所支持的模型')}
                    rules={[{ required: true, message: t('请选择模型') }]}
                    multiple
                    filter={selectFilter}
                    autoClearSearchValue={false}
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
                        <Button size='small' type='tertiary' onClick={() => fetchUpstreamModelList('models')}>
                          {t('获取模型列表')}
                        </Button>
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
                        {modelGroups && modelGroups.length > 0 && modelGroups.map(group => (
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
                                  const parsed = JSON.parse(group.items || '[]');
                                  if (Array.isArray(parsed)) items = parsed;
                                }
                              } catch { }
                              const current = formApiRef.current?.getValue('models') || inputs.models || [];
                              const merged = Array.from(new Set([...
                                current,
                              ...items
                              ].map(m => (m || '').trim()).filter(Boolean)));
                              handleInputChange('models', merged);
                            }}
                          >
                            {group.name}
                          </Button>
                        ))}
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

                  <JSONEditor
                    key={`model_mapping-${isEdit ? channelId : 'new'}`}
                    field='model_mapping'
                    label={t('模型重定向')}
                    placeholder={
                      t('此项可选，用于修改请求体中的模型名称，为一个 JSON 字符串，键为请求中模型名称，值为要替换的模型名称，例如：') +
                      `\n${JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2)}`
                    }
                    value={inputs.model_mapping || ''}
                    onChange={(value) => handleInputChange('model_mapping', value)}
                    template={MODEL_MAPPING_EXAMPLE}
                    templateLabel={t('填入模板')}
                    editorType="keyValue"
                    formApi={formApiRef.current}
                    extraText={t('键为请求中的模型名称，值为要替换的模型名称')}
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
                    onChange={(value) => setAutoBan(value)}
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

                  <JSONEditor
                    key={`status_code_mapping-${isEdit ? channelId : 'new'}`}
                    field='status_code_mapping'
                    label={t('状态码复写')}
                    placeholder={
                      t('此项可选，用于复写返回的状态码，仅影响本地判断，不修改返回到上游的状态码，比如将claude渠道的400错误复写为500（用于重试），请勿滥用该功能，例如：') +
                      '\n' +
                      JSON.stringify(STATUS_CODE_MAPPING_EXAMPLE, null, 2)
                    }
                    value={inputs.status_code_mapping || ''}
                    onChange={(value) => handleInputChange('status_code_mapping', value)}
                    template={STATUS_CODE_MAPPING_EXAMPLE}
                    templateLabel={t('填入模板')}
                    editorType="keyValue"
                    formApi={formApiRef.current}
                    extraText={t('键为原状态码，值为要复写的状态码，仅影响本地判断')}
                  />
                </Card>

                {/* Channel Extra Settings Card */}
                <Card className="!rounded-2xl shadow-sm border-0 mb-6">
                  {/* Header: Channel Extra Settings */}
                  <div className="flex items-center mb-2">
                    <Avatar size="small" color="violet" className="mr-2 shadow-md">
                      <IconBolt size={16} />
                    </Avatar>
                    <div>
                      <Text className="text-lg font-medium">{t('渠道额外设置')}</Text>
                    </div>
                  </div>

                  {inputs.type === 1 && (
                    <Form.Switch
                      field='force_format'
                      label={t('强制格式化')}
                      checkedText={t('开')}
                      uncheckedText={t('关')}
                      onChange={(value) => handleChannelSettingsChange('force_format', value)}
                      extraText={t('强制将响应格式化为 OpenAI 标准格式（只适用于OpenAI渠道类型）')}
                    />
                  )}

                  <Form.Switch
                    field='thinking_to_content'
                    label={t('思考内容转换')}
                    checkedText={t('开')}
                    uncheckedText={t('关')}
                    onChange={(value) => handleChannelSettingsChange('thinking_to_content', value)}
                    extraText={t('将 reasoning_content 转换为 <think> 标签拼接到内容中')}
                  />

                  <Form.Switch
                    field='pass_through_body_enabled'
                    label={t('透传请求体')}
                    checkedText={t('开')}
                    uncheckedText={t('关')}
                    onChange={(value) => handleChannelSettingsChange('pass_through_body_enabled', value)}
                    extraText={t('启用请求体透传功能')}
                  />

                  <Form.Input
                    field='proxy'
                    label={t('代理地址')}
                    placeholder={t('例如: socks5://user:pass@host:port')}
                    onChange={(value) => handleChannelSettingsChange('proxy', value)}
                    showClear
                    extraText={t('用于配置网络代理，支持 socks5 协议')}
                  />

                  <Form.TextArea
                    field='system_prompt'
                    label={t('系统提示词')}
                    placeholder={t('输入系统提示词，用户的系统提示词将优先于此设置')}
                    onChange={(value) => handleChannelSettingsChange('system_prompt', value)}
                    autosize
                    showClear
                    extraText={t('用户优先：如果用户在请求中指定了系统提示词，将优先使用用户的设置')}
                  />
                  <Form.Switch
                    field='system_prompt_override'
                    label={t('系统提示词拼接')}
                    checkedText={t('开')}
                    uncheckedText={t('关')}
                    onChange={(value) => handleChannelSettingsChange('system_prompt_override', value)}
                    extraText={t('如果用户请求中包含系统提示词，则使用此设置拼接到用户的系统提示词前面')}
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
      <ModelSelectModal
        visible={modelModalVisible}
        models={fetchedModels}
        selected={inputs.models}
        onConfirm={(selectedModels) => {
          handleInputChange('models', selectedModels);
          showSuccess(t('模型列表已更新'));
          setModelModalVisible(false);
        }}
        onCancel={() => setModelModalVisible(false)}
      />
    </>
  );
};

export default EditChannelModal; 