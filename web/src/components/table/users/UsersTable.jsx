/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// /console/user table — thin glue around the shared HeroTable wrapper.
//
// No row selection here (the users page has no batch operations);
// HeroTable falls back to display-only mode in that case.
//
// Disabled / soft-deleted users are dimmed with `opacity-60` so the
// visual disabled cue matches the rest of the console.

import React, { useMemo, useState } from 'react';
import HeroTable from '../../common/ui/HeroTable';
import { getUsersColumns } from './UsersColumnDefs';
import PromoteUserModal from './modals/PromoteUserModal';
import DemoteUserModal from './modals/DemoteUserModal';
import EnableDisableUserModal from './modals/EnableDisableUserModal';
import DeleteUserModal from './modals/DeleteUserModal';
import ResetPasskeyModal from './modals/ResetPasskeyModal';
import ResetTwoFAModal from './modals/ResetTwoFAModal';
import UserSubscriptionsModal from './modals/UserSubscriptionsModal';

const UsersTable = (usersData) => {
  const {
    users,
    loading,
    activePage,
    compactMode,
    setEditingUser,
    setShowEditUser,
    manageUser,
    refresh,
    resetUserPasskey,
    resetUserTwoFA,
    t,
  } = usersData;

  // Modal states
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showDemoteModal, setShowDemoteModal] = useState(false);
  const [showEnableDisableModal, setShowEnableDisableModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalUser, setModalUser] = useState(null);
  const [enableDisableAction, setEnableDisableAction] = useState('');
  const [showResetPasskeyModal, setShowResetPasskeyModal] = useState(false);
  const [showResetTwoFAModal, setShowResetTwoFAModal] = useState(false);
  const [showUserSubscriptionsModal, setShowUserSubscriptionsModal] =
    useState(false);

  // Modal handlers
  const showPromoteUserModal = (user) => {
    setModalUser(user);
    setShowPromoteModal(true);
  };

  const showDemoteUserModal = (user) => {
    setModalUser(user);
    setShowDemoteModal(true);
  };

  const showEnableDisableUserModal = (user, action) => {
    setModalUser(user);
    setEnableDisableAction(action);
    setShowEnableDisableModal(true);
  };

  const showDeleteUserModal = (user) => {
    setModalUser(user);
    setShowDeleteModal(true);
  };

  const showResetPasskeyUserModal = (user) => {
    setModalUser(user);
    setShowResetPasskeyModal(true);
  };

  const showResetTwoFAUserModal = (user) => {
    setModalUser(user);
    setShowResetTwoFAModal(true);
  };

  const showUserSubscriptionsUserModal = (user) => {
    setModalUser(user);
    setShowUserSubscriptionsModal(true);
  };

  // Modal confirm handlers
  const handlePromoteConfirm = () => {
    manageUser(modalUser.id, 'promote', modalUser);
    setShowPromoteModal(false);
  };

  const handleDemoteConfirm = () => {
    manageUser(modalUser.id, 'demote', modalUser);
    setShowDemoteModal(false);
  };

  const handleEnableDisableConfirm = () => {
    manageUser(modalUser.id, enableDisableAction, modalUser);
    setShowEnableDisableModal(false);
  };

  const handleResetPasskeyConfirm = async () => {
    await resetUserPasskey(modalUser);
    setShowResetPasskeyModal(false);
  };

  const handleResetTwoFAConfirm = async () => {
    await resetUserTwoFA(modalUser);
    setShowResetTwoFAModal(false);
  };

  const columns = useMemo(() => {
    return getUsersColumns({
      t,
      setEditingUser,
      setShowEditUser,
      showPromoteModal: showPromoteUserModal,
      showDemoteModal: showDemoteUserModal,
      showEnableDisableModal: showEnableDisableUserModal,
      showDeleteModal: showDeleteUserModal,
      showResetPasskeyModal: showResetPasskeyUserModal,
      showResetTwoFAModal: showResetTwoFAUserModal,
      showUserSubscriptionsModal: showUserSubscriptionsUserModal,
    });
  }, [
    t,
    setEditingUser,
    setShowEditUser,
    showPromoteUserModal,
    showDemoteUserModal,
    showEnableDisableUserModal,
    showDeleteUserModal,
    showResetPasskeyUserModal,
    showResetTwoFAUserModal,
    showUserSubscriptionsUserModal,
  ]);

  // Compact mode strips `fixed` from the operations column so it
  // joins the natural horizontal flow instead of being pinned right.
  const tableColumns = useMemo(() => {
    return compactMode
      ? columns.map((col) => {
          if (col.dataIndex === 'operate') {
            const { fixed, ...rest } = col;
            return rest;
          }
          return col;
        })
      : columns;
  }, [compactMode, columns]);

  return (
    <>
      <HeroTable
        ariaLabel={t('用户列表')}
        columns={tableColumns}
        dataSource={users || []}
        loading={loading}
        emptyDescription={t('搜索无结果')}
        rowClassName={(record) =>
          record.DeletedAt !== null || record.status !== 1
            ? 'opacity-60'
            : ''
        }
      />

      {/* Modal components */}
      <PromoteUserModal
        visible={showPromoteModal}
        onCancel={() => setShowPromoteModal(false)}
        onConfirm={handlePromoteConfirm}
        user={modalUser}
        t={t}
      />

      <DemoteUserModal
        visible={showDemoteModal}
        onCancel={() => setShowDemoteModal(false)}
        onConfirm={handleDemoteConfirm}
        user={modalUser}
        t={t}
      />

      <EnableDisableUserModal
        visible={showEnableDisableModal}
        onCancel={() => setShowEnableDisableModal(false)}
        onConfirm={handleEnableDisableConfirm}
        user={modalUser}
        action={enableDisableAction}
        t={t}
      />

      <DeleteUserModal
        visible={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        user={modalUser}
        users={users}
        activePage={activePage}
        refresh={refresh}
        manageUser={manageUser}
        t={t}
      />

      <ResetPasskeyModal
        visible={showResetPasskeyModal}
        onCancel={() => setShowResetPasskeyModal(false)}
        onConfirm={handleResetPasskeyConfirm}
        user={modalUser}
        t={t}
      />

      <ResetTwoFAModal
        visible={showResetTwoFAModal}
        onCancel={() => setShowResetTwoFAModal(false)}
        onConfirm={handleResetTwoFAConfirm}
        user={modalUser}
        t={t}
      />

      <UserSubscriptionsModal
        visible={showUserSubscriptionsModal}
        onCancel={() => setShowUserSubscriptionsModal(false)}
        user={modalUser}
        t={t}
        onSuccess={() => refresh?.()}
      />
    </>
  );
};

export default UsersTable;
