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
import UsersTable from './UsersTable.jsx';
import UsersActions from './UsersActions.jsx';
import UsersFilters from './UsersFilters.jsx';
import UsersDescription from './UsersDescription.jsx';
import AddUserModal from './modals/AddUserModal.jsx';
import EditUserModal from './modals/EditUserModal.jsx';
import { useUsersData } from '../../../hooks/users/useUsersData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const UsersPage = () => {
  const usersData = useUsersData();
  const isMobile = useIsMobile();

  const {
    // Modal state
    showAddUser,
    showEditUser,
    editingUser,
    setShowAddUser,
    closeAddUser,
    closeEditUser,
    refresh,

    // Form state
    formInitValues,
    setFormApi,
    searchUsers,
    loadUsers,
    activePage,
    pageSize,
    groupOptions,
    loading,
    searching,

    // Description state
    compactMode,
    setCompactMode,

    // Translation
    t,
  } = usersData;

  return (
    <>
      <AddUserModal
        refresh={refresh}
        visible={showAddUser}
        handleClose={closeAddUser}
      />

      <EditUserModal
        refresh={refresh}
        visible={showEditUser}
        handleClose={closeEditUser}
        editingUser={editingUser}
      />

      <CardPro
        type="type1"
        descriptionArea={
          <UsersDescription
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        }
        actionsArea={
          <div className="flex flex-col md:flex-row justify-between items-center gap-2 w-full">
            <UsersActions
              setShowAddUser={setShowAddUser}
              t={t}
            />

            <UsersFilters
              formInitValues={formInitValues}
              setFormApi={setFormApi}
              searchUsers={searchUsers}
              loadUsers={loadUsers}
              activePage={activePage}
              pageSize={pageSize}
              groupOptions={groupOptions}
              loading={loading}
              searching={searching}
              t={t}
            />
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: usersData.activePage,
          pageSize: usersData.pageSize,
          total: usersData.userCount,
          onPageChange: usersData.handlePageChange,
          onPageSizeChange: usersData.handlePageSizeChange,
          isMobile: isMobile,
          t: usersData.t,
        })}
        t={usersData.t}
      >
        <UsersTable {...usersData} />
      </CardPro>
    </>
  );
};

export default UsersPage; 