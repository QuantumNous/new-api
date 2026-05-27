/*
Copyright (C) 2023-2026 QuantumNous

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
import { useCallback, useEffect, useState } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { getInviteCodes, isApiSuccess } from '../api'
import type { InviteCode, InviteCodeUsageFilter } from '../types'

interface UseInviteCodesOptions {
  initialPage?: number
  initialPageSize?: number
  initialUsageFilter?: InviteCodeUsageFilter
}

export function useInviteCodes(options: UseInviteCodesOptions = {}) {
  const {
    initialPage = 1,
    initialPageSize = 10,
    initialUsageFilter = 'all',
  } = options
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [pageSize] = useState(initialPageSize)
  const [usageFilter, setUsageFilter] =
    useState<InviteCodeUsageFilter>(initialUsageFilter)
  const [loading, setLoading] = useState(false)

  const fetchInviteCodes = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getInviteCodes(page, pageSize, usageFilter)
      if (isApiSuccess(response) && response.data) {
        setInviteCodes(response.data.items || [])
        setTotal(response.data.total || 0)
        return
      }
      toast.error(
        response.message || i18next.t('Failed to load invitation codes')
      )
      setInviteCodes([])
      setTotal(0)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch invitation codes:', error)
      toast.error(i18next.t('Failed to load invitation codes'))
      setInviteCodes([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, usageFilter])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(Math.max(1, newPage))
  }, [])

  const handleUsageFilterChange = useCallback(
    (newUsageFilter: InviteCodeUsageFilter) => {
      setUsageFilter(newUsageFilter)
      setPage(1)
    },
    []
  )

  const refreshFirstPage = useCallback(async () => {
    if (page === 1) {
      await fetchInviteCodes()
      return
    }
    setPage(1)
  }, [fetchInviteCodes, page])

  useEffect(() => {
    void Promise.resolve().then(fetchInviteCodes)
  }, [fetchInviteCodes])

  return {
    inviteCodes,
    total,
    page,
    pageSize,
    usageFilter,
    loading,
    handlePageChange,
    handleUsageFilterChange,
    refresh: fetchInviteCodes,
    refreshFirstPage,
  }
}
