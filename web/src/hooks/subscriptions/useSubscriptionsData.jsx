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

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import { useTableCompactMode } from '../common/useTableCompactMode';

export const useSubscriptionsData = () => {
  const { t } = useTranslation();
  const [compactMode, setCompactMode] = useTableCompactMode('subscriptions');

  // State management
  const [allPlans, setAllPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pricingModels, setPricingModels] = useState([]);

  // Pagination (client-side for now)
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Drawer states
  const [showEdit, setShowEdit] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [sheetPlacement, setSheetPlacement] = useState('left'); // 'left' | 'right'

  // Load pricing models for dropdown
  const loadModels = async () => {
    try {
      const res = await API.get('/api/pricing');
      if (res.data?.success) {
        setPricingModels(res.data.data || []);
      }
    } catch (e) {
      setPricingModels([]);
    }
  };

  // Load subscription plans
  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/subscription/admin/plans');
      if (res.data?.success) {
        const next = res.data.data || [];
        setAllPlans(next);

        // Keep page in range after data changes
        const totalPages = Math.max(1, Math.ceil(next.length / pageSize));
        setActivePage((p) => Math.min(p || 1, totalPages));
      } else {
        showError(res.data?.message || t('加载失败'));
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const refresh = async () => {
    await loadPlans();
  };

  const handlePageChange = (page) => {
    setActivePage(page);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setActivePage(1);
  };

  // Disable plan
  const disablePlan = async (planId) => {
    if (!planId) return;
    setLoading(true);
    try {
      const res = await API.delete(`/api/subscription/admin/plans/${planId}`);
      if (res.data?.success) {
        showSuccess(t('已禁用'));
        await loadPlans();
      } else {
        showError(res.data?.message || t('操作失败'));
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  // Modal control functions
  const closeEdit = () => {
    setShowEdit(false);
    setEditingPlan(null);
  };

  const openCreate = () => {
    setSheetPlacement('left');
    setEditingPlan(null);
    setShowEdit(true);
  };

  const openEdit = (planRecord) => {
    setSheetPlacement('right');
    setEditingPlan(planRecord);
    setShowEdit(true);
  };

  // Initialize data on component mount
  useEffect(() => {
    loadModels();
    loadPlans();
  }, []);

  const planCount = allPlans.length;
  const plans = allPlans.slice(
    Math.max(0, (activePage - 1) * pageSize),
    Math.max(0, (activePage - 1) * pageSize) + pageSize,
  );

  return {
    // Data state
    plans,
    planCount,
    loading,
    pricingModels,

    // Modal state
    showEdit,
    editingPlan,
    sheetPlacement,
    setShowEdit,
    setEditingPlan,

    // UI state
    compactMode,
    setCompactMode,

    // Pagination
    activePage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,

    // Actions
    loadPlans,
    disablePlan,
    refresh,
    closeEdit,
    openCreate,
    openEdit,

    // Translation
    t,
  };
};
