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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import RiskAcknowledgementModal from '../../../common/modals/RiskAcknowledgementModal';
import {
  STATUS_CODE_RISK_I18N_KEYS,
  STATUS_CODE_RISK_CHECKLIST_KEYS,
} from './statusCodeRiskGuard';

const StatusCodeRiskGuardModal = React.memo(function StatusCodeRiskGuardModal({
  visible,
  detailItems,
  onCancel,
  onConfirm,
}) {
  const { t, i18n } = useTranslation();
  const checklist = useMemo(
    () => STATUS_CODE_RISK_CHECKLIST_KEYS.map((item) => t(item)),
    [t, i18n.language],
  );

  return (
    <RiskAcknowledgementModal
      visible={visible}
      title={t(STATUS_CODE_RISK_I18N_KEYS.title)}
      markdownContent={t(STATUS_CODE_RISK_I18N_KEYS.markdown)}
      detailTitle={t(STATUS_CODE_RISK_I18N_KEYS.detailTitle)}
      detailItems={detailItems}
      checklist={checklist}
      inputPrompt={t(STATUS_CODE_RISK_I18N_KEYS.inputPrompt)}
      requiredText={t(STATUS_CODE_RISK_I18N_KEYS.confirmText)}
      inputPlaceholder={t(STATUS_CODE_RISK_I18N_KEYS.inputPlaceholder)}
      mismatchText={t(STATUS_CODE_RISK_I18N_KEYS.mismatchText)}
      cancelText={t('取消')}
      confirmText={t(STATUS_CODE_RISK_I18N_KEYS.confirmButton)}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
});

export default StatusCodeRiskGuardModal;
