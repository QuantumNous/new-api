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

import React, { useEffect, useState, useRef } from 'react';
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Space,
  RadioGroup,
  Radio,
  Checkbox,
  Tag,
  Select
} from '@douyinfe/semi-ui';
import {
  IconDelete,
  IconPlus,
  IconSearch,
  IconSave,
  IconEdit,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess, getQuotaPerUnit } from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function ModelSettingsVisualEditor(props) {
  const { t } = useTranslation();
  const [models, setModels] = useState([]);
  const [visible, setVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentModel, setCurrentModel] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pricingMode, setPricingMode] = useState('per-token'); // 'per-token' or 'per-request'
  const [pricingSubMode, setPricingSubMode] = useState('ratio'); // 'ratio' or 'token-price'
  const [currencyType, setCurrencyType] = useState('USD'); // 'USD' or 'CNY'
  const [USDExchangeRate, setUSDExchangeRate] = useState(7);
  const [conflictOnly, setConflictOnly] = useState(false);
  const [enabledModelNames, setEnabledModelNames] = useState([]);
  const [hiddenModeNames, setHiddenModelNames] = useState([]);
  const formRef = useRef(null);
  const pageSize = 10;
  const quotaPerUnit = getQuotaPerUnit();

  const flushAllEnabledModels = async () => {
    try {
      const res = await API.get('/api/channel/models_enabled');
      const { success, message, data } = res.data;
      if (success) {
        setEnabledModelNames(data);
      } else {
        showError(message);
      }
    } catch (error) {
      console.error(t('获取启用模型失败:'), error);
      showError(t('获取启用模型失败'));
    }
  };

  useEffect(() => {
    // 获取所有启用的模型
    flushAllEnabledModels();
  }, []);

  useEffect(() => {
    try {
      const modelPrice = JSON.parse(props.options.ModelPrice || '{}');
      const modelRatio = JSON.parse(props.options.ModelRatio || '{}');
      const completionRatio = JSON.parse(props.options.CompletionRatio || '{}');

      // 合并所有模型名称
      const modelNames = new Set([
        ...Object.keys(modelPrice),
        ...Object.keys(modelRatio),
        ...Object.keys(completionRatio),
      ]);

      let modelData = Array.from(modelNames).map((name) => {
        const price = modelPrice[name] === undefined ? '' : modelPrice[name];
        const ratio = modelRatio[name] === undefined ? '' : modelRatio[name];
        const comp =
          completionRatio[name] === undefined ? '' : completionRatio[name];

        return {
          name,
          price,
          ratio,
          completionRatio: comp,
          hasConflict: price !== '' && (ratio !== '' || comp !== ''),
        };
      });
      if(props.mode === "unset_models"){
        // 找出所有未设置价格和倍率的模型
        const {unsetModels,hiddenModels} = enabledModelNames.reduce((groupByUnset,modelName) => {
          const hasPrice = modelPrice[modelName] !== undefined;
          const hasRatio = modelRatio[modelName] !== undefined;

          // 如果模型没有价格或者没有倍率设置，则显示
          const groupName = !hasPrice && !hasRatio;
          groupByUnset[groupName? "unsetModels": "hiddenModels"].push(modelName);
          return groupByUnset;
        },{"unsetModels":[],"hiddenModels":[]})
        modelData = unsetModels.map((name) => ({
          name,
          price: modelPrice[name] || '',
          ratio: modelRatio[name] || '',
          completionRatio: completionRatio[name] || '',
        }));
        setHiddenModelNames(hiddenModels)
      }
      setModels(modelData);
      if(props.options.USDExchangeRate){
        setUSDExchangeRate(parseFloat(props.options.USDExchangeRate))
      }
    } catch (error) {
      console.error('JSON解析错误:', error);
    }
  }, [props.options,props.mode,enabledModelNames]);

  // 首先声明分页相关的工具函数
  const getPagedData = (data, currentPage, pageSize) => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return data.slice(start, end);
  };

  // 在 return 语句之前，先处理过滤和分页逻辑
  const filteredModels = models.filter((model) => {
    const keywordMatch = searchText ? model.name.includes(searchText) : true;
    const conflictMatch = conflictOnly ? model.hasConflict : true;
    return keywordMatch && conflictMatch;
  });

  // 然后基于过滤后的数据计算分页数据
  const pagedData = getPagedData(filteredModels, currentPage, pageSize);

  const SubmitData = async () => {
    setLoading(true);
    const keepHiddenModels = (modelConf)=> {
      return hiddenModeNames.reduce((newConf,hiddenModel)=> {
          if(hiddenModel in modelConf){
            newConf[hiddenModel] = modelConf[hiddenModel]
          }
          return newConf
      },{})
    };
    const output = {
      ModelPrice: keepHiddenModels(JSON.parse(props.options.ModelPrice || '{}')),
      ModelRatio: keepHiddenModels(JSON.parse(props.options.ModelRatio || '{}')),
      CompletionRatio: keepHiddenModels(JSON.parse(props.options.CompletionRatio || '{}')),
    };
    
    try {
      // 数据转换
      models.forEach((model) => {
        if (model.price !== '') {
          // 如果价格不为空，则转换为浮点数，忽略倍率参数
          output.ModelPrice[model.name] = parseFloat(model.price);
        } else {
          if (model.ratio !== '')
            output.ModelRatio[model.name] = parseFloat(model.ratio);
          if (model.completionRatio !== '')
            output.CompletionRatio[model.name] = parseFloat(
              model.completionRatio,
            );
        }
      });

      // 准备API请求数组
      const finalOutput = {
        ModelPrice: JSON.stringify(output.ModelPrice, null, 2),
        ModelRatio: JSON.stringify(output.ModelRatio, null, 2),
        CompletionRatio: JSON.stringify(output.CompletionRatio, null, 2),
      };

      const requestQueue = Object.entries(finalOutput).map(([key, value]) => {
        return API.put('/api/option/', {
          key,
          value,
        });
      });

      // 批量处理请求
      const results = await Promise.all(requestQueue);

      // 验证结果
      if (requestQueue.length === 1) {
        if (results.includes(undefined)) return;
      } else if (requestQueue.length > 1) {
        if (results.includes(undefined)) {
          return showError('部分保存失败，请重试');
        }
      }

      // 检查每个请求的结果
      for (const res of results) {
        if (!res.data.success) {
          return showError(res.data.message);
        }
      }

      showSuccess('保存成功');
      props.refresh();
      flushAllEnabledModels();
    } catch (error) {
      console.error('保存失败:', error);
      showError('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('模型名称'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <span>
          {text}
          {record.hasConflict && (
            <Tag color='red' shape='circle' className='ml-2'>
              {t('矛盾')}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: t('模型固定价格'),
      dataIndex: 'price',
      key: 'price',
      render: (text, record) => (
        <Input
          value={text}
          placeholder={t('按量计费')}
          onChange={(value) => updateModel(record.name, 'price', value)}
        />
      ),
    },
    {
      title: t('模型倍率'),
      dataIndex: 'ratio',
      key: 'ratio',
      render: (text, record) => (
        <Input
          value={text}
          placeholder={record.price !== '' ? t('模型倍率') : t('默认补全倍率')}
          disabled={record.price !== ''}
          onChange={(value) => updateModel(record.name, 'ratio', value)}
        />
      ),
    },
    {
      title: t('补全倍率'),
      dataIndex: 'completionRatio',
      key: 'completionRatio',
      render: (text, record) => (
        <Input
          value={text}
          placeholder={record.price !== '' ? t('补全倍率') : t('默认补全倍率')}
          disabled={record.price !== ''}
          onChange={(value) =>
            updateModel(record.name, 'completionRatio', value)
          }
        />
      ),
    },
    {
      title: t('操作'),
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type='primary'
            icon={<IconEdit />}
            onClick={() => editModel(record)}
          ></Button>
          <Button
            icon={<IconDelete />}
            type='danger'
            onClick={() => deleteModel(record.name)}
          />
        </Space>
      ),
    },
  ];

  const updateModel = (name, field, value) => {
    if (isNaN(value)) {
      showError('请输入数字');
      return;
    }
    setModels((prev) =>
      prev.map((model) => {
        if (model.name !== name) return model;
        const updated = { ...model, [field]: value };
        updated.hasConflict =
          updated.price !== '' &&
          (updated.ratio !== '' || updated.completionRatio !== '');
        return updated;
      }),
    );
  };

  const deleteModel = (name) => {
    setModels((prev) => prev.filter((model) => model.name !== name));
  };

  const calculateRatioFromTokenPrice = (tokenPrice) => {
    if (currencyType === "CNY"){
      tokenPrice = tokenPrice / USDExchangeRate
    }
    return tokenPrice / 2;
  };

  const calculateCompletionRatioFromPrices = (
    modelTokenPrice,
    completionTokenPrice,
  ) => {
    if (!modelTokenPrice || modelTokenPrice === '0') {
      showError('模型价格不能为0');
      return '';
    }
    return completionTokenPrice / modelTokenPrice;
  };

  const handleTokenPriceChange = (value) => {
    // Use a temporary variable to hold the new state
    let newState = {
      ...(currentModel || {}),
      tokenPrice: value,
      ratio: 0,
    };

    if (!isNaN(value) && value !== '') {
      const tokenPrice = parseFloat(value);
      const ratio = calculateRatioFromTokenPrice(tokenPrice);
      newState.ratio = ratio;
    }

    // Set the state with the complete updated object
    setCurrentModel(newState);
  };

  const handleCompletionTokenPriceChange = (value) => {
    // Use a temporary variable to hold the new state
    let newState = {
      ...(currentModel || {}),
      completionTokenPrice: value,
      completionRatio: 0,
    };

    if (!isNaN(value) && value !== '' && currentModel?.tokenPrice) {
      const completionTokenPrice = parseFloat(value);
      const modelTokenPrice = parseFloat(currentModel.tokenPrice);

      if (modelTokenPrice > 0) {
        const completionRatio = calculateCompletionRatioFromPrices(
          modelTokenPrice,
          completionTokenPrice,
        );
        newState.completionRatio = completionRatio;
      }
    }

    // Set the state with the complete updated object
    setCurrentModel(newState);
  };

  const addOrUpdateModel = (values) => {
    // Check if we're editing an existing model or adding a new one
    const existingModelIndex = models.findIndex(
      (model) => model.name === values.name,
    );

    if (existingModelIndex >= 0) {
      // Update existing model
      setModels((prev) =>
        prev.map((model, index) => {
          if (index !== existingModelIndex) return model;
          const updated = {
            name: values.name,
            price: values.price || '',
            ratio: values.ratio || '',
            completionRatio: values.completionRatio || '',
          };
          updated.hasConflict =
            updated.price !== '' &&
            (updated.ratio !== '' || updated.completionRatio !== '');
          return updated;
        }),
      );
      setVisible(false);
      showSuccess(t('更新成功'));
    } else {
      // Add new model
      // Check if model name already exists
      if (models.some((model) => model.name === values.name)) {
        showError(t('模型名称已存在'));
        return;
      }

      setModels((prev) => {
        const newModel = {
          name: values.name,
          price: values.price || '',
          ratio: values.ratio || '',
          completionRatio: values.completionRatio || '',
        };
        newModel.hasConflict =
          newModel.price !== '' &&
          (newModel.ratio !== '' || newModel.completionRatio !== '');
        return [newModel, ...prev];
      });
      setVisible(false);
      showSuccess(t('添加成功'));
    }
  };

  const calculateTokenPriceFromRatio = (ratio) => {
    if (currencyType === "CNY"){
      ratio = ratio * USDExchangeRate
    }
    return ratio * 2;
  };

  const resetModalState = () => {
    setCurrentModel(null);
    setPricingMode('per-token');
    setPricingSubMode('ratio');
    setCurrencyType('USD')
    setIsEditMode(false);
  };

  const editModel = (record) => {
    setIsEditMode(true);
    // Determine which pricing mode to use based on the model's current configuration
    let initialPricingMode = 'per-token';
    let initialPricingSubMode = 'ratio';
    let intiialCurrucyType = 'USD'

    if (record.price !== '') {
      initialPricingMode = 'per-request';
    } else {
      initialPricingMode = 'per-token';
      // We default to ratio mode, but could set to token-price if needed
    }

    // Set the pricing modes for the form
    setPricingMode(initialPricingMode);
    setPricingSubMode(initialPricingSubMode);
    setCurrencyType(currencyType)
    // Create a copy of the model data to avoid modifying the original
    const modelCopy = { ...record };

    // If the model has ratio data and we want to populate token price fields
    if (record.ratio) {
      modelCopy.tokenPrice = calculateTokenPriceFromRatio(
        parseFloat(record.ratio),
      ).toString();

      if (record.completionRatio) {
        modelCopy.completionTokenPrice = (
          parseFloat(modelCopy.tokenPrice) * parseFloat(record.completionRatio)
        ).toString();
      }
    }

    // Set the current model
    setCurrentModel(modelCopy);

    // Open the modal
    setVisible(true);
  };

  const handleCurrucyTypeChange = (value) => {
      let newCurrencyType = value
      let oldCurrencyType = currencyType
      if(newCurrencyType === oldCurrencyType){
        return
      }
      let updatedModel = {... currentModel}
      if(newCurrencyType === "USD" && updatedModel.tokenPrice){
        updatedModel.tokenPrice = updatedModel.tokenPrice / USDExchangeRate
      }else if(updatedModel.tokenPrice) {
        updatedModel.tokenPrice = updatedModel.tokenPrice * USDExchangeRate
      }
      if(newCurrencyType === "USD" && updatedModel.completionTokenPrice){
        updatedModel.completionTokenPrice = updatedModel.completionTokenPrice / USDExchangeRate
      }else if(updatedModel.completionTokenPrice) {
        updatedModel.completionTokenPrice = updatedModel.completionTokenPrice * USDExchangeRate
      }
      if(newCurrencyType === "USD" && updatedModel.price){
        updatedModel.price = updatedModel.price / USDExchangeRate
      }else if(updatedModel.price){
        updatedModel.price = updatedModel.price * USDExchangeRate
      }
      setCurrencyType(newCurrencyType)
      setCurrentModel(updatedModel)
  }

  useEffect(() => {
    // 当currentModel更新时，手动更新Form的值
    if (formRef.current) {
      formRef.current.formApi.setValues(currentModel);
    }
  }, [currentModel,currencyType,pricingMode,pricingSubMode]);

  return (
    <>
      <Space vertical align='start' style={{ width: '100%' }}>
        <Space className='mt-2'>
          <Button
            icon={<IconPlus />}
            onClick={() => {
              resetModalState();
              setVisible(true);
            }}
          >
            {t('添加模型')}
          </Button>
          <Button type='primary' icon={<IconSave />} onClick={SubmitData}>
            {t('应用更改')}
          </Button>
          <Input
            prefix={<IconSearch />}
            placeholder={t('搜索模型名称')}
            value={searchText}
            onChange={(value) => {
              setSearchText(value);
              setCurrentPage(1);
            }}
            style={{ width: 200 }}
            showClear
          />
          {props.mode !== "unset_models" &&
          <Checkbox
            checked={conflictOnly}
            onChange={(e) => {
              setConflictOnly(e.target.checked);
              setCurrentPage(1);
            }}
          >
            {t('仅显示矛盾倍率')}
          </Checkbox>
          }
        </Space>
        <Table
          columns={columns}
          dataSource={pagedData}
          pagination={{
            currentPage: currentPage,
            pageSize: pageSize,
            total: filteredModels.length,
            onPageChange: (page) => setCurrentPage(page),
            showTotal: true,
            showSizeChanger: false,
          }}
        />
      </Space>

      <Modal
        title={isEditMode ? t('编辑模型') : t('添加模型')}
        visible={visible}
        onCancel={() => {
          resetModalState();
          setVisible(false);
        }}
        onOk={() => {
          if (currentModel) {
            // If we're in token price mode, make sure ratio values are properly set
            const valuesToSave = { ...currentModel };

            if (
              pricingMode === 'per-token' &&
              pricingSubMode === 'token-price' &&
              currentModel.tokenPrice
            ) {
              // Calculate and set ratio from token price
              const tokenPrice = parseFloat(currentModel.tokenPrice);
              valuesToSave.ratio = calculateRatioFromTokenPrice(tokenPrice)

              // Calculate and set completion ratio if both token prices are available
              if (
                currentModel.completionTokenPrice &&
                currentModel.tokenPrice
              ) {
                const completionPrice = parseFloat(
                  currentModel.completionTokenPrice,
                );
                const modelPrice = parseFloat(currentModel.tokenPrice);
                if (modelPrice > 0) {
                  valuesToSave.completionRatio = (
                    completionPrice / modelPrice
                  ).toString();
                }
              }
            }

            // Clear price if we're in per-token mode
            if (pricingMode === 'per-token') {
              valuesToSave.price = '';
            } else {
              // Clear ratios if we're in per-request mode
              valuesToSave.ratio = '';
              valuesToSave.completionRatio = '';
            }
            if(valuesToSave.price && currencyType !== "USD") {
              valuesToSave.price = valuesToSave.price / USDExchangeRate;
            }
            resetModalState();
            addOrUpdateModel(valuesToSave);
          }
        }}
      >
        <Form ref={formRef} initValues={currentModel}>
          <Form.Input
            field='name'
            label={t('模型名称')}
            placeholder='strawberry'
            required
            disabled={isEditMode}
            onChange={(value) =>
              setCurrentModel((prev) => ({ ...prev, name: value }))
            }
          />

          <Form.Section text={t('定价模式')}>
            <div style={{ marginBottom: '16px' }}>
              <RadioGroup
                type='button'
                value={pricingMode}
                onChange={(e) => {
                  const newMode = e.target.value;
                  const oldMode = pricingMode;
                  setPricingMode(newMode);
                }}
              >
                <Radio value='per-token'>{t('按量计费')}</Radio>
                <Radio value='per-request'>{t('按次计费')}</Radio>
              </RadioGroup>
            </div>
          </Form.Section>

          {pricingMode === 'per-token' && (
            <>
              <Form.Section text={t('价格设置方式')}>
                <div style={{ marginBottom: '16px' }}>
                  <RadioGroup
                    type='button'
                    value={pricingSubMode}
                    onChange={(e) => {
                      const newSubMode = e.target.value;
                      const oldSubMode = pricingSubMode;
                      setPricingSubMode(newSubMode);

                      // Handle conversion between submodes
                      if (currentModel) {
                        const updatedModel = { ...currentModel };

                        // Convert between ratio and token price
                        if (
                          oldSubMode === 'ratio' &&
                          newSubMode === 'token-price'
                        ) {
                          if (updatedModel.ratio) {
                            updatedModel.tokenPrice =
                              calculateTokenPriceFromRatio(
                                parseFloat(updatedModel.ratio),
                              ).toString();

                            if (updatedModel.completionRatio) {
                              updatedModel.completionTokenPrice = (
                                parseFloat(updatedModel.tokenPrice) *
                                parseFloat(updatedModel.completionRatio)
                              ).toString();
                            }
                          }
                        } else if (
                          oldSubMode === 'token-price' &&
                          newSubMode === 'ratio'
                        ) {
                          // Ratio values should already be calculated by the handlers
                        }
                        setCurrentModel(updatedModel);
                      }
                    }}
                  >
                    <Radio value='ratio'>{t('按倍率设置')}</Radio>
                    <Radio value='token-price'>{t('按价格设置')}</Radio>
                  </RadioGroup>
                </div>
              </Form.Section>

              {pricingSubMode === 'ratio' && (
                <>
                  <Form.InputNumber
                    hideButtons
                    precision={6}
                    field='ratio'
                    label={t('模型倍率')}
                    placeholder={t('输入模型倍率')}
                    onChange={(value) =>
                      setCurrentModel((prev) => ({
                        ...(prev || {}),
                        ratio: value,
                      }))
                    }
                    value={currentModel?.ratio || ''}
                  />
                  <Form.InputNumber
                    hideButtons
                    precision={6}
                    field='completionRatio'
                    label={t('补全倍率')}
                    placeholder={t('输入补全倍率')}
                    onChange={(value) =>
                      setCurrentModel((prev) => ({
                        ...(prev || {}),
                        completionRatio: value,
                      }))
                    }
                    value={currentModel?.completionRatio || ''}
                  />
                </>
              )}

              {pricingSubMode === 'token-price' && (
                <>
                  <Select field="currencyType" value={currencyType} onChange={handleCurrucyTypeChange}>
                      <Select.Option value={"USD"}>USD</Select.Option>
                      <Select.Option value={"CNY"}>CNY</Select.Option>
                    </Select>
                  <Form.InputNumber
                    hideButtons
                    currency={currencyType}
                    precision={6}
                    field='tokenPrice'
                    label={t('输入价格')}
                    onChange={(value) => {
                      handleTokenPriceChange(value);
                    }}
                    value={currentModel?.tokenPrice || ''}
                    suffix={t('1M tokens')}
                  />
                  <Form.InputNumber
                    hideButtons
                    currency={currencyType}
                    precision={6}
                    field='completionTokenPrice'
                    label={t('输出价格')}
                    onChange={(value) => {
                      handleCompletionTokenPriceChange(value);
                    }}
                    value={currentModel?.completionTokenPrice || ''}
                    suffix={t('1M tokens')}
                  />
                </>
              )}
            </>
          )}

          {pricingMode === 'per-request' && (
            <>
              <Select field="currencyType" value={currencyType} onChange={handleCurrucyTypeChange}>
                      <Select.Option value={"USD"}>USD</Select.Option>
                      <Select.Option value={"CNY"}>CNY</Select.Option>
                    </Select>
            <Form.InputNumber
              hideButtons
              currency={currencyType}
              precision={6}
              field='price'
              label={t('固定价格(每次)')}
              placeholder={t('输入每次价格')}
              onChange={(value) =>
                setCurrentModel((prev) => ({
                  ...(prev || {}),
                  price: value,
                }))
              }
              value={currentModel?.price || ''}
            />
          </>
          )}
        </Form>
      </Modal>
    </>
  );
}
