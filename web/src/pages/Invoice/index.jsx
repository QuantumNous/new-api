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
import { useTranslation } from 'react-i18next';
import TopupHistoryModal from '../../components/topup/modals/TopupHistoryModal';

const Invoice = () => {
  const { t } = useTranslation();

  return (
    <div
      className='wallet-page console-finance-command-page console-command-center topup-command-center w-full relative min-h-screen lg:min-h-0 mt-[60px]'
      style={{
        width: '100%',
        minHeight: '100vh',
      }}
    >
      <div className='console-dashboard-orb console-dashboard-orb-teal' />
      <div className='console-dashboard-orb console-dashboard-orb-blue' />
      <div className='console-dashboard-orb console-dashboard-orb-amber' />
      <div className='console-finance-command-content'>
        <TopupHistoryModal asPage t={t} />
      </div>
    </div>
  );
};

export default Invoice;
