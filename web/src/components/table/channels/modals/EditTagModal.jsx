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

import React, { useState, useEffect, useRef } from 'react';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  showWarning,
  verifyJSON,
  selectFilter,
} from '../../../../helpers';
import {
  SideSheet,
  Space,
  Button,
  Typography,
  Spin,
  Banner,
  Card,
  Tag,
  Avatar,
  Form,
} from '@douyinfe/semi-ui';
import {
  IconSave,
  IconClose,
  IconBookmark,
  IconUser,
  IconCode,
} from '@douyinfe/semi-icons';
import { getChannelModels } from '../../../../helpers';
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
  const formApiRef = useRef(null);
  const getInitValues = () => ({ ...originInputs });

  const handleInputChange = (name, value) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
    if (formApiRef.current) {
      formApiRef.current.setValue(name, value);
    }
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

  const handleSave = async (values) => {
    setLoading(true);
    const formVals = values || formApiRef.current?.getValues() || {};
    let data = { tag };
    if (formVals.model_mapping) {
      if (!verifyJSON(formVals.model_mapping)) {
        showInfo('模型映射必须是合法的 JSON 格式！');
        setLoading(false);
        return;
      }
      data.model_mapping = formVals.model_mapping;
    }
    if (formVals.groups && formVals.groups.length > 0) {
      data.groups = formVals.groups.join(',');
    }
    if (formVals.models && formVals.models.length > 0) {
      data.models = formVals.models.join(',');
    }
    data.new_tag = formVals.new_tag;
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
          handleInputChange('models', models);
        } else {
          showError(res.data.message);
        }
      } catch (error) {
        showError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchModels().then();
    fetchGroups().then();
    fetchTagModels().then();
    if (formApiRef.current) {
      formApiRef.current.setValues({
        ...getInitValues(),
        tag: tag,
        new_tag: tag,
      });
    }

    setInputs({
      ...originInputs,
      tag: tag,
      new_tag: tag,
    });
  }, [visible, tag]);

  useEffect(() => {
    if (formApiRef.current) {
      formApiRef.current.setValues(inputs);
    }
  }, [inputs]);

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
          text: model,
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
      bodyStyle={{ padding: '0' }}
      visible={visible}
      width={600}
      onCancel={handleClose}
      footer={
        <div className="flex justify-end bg-white">
          <Space>
            <Button
              theme="solid"
              onClick={() => formApiRef.current?.submitForm()}
              loading={loading}
              icon={<IconSave />}
            >
              {t('保存')}
            </Button>
            <Button
              theme="light"
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
      <Form
        key={tag || 'edit'}
        initValues={getInitValues()}
        getFormApi={(api) => (formApiRef.current = api)}
        onSubmit={handleSave}
      >
        {() => (
          <Spin spinning={loading}>
            <div className="p-2">
              <Card className="!rounded-2xl shadow-sm border-0 mb-6">
                {/* Header: Tag Info */}
                <div className="flex items-center mb-2">
                  <Avatar size="small" color="blue" className="mr-2 shadow-md">
                    <IconBookmark size={16} />
                  </Avatar>
                  <div>
                    <Text className="text-lg font-medium">{t('标签信息')}</Text>
                    <div className="text-xs text-gray-600">{t('标签的基本配置')}</div>
                  </div>
                </div>

                <Banner
                  type="warning"
                  description={t('所有编辑均为覆盖操作，留空则不更改')}
                  className="!rounded-lg mb-4"
                />

                <div className="space-y-4">
                  <Form.Input
                    field='new_tag'
                    label={t('标签名称')}
                    placeholder={t('请输入新标签，留空则解散标签')}
                    onChange={(value) => handleInputChange('new_tag', value)}
                  />
                </div>
              </Card>

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
                  <Banner
                    type="info"
                    description={t('当前模型列表为该标签下所有渠道模型列表最长的一个，并非所有渠道的并集，请注意可能导致某些渠道模型丢失。')}
                    className="!rounded-lg mb-4"
                  />
                  <Form.Select
                    field='models'
                    label={t('模型')}
                    placeholder={t('请选择该渠道所支持的模型，留空则不更改')}
                    multiple
                    filter={selectFilter}
                    autoClearSearchValue={false}
                    searchPosition='dropdown'
                    optionList={modelOptions}
                    style={{ width: '100%' }}
                    onChange={(value) => handleInputChange('models', value)}
                  />

                  <Form.Input
                    field='custom_model'
                    label={t('自定义模型名称')}
                    placeholder={t('输入自定义模型名称')}
                    onChange={(value) => setCustomModel(value.trim())}
                    suffix={<Button size='small' type='primary' onClick={addCustomModels}>{t('填入')}</Button>}
                  />

                  <Form.TextArea
                    field='model_mapping'
                    label={t('模型重定向')}
                    placeholder={t('此项可选，用于修改请求体中的模型名称，为一个 JSON 字符串，键为请求中模型名称，值为要替换的模型名称，留空则不更改')}
                    autosize
                    onChange={(value) => handleInputChange('model_mapping', value)}
                    extraText={(
                      <Space>
                        <Text className="!text-semi-color-primary cursor-pointer" onClick={() => handleInputChange('model_mapping', JSON.stringify(MODEL_MAPPING_EXAMPLE, null, 2))}>{t('填入模板')}</Text>
                        <Text className="!text-semi-color-primary cursor-pointer" onClick={() => handleInputChange('model_mapping', JSON.stringify({}, null, 2))}>{t('清空重定向')}</Text>
                        <Text className="!text-semi-color-primary cursor-pointer" onClick={() => handleInputChange('model_mapping', '')}>{t('不更改')}</Text>
                      </Space>
                    )}
                  />
                </div>
              </Card>

              <Card className="!rounded-2xl shadow-sm border-0">
                {/* Header: Group Settings */}
                <div className="flex items-center mb-2">
                  <Avatar size="small" color="green" className="mr-2 shadow-md">
                    <IconUser size={16} />
                  </Avatar>
                  <div>
                    <Text className="text-lg font-medium">{t('分组设置')}</Text>
                    <div className="text-xs text-gray-600">{t('用户分组配置')}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Form.Select
                    field='groups'
                    label={t('分组')}
                    placeholder={t('请选择可以使用该渠道的分组，留空则不更改')}
                    multiple
                    allowAdditions
                    additionLabel={t('请在系统设置页面编辑分组倍率以添加新的分组：')}
                    optionList={groupOptions}
                    style={{ width: '100%' }}
                    onChange={(value) => handleInputChange('groups', value)}
                  />
                </div>
              </Card>
            </div>
          </Spin>
        )}
      </Form>
    </SideSheet>
  );
};

export default EditTagModal; 