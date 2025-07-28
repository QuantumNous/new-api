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

import { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API, copy, showError, showInfo, showSuccess, getModelCategories } from '../../helpers';
import { Modal } from '@douyinfe/semi-ui';
import { UserContext } from '../../context/User/index.js';
import { StatusContext } from '../../context/Status/index.js';

export const useModelPricingData = () => {
  const { t } = useTranslation();
  const [filteredValue, setFilteredValue] = useState([]);
  const compositionRef = useRef({ isComposition: false });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [modalImageUrl, setModalImageUrl] = useState('');
  const [isModalOpenurl, setIsModalOpenurl] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('default');
  const [activeKey, setActiveKey] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [currency, setCurrency] = useState('USD');
  const [showWithRecharge, setShowWithRecharge] = useState(false);
  const [tokenUnit, setTokenUnit] = useState('M');
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupRatio, setGroupRatio] = useState({});
  const [usableGroup, setUsableGroup] = useState({});

  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);

  // 充值汇率（price）与美元兑人民币汇率（usd_exchange_rate）
  const priceRate = useMemo(() => statusState?.status?.price ?? 1, [statusState]);
  const usdExchangeRate = useMemo(() => statusState?.status?.usd_exchange_rate ?? priceRate, [statusState, priceRate]);

  const modelCategories = getModelCategories(t);

  const categoryCounts = useMemo(() => {
    const counts = {};
    if (models.length > 0) {
      counts['all'] = models.length;
      Object.entries(modelCategories).forEach(([key, category]) => {
        if (key !== 'all') {
          counts[key] = models.filter(model => category.filter(model)).length;
        }
      });
    }
    return counts;
  }, [models, modelCategories]);

  const availableCategories = useMemo(() => {
    if (!models.length) return ['all'];
    return Object.entries(modelCategories).filter(([key, category]) => {
      if (key === 'all') return true;
      return models.some(model => category.filter(model));
    }).map(([key]) => key);
  }, [models]);

  const filteredModels = useMemo(() => {
    let result = models;

    if (activeKey !== 'all') {
      result = result.filter(model => modelCategories[activeKey].filter(model));
    }

    if (filteredValue.length > 0) {
      const searchTerm = filteredValue[0].toLowerCase();
      result = result.filter(model =>
        model.model_name.toLowerCase().includes(searchTerm)
      );
    }

    return result;
  }, [activeKey, models, filteredValue]);

  const rowSelection = useMemo(
    () => ({
      onChange: (selectedRowKeys, selectedRows) => {
        setSelectedRowKeys(selectedRowKeys);
      },
    }),
    [],
  );

  const displayPrice = (usdPrice) => {
    let priceInUSD = usdPrice;
    if (showWithRecharge) {
      priceInUSD = usdPrice * priceRate / usdExchangeRate;
    }

    if (currency === 'CNY') {
      return `¥${(priceInUSD * usdExchangeRate).toFixed(3)}`;
    }
    return `$${priceInUSD.toFixed(3)}`;
  };

  const setModelsFormat = (models, groupRatio) => {
    for (let i = 0; i < models.length; i++) {
      models[i].key = models[i].model_name;
      models[i].group_ratio = groupRatio[models[i].model_name];
    }
    models.sort((a, b) => {
      return a.quota_type - b.quota_type;
    });

    models.sort((a, b) => {
      if (a.model_name.startsWith('gpt') && !b.model_name.startsWith('gpt')) {
        return -1;
      } else if (
        !a.model_name.startsWith('gpt') &&
        b.model_name.startsWith('gpt')
      ) {
        return 1;
      } else {
        return a.model_name.localeCompare(b.model_name);
      }
    });

    setModels(models);
  };

  const loadPricing = async () => {
    setLoading(true);
    let url = '/api/pricing';
    const res = await API.get(url);
    const { success, message, data, group_ratio, usable_group } = res.data;
    if (success) {
      setGroupRatio(group_ratio);
      setUsableGroup(usable_group);
      setSelectedGroup(userState.user ? userState.user.group : 'default');
      setModelsFormat(data, group_ratio);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const refresh = async () => {
    await loadPricing();
  };

  const copyText = async (text) => {
    if (await copy(text)) {
      showSuccess(t('已复制：') + text);
    } else {
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

  const handleChange = (value) => {
    if (compositionRef.current.isComposition) {
      return;
    }
    const newFilteredValue = value ? [value] : [];
    setFilteredValue(newFilteredValue);
  };

  const handleCompositionStart = () => {
    compositionRef.current.isComposition = true;
  };

  const handleCompositionEnd = (event) => {
    compositionRef.current.isComposition = false;
    const value = event.target.value;
    const newFilteredValue = value ? [value] : [];
    setFilteredValue(newFilteredValue);
  };

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    showInfo(
      t('当前查看的分组为：{{group}}，倍率为：{{ratio}}', {
        group: group,
        ratio: groupRatio[group],
      }),
    );
  };

  useEffect(() => {
    refresh().then();
  }, []);

  return {
    // 状态
    filteredValue,
    setFilteredValue,
    selectedRowKeys,
    setSelectedRowKeys,
    modalImageUrl,
    setModalImageUrl,
    isModalOpenurl,
    setIsModalOpenurl,
    selectedGroup,
    setSelectedGroup,
    activeKey,
    setActiveKey,
    pageSize,
    setPageSize,
    currency,
    setCurrency,
    showWithRecharge,
    setShowWithRecharge,
    tokenUnit,
    setTokenUnit,
    models,
    loading,
    groupRatio,
    usableGroup,

    // 计算属性
    priceRate,
    usdExchangeRate,
    modelCategories,
    categoryCounts,
    availableCategories,
    filteredModels,
    rowSelection,

    // 用户和状态
    userState,
    statusState,

    // 方法
    displayPrice,
    refresh,
    copyText,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    handleGroupClick,

    // 引用
    compositionRef,

    // 国际化
    t,
  };
}; 