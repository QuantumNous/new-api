import React, { useState, useEffect } from 'react';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../helpers';
import {
  SideSheet,
  Space,
  Button,
  Input,
  Typography,
  Spin,
  Select,
  Banner,
  TextArea,
  Card,
  Tag,
} from '@douyinfe/semi-ui';
import {
  IconSave,
  IconClose,
  IconBookmark,
  IconUser,
  IconCode,
} from '@douyinfe/semi-icons';
import { getChannelModels } from '../../helpers';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

const MODEL_MAPPING_EXAMPLE = {
  'gpt-3.5-turbo': 'gpt-3.5-turbo-0125',
};

const EditTagModal = (props) => {
  const { t } = useTranslation();
  const { visible, tag, handleClose, refresh } = props;
  const [loading, setLoading] = useState(false);
  const [originModelOptions, setOriginModelOptions] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [customModel, setCustomModel] = useState('');
  const originInputs = {
    tag: '',
    new_tag: null,
    model_mapping: null,
    groups: [],
    models: [],
  };
  const [inputs, setInputs] = useState(originInputs);

  const handleInputChange = (name, value) => {
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
    }
  };

  const fetchModels = async () => {
    try {
      let res = await API.get(`/api/channel/models`);
      let localModelOptions = res.data.data.map((model) => ({
        label: model.id,
        value: model.id,
      }));
      setOriginModelOptions(localModelOptions);
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

  const handleSave = async () => {
    setLoading(true);
    let data = {
      tag: tag,
    };
    if (inputs.model_mapping !== null && inputs.model_mapping !== '') {
      if (inputs.model_mapping !== '' && !verifyJSON(inputs.model_mapping)) {
        showInfo('模型映射必须是合法的 JSON 格式！');
        setLoading(false);
        return;
      }
      data.model_mapping = inputs.model_mapping;
    }
    if (inputs.groups.length > 0) {
      data.groups = inputs.groups.join(',');
    }
    if (inputs.models.length > 0) {
      data.models = inputs.models.join(',');
    }
    data.new_tag = inputs.new_tag;
    // check have any change
    if (
      data.model_mapping === undefined &&
      data.groups === undefined &&
      data.models === undefined &&
      data.new_tag === undefined
    ) {
      showWarning('没有任何修改！');
      setLoading(false);
      return;
    }
    await submit(data);
    setLoading(false);
  };

  const submit = async (data) => {
    try {
      const res = await API.put('/api/channel/tag', data);
      if (res?.data?.success) {
        showSuccess('标签更新成功！');
        refresh();
        handleClose();
      }
    } catch (error) {
      showError(error);
    }
  };

  useEffect(() => {
    let localModelOptions = [...originModelOptions];
    inputs.models.forEach((model) => {
      if (!localModelOptions.find((option) => option.label === model)) {
        localModelOptions.push({
          label: model,
          value: model,
        });
      }
    });
    setModelOptions(localModelOptions);
  }, [originModelOptions, inputs.models]);

  useEffect(() => {
    const fetchTagModels = async () => {
      if (!tag) return;
      setLoading(true);
      try {
        const res = await API.get(`/api/channel/tag/models?tag=${tag}`);
        if (res?.data?.success) {
          const models = res.data.data ? res.data.data.split(',') : [];
          setInputs((inputs) => ({ ...inputs, models: models }));
        } else {
          showError(res.data.message);
        }
      } catch (error) {
        showError(error.message);
      } finally {
        setLoading(false);
      }
    };

    setInputs({
      ...originInputs,
      tag: tag,
      new_tag: tag,
    });
    fetchModels().then();
    fetchGroups().then();
    fetchTagModels().then(); // Call the new function
  }, [visible, tag]); // Add tag to dependency array

  const addCustomModels = () => {
    if (customModel.trim() === '') return;
    // 使用逗号分隔字符串，然后去除每个模型名称前后的空格
    const modelArray = customModel.split(',').map((model) => model.trim());

    let localModels = [...inputs.models];
    let localModelOptions = [...modelOptions];
    const addedModels = [];

    modelArray.forEach((model) => {
      // 检查模型是否已存在，且模型名称非空
      if (model && !localModels.includes(model)) {
        localModels.push(model); // 添加到模型列表
        localModelOptions.push({
          // 添加到下拉选项
          key: model,
          text: model,
          value: model,
        });
        addedModels.push(model);
      }
    });

    // 更新状态值
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
    <SideSheet
      placement='right'
      title={
        <Space>
          <Tag color="blue" shape="circle">{t('编辑')}</Tag>
          <Title heading={4} className="m-0">
            {t('编辑标签')}
          </Title>
        </Space>
      }
      headerStyle={{
        borderBottom: '1px solid var(--semi-color-border)',
        padding: '24px'
      }}
      bodyStyle={{
        backgroundColor: 'var(--semi-color-bg-0)',
        padding: '0'
      }}
      visible={visible}
      width={600}
      onCancel={handleClose}
      footer={
        <div className="flex justify-end bg-white">
          <Space>
            <Button
              theme="solid"
              size="large"
              className="!rounded-full"
              onClick={handleSave}
              loading={loading}
              icon={<IconSave />}
            >
              {t('保存')}
            </Button>
            <Button
              theme="light"
              size="large"
              className="!rounded-full"
              type="primary"
              onClick={handleClose}
              icon={<IconClose />}
            >
              {t('取消')}
            </Button>
          </Space>
        </div>
      }
      closeIcon={null}
    >
      <Spin spinning={loading}>
        <div className="p-6">
          <Card className="!rounded-2xl shadow-sm border-0 mb-6">
            <div className="flex items-center mb-4 p-6 rounded-xl" style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
              position: 'relative'
            }}>
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full"></div>
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full"></div>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative">
                <IconBookmark size="large" style={{ color: '#ffffff' }} />
              </div>
              <div className="relative">
                <Text style={{ color: '#ffffff' }} className="text-lg font-medium">{t('标签信息')}</Text>
                <div style={{ color: '#ffffff' }} className="text-sm opacity-80">{t('标签的基本配置')}</div>
              </div>
            </div>

            <Banner
              type="warning"
              description={t('所有编辑均为覆盖操作，留空则不更改')}
              className="!rounded-lg mb-4"
            />

            <div className="space-y-4">
              <div>
                <Text strong className="block mb-2">{t('标签名称')}</Text>
                <Input
                  value={inputs.new_tag}
                  onChange={(value) => setInputs({ ...inputs, new_tag: value })}
                  placeholder={t('请输入新标签，留空则解散标签')}
                  size="large"
                  className="!rounded-lg"
                />
              </div>
            </div>
          </Card>

          <Card className="!rounded-2xl shadow-sm border-0 mb-6">
            <div className="flex items-center mb-4 p-6 rounded-xl" style={{
              background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #7c3aed 100%)',
              position: 'relative'
            }}>
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full"></div>
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full"></div>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative">
                <IconCode size="large" style={{ color: '#ffffff' }} />
              </div>
              <div className="relative">
                <Text style={{ color: '#ffffff' }} className="text-lg font-medium">{t('模型配置')}</Text>
                <div style={{ color: '#ffffff' }} className="text-sm opacity-80">{t('模型选择和映射设置')}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Text strong className="block mb-2">{t('模型')}</Text>
                <Banner
                  type="info"
                  description={t('当前模型列表为该标签下所有渠道模型列表最长的一个，并非所有渠道的并集，请注意可能导致某些渠道模型丢失。')}
                  className="!rounded-lg mb-4"
                />
                <Select
                  placeholder={t('请选择该渠道所支持的模型，留空则不更改')}
                  name='models'
                  multiple
                  filter
                  searchPosition='dropdown'
                  onChange={(value) => handleInputChange('models', value)}
                  value={inputs.models}
                  optionList={modelOptions}
                  size="large"
                  className="!rounded-lg"
                />
              </div>

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
                  size="large"
                  className="!rounded-lg"
                />
              </div>

              <div>
                <Text strong className="block mb-2">{t('模型重定向')}</Text>
                <TextArea
                  placeholder={t('此项可选，用于修改请求体中的模型名称，为一个 JSON 字符串，键为请求中模型名称，值为要替换的模型名称，留空则不更改')}
                  name='model_mapping'
                  onChange={(value) => handleInputChange('model_mapping', value)}
                  autosize
                  value={inputs.model_mapping}
                  className="!rounded-lg font-mono"
                />
                <Space className="mt-2">
                  <Text
                    className="!text-semi-color-primary cursor-pointer"
                    onClick={() => handleInputChange('model_mapping', JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2))}
                  >
                    {t('填入模板')}
                  </Text>
                  <Text
                    className="!text-semi-color-primary cursor-pointer"
                    onClick={() => handleInputChange('model_mapping', JSON.stringify({}, null, 2))}
                  >
                    {t('清空重定向')}
                  </Text>
                  <Text
                    className="!text-semi-color-primary cursor-pointer"
                    onClick={() => handleInputChange('model_mapping', '')}
                  >
                    {t('不更改')}
                  </Text>
                </Space>
              </div>
            </div>
          </Card>

          <Card className="!rounded-2xl shadow-sm border-0">
            <div className="flex items-center mb-4 p-6 rounded-xl" style={{
              background: 'linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%)',
              position: 'relative'
            }}>
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full"></div>
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full"></div>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative">
                <IconUser size="large" style={{ color: '#ffffff' }} />
              </div>
              <div className="relative">
                <Text style={{ color: '#ffffff' }} className="text-lg font-medium">{t('分组设置')}</Text>
                <div style={{ color: '#ffffff' }} className="text-sm opacity-80">{t('用户分组配置')}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Text strong className="block mb-2">{t('分组')}</Text>
                <Select
                  placeholder={t('请选择可以使用该渠道的分组，留空则不更改')}
                  name='groups'
                  multiple
                  allowAdditions
                  additionLabel={t('请在系统设置页面编辑分组倍率以添加新的分组：')}
                  onChange={(value) => handleInputChange('groups', value)}
                  value={inputs.groups}
                  optionList={groupOptions}
                  size="large"
                  className="!rounded-lg"
                />
              </div>
            </div>
          </Card>
        </div>
      </Spin>
    </SideSheet>
  );
};

export default EditTagModal;
