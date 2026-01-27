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
import CardPro from '../../common/ui/CardPro';
import OAuthClientsTable from './OAuthClientsTable';
import OAuthClientsActions from './OAuthClientsActions';
import OAuthClientsFilters from './OAuthClientsFilters';
import EditOAuthClientModal from './modals/EditOAuthClientModal';
import { useOAuthClientsData } from '../../../hooks/oauth-clients/useOAuthClientsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

function OAuthClientsPage() {
  const clientsData = useOAuthClientsData();
  const isMobile = useIsMobile();

  const {
    // Edit state
    showEdit,
    editingClient,
    closeEdit,
    refresh,

    // Actions state
    selectedKeys,
    setEditingClient,
    setShowEdit,
    batchDeleteClients,
    copyText,

    // Filters state
    formInitValues,
    setFormApi,
    searchClients,
    loading,
    searching,

    // Translation
    t,
  } = clientsData;

  return (
    <>
      <EditOAuthClientModal
        refresh={refresh}
        editingClient={editingClient}
        visiable={showEdit}
        handleClose={closeEdit}
        copyText={copyText}
      />

      <CardPro
        type='type1'
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
            <OAuthClientsActions
              selectedKeys={selectedKeys}
              setEditingClient={setEditingClient}
              setShowEdit={setShowEdit}
              batchDeleteClients={batchDeleteClients}
              t={t}
            />

            <div className='w-full md:w-full lg:w-auto order-1 md:order-2'>
              <OAuthClientsFilters
                formInitValues={formInitValues}
                setFormApi={setFormApi}
                searchClients={searchClients}
                loading={loading}
                searching={searching}
                refresh={refresh}
                t={t}
              />
            </div>
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: clientsData.activePage,
          pageSize: clientsData.pageSize,
          total: clientsData.clientCount,
          onPageChange: clientsData.handlePageChange,
          onPageSizeChange: clientsData.handlePageSizeChange,
          isMobile: isMobile,
          t: clientsData.t,
        })}
        t={clientsData.t}
      >
        <OAuthClientsTable {...clientsData} />
      </CardPro>
    </>
  );
}

export default OAuthClientsPage;
