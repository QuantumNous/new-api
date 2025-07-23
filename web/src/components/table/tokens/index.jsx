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
import TokensTable from './TokensTable.jsx';
import TokensActions from './TokensActions.jsx';
import TokensFilters from './TokensFilters.jsx';
import TokensDescription from './TokensDescription.jsx';
import EditTokenModal from './modals/EditTokenModal';
import { useTokensData } from '../../../hooks/tokens/useTokensData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const TokensPage = () => {
  const tokensData = useTokensData();
  const isMobile = useIsMobile();

  const {
    // Edit state
    showEdit,
    editingToken,
    closeEdit,
    refresh,

    // Actions state
    selectedKeys,
    setEditingToken,
    setShowEdit,
    batchCopyTokens,
    batchDeleteTokens,
    copyText,

    // Filters state
    formInitValues,
    setFormApi,
    searchTokens,
    loading,
    searching,

    // Description state
    compactMode,
    setCompactMode,

    // Translation
    t,
  } = tokensData;

  return (
    <>
      <EditTokenModal
        refresh={refresh}
        editingToken={editingToken}
        visiable={showEdit}
        handleClose={closeEdit}
      />

      <CardPro
        type="type1"
        descriptionArea={
          <TokensDescription
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        }
        actionsArea={
          <div className="flex flex-col md:flex-row justify-between items-center gap-2 w-full">
            <TokensActions
              selectedKeys={selectedKeys}
              setEditingToken={setEditingToken}
              setShowEdit={setShowEdit}
              batchCopyTokens={batchCopyTokens}
              batchDeleteTokens={batchDeleteTokens}
              copyText={copyText}
              t={t}
            />

            <div className="w-full md:w-full lg:w-auto order-1 md:order-2">
              <TokensFilters
                formInitValues={formInitValues}
                setFormApi={setFormApi}
                searchTokens={searchTokens}
                loading={loading}
                searching={searching}
                t={t}
              />
            </div>
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: tokensData.activePage,
          pageSize: tokensData.pageSize,
          total: tokensData.tokenCount,
          onPageChange: tokensData.handlePageChange,
          onPageSizeChange: tokensData.handlePageSizeChange,
          isMobile: isMobile,
          t: tokensData.t,
        })}
        t={tokensData.t}
      >
        <TokensTable {...tokensData} />
      </CardPro>
    </>
  );
};

export default TokensPage; 