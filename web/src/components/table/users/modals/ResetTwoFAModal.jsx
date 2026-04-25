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

import React from 'react';
import ConfirmDialog from '../../../common/ui/ConfirmDialog';

const ResetTwoFAModal = ({ visible, onCancel, onConfirm, user, t }) => {
  return (
    <ConfirmDialog
      title={t('确认重置两步验证')}
      visible={visible}
      onCancel={onCancel}
      onConfirm={onConfirm}
      cancelText={t('取消')}
      confirmText={t('确定')}
    >
      {t(
        '此操作将禁用该用户当前的两步验证配置，下次登录将不再强制输入验证码，直到用户重新启用。',
      )}{' '}
      {user?.username
        ? t('目标用户：{{username}}', { username: user.username })
        : ''}
    </ConfirmDialog>
  );
};

export default ResetTwoFAModal;
