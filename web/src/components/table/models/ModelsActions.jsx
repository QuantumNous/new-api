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

import React, { useState } from 'react';
import MissingModelsModal from './modals/MissingModelsModal.jsx';
import PrefillGroupManagement from './modals/PrefillGroupManagement.jsx';
import EditPrefillGroupModal from './modals/EditPrefillGroupModal.jsx';
import { Button, Modal } from '@douyinfe/semi-ui';
import { showSuccess, showError, copy } from '../../../helpers';
import CompactModeToggle from '../../common/ui/CompactModeToggle';
import SelectionNotification from './components/SelectionNotification.jsx';

const ModelsActions = ({
  selectedKeys,
  setSelectedKeys,
  setEditingModel,
  setShowEdit,
  batchDeleteModels,
  compactMode,
  setCompactMode,
  t,
}) => {
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [showAddPrefill, setShowAddPrefill] = useState(false);
  const [prefillInit, setPrefillInit] = useState({ id: undefined });

  // Handle delete selected models with confirmation
  const handleDeleteSelectedModels = () => {
    setShowDeleteModal(true);
  };

  // Handle delete confirmation
  const handleConfirmDelete = () => {
    batchDeleteModels();
    setShowDeleteModal(false);
  };

  // Handle clear selection
  const handleClearSelected = () => {
    setSelectedKeys([]);
  };

  // Handle add selected models to prefill group
  const handleCopyNames = async () => {
    const text = selectedKeys.map(m => m.model_name).join(',');
    if (!text) return;
    const ok = await copy(text);
    if (ok) {
      showSuccess(t('已复制模型名称'));
    } else {
      showError(t('复制失败'));
    }
  };

  const handleAddToPrefill = () => {
    // Prepare initial data
    const items = selectedKeys.map((m) => m.model_name);
    setPrefillInit({ id: undefined, type: 'model', items });
    setShowAddPrefill(true);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1">
        <Button
          type="primary"
          className="flex-1 md:flex-initial"
          onClick={() => {
            setEditingModel({
              id: undefined,
            });
            setShowEdit(true);
          }}
          size="small"
        >
          {t('添加模型')}
        </Button>

        <Button
          type="secondary"
          className="flex-1 md:flex-initial"
          size="small"
          onClick={() => setShowMissingModal(true)}
        >
          {t('未配置模型')}
        </Button>

        <Button
          type="secondary"
          className="flex-1 md:flex-initial"
          size="small"
          onClick={() => setShowGroupManagement(true)}
        >
          {t('预填组管理')}
        </Button>

        <CompactModeToggle
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          t={t}
        />
      </div>

      <SelectionNotification
        selectedKeys={selectedKeys}
        t={t}
        onDelete={handleDeleteSelectedModels}
        onAddPrefill={handleAddToPrefill}
        onClear={handleClearSelected}
        onCopy={handleCopyNames}
      />

      <Modal
        title={t('批量删除模型')}
        visible={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        onOk={handleConfirmDelete}
        type="warning"
      >
        <div>
          {t('确定要删除所选的 {{count}} 个模型吗？', { count: selectedKeys.length })}
        </div>
      </Modal>

      <MissingModelsModal
        visible={showMissingModal}
        onClose={() => setShowMissingModal(false)}
        onConfigureModel={(name) => {
          setEditingModel({ id: undefined, model_name: name });
          setShowEdit(true);
          setShowMissingModal(false);
        }}
        t={t}
      />

      <PrefillGroupManagement
        visible={showGroupManagement}
        onClose={() => setShowGroupManagement(false)}
      />

      <EditPrefillGroupModal
        visible={showAddPrefill}
        onClose={() => setShowAddPrefill(false)}
        editingGroup={prefillInit}
        onSuccess={() => setShowAddPrefill(false)}
      />
    </>
  );
};

export default ModelsActions;