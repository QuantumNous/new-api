import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import { adminOperatorLevel, canManageAdminUser } from '@/constants/adminUsers'
import { useAuthStore } from '@/stores/auth'
import type {
  AdminUser,
  AdminUserCreateInput,
  AdminUserPage,
  AdminUserSortBy,
  AdminUserSortOrder,
  AdminUserUpdateInput,
} from '@/types/console'

type UserRowAction = 'status' | 'quota'
type UserCrudAction = 'create' | 'edit' | 'delete'
type UserBulkAction = 'delete' | 'enable' | 'disable'

export function useAdminUsers() {
  const { t } = useI18n()
  const toast = useToast()
  const auth = useAuthStore()

  const rows = ref<AdminUser[]>([])
  const total = ref(0)
  const roleCounts = ref<Record<string, number>>({})
  const statusCounts = ref<Record<string, number>>({})
  const page = ref(1)
  const pageSize = ref(20)
  const keyword = ref('')
  const role = ref('')
  const status = ref('')
  const sortBy = ref<AdminUserSortBy>('id')
  const sortOrder = ref<AdminUserSortOrder>('desc')
  const loading = ref(true)
  const refreshing = ref(false)
  const initialError = ref('')
  const busy = ref<Map<number, UserRowAction>>(new Map())
  const crudAction = ref<{ action: UserCrudAction; id: number | null } | null>(
    null
  )
  const bulkAction = ref<UserBulkAction | null>(null)

  const isCrudBusy = computed(() => crudAction.value !== null)
  const isBulkBusy = computed(() => bulkAction.value !== null)
  const canMutate = computed(
    () =>
      !loading.value &&
      !refreshing.value &&
      !isCrudBusy.value &&
      !isBulkBusy.value &&
      busy.value.size === 0
  )

  /**
   * Authority comes from the store's capability flags, never from
   * `user.role` — `isDemoUser` pins the persisted demo role to 1 as an
   * anti-escalation guard, so the role field is not an authority signal.
   */
  const operatorLevel = computed(() => adminOperatorLevel(auth))
  const operator = computed(() =>
    auth.user ? { id: auth.user.id, level: operatorLevel.value } : null
  )

  /** UI affordance only. The server refuses the same cases independently. */
  function canManage(user: AdminUser): boolean {
    return canManageAdminUser(user, operator.value)
  }

  function isSelf(user: AdminUser): boolean {
    return auth.user?.id === user.id
  }

  function isBusy(id: number, action: UserRowAction): boolean {
    return busy.value.get(id) === action
  }

  function isRowBusy(id: number): boolean {
    return isCrudBusy.value || isBulkBusy.value || busy.value.has(id)
  }

  function isCrudActionBusy(action: UserCrudAction, id?: number): boolean {
    return (
      crudAction.value?.action === action &&
      (id === undefined || crudAction.value.id === id)
    )
  }

  function isBulkActionBusy(action: UserBulkAction): boolean {
    return bulkAction.value === action
  }

  function setBusy(id: number, action: UserRowAction | null) {
    const next = new Map(busy.value)
    if (action) next.set(id, action)
    else next.delete(id)
    busy.value = next
  }

  function replaceUser(user: AdminUser) {
    const index = rows.value.findIndex((item) => item.id === user.id)
    if (index >= 0) rows.value.splice(index, 1, user)
  }

  let crudController: AbortController | null = null
  let bulkController: AbortController | null = null
  const listRequest = useLatestRequest()
  let searchTimer = 0

  async function load(options: { background?: boolean } = {}) {
    const background = options.background === true && rows.value.length > 0

    if (background) refreshing.value = true
    else loading.value = true
    if (rows.value.length === 0) initialError.value = ''

    const trimmed = keyword.value.trim()
    const result = await listRequest.run((signal) =>
      api.get<AdminUserPage>(
        trimmed ? '/api/user/search' : '/api/user/',
        {
          p: page.value,
          page_size: pageSize.value,
          role: role.value || undefined,
          status: status.value || undefined,
          sort_by: sortBy.value,
          sort_order: sortOrder.value,
          keyword: trimmed || undefined,
        },
        { signal }
      )
    )
    if (result.stale) return
    loading.value = false
    refreshing.value = false
    if (!result.ok) {
      const message =
        result.error instanceof ApiError
          ? result.error.message
          : String(result.error)
      if (rows.value.length === 0) initialError.value = message
      else toast.error(message)
      return
    }
    rows.value = result.value.items
    total.value = result.value.total
    roleCounts.value = result.value.role_counts
    statusCounts.value = result.value.status_counts
    initialError.value = ''
  }

  function reloadFromFirstPage() {
    window.clearTimeout(searchTimer)
    if (page.value === 1) void load()
    else page.value = 1
  }

  watch(keyword, () => {
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(reloadFromFirstPage, 300)
  })
  watch([role, status, sortBy, sortOrder], reloadFromFirstPage)
  watch(pageSize, reloadFromFirstPage)
  watch(page, () => void load())

  async function runRowAction(
    user: AdminUser,
    action: UserRowAction,
    request: () => Promise<AdminUser>,
    successKey: string
  ): Promise<boolean> {
    if (!canManage(user) || isRowBusy(user.id)) return false
    setBusy(user.id, action)
    try {
      replaceUser(await request())
      toast.success(t(successKey))
      return true
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : String(error))
      return false
    } finally {
      setBusy(user.id, null)
    }
  }

  function toggleStatus(user: AdminUser): Promise<boolean> {
    const nextStatus = user.status === 1 ? 2 : 1
    return runRowAction(
      user,
      'status',
      () =>
        api.post<AdminUser>(`/api/user/${user.id}/status`, {
          status: nextStatus,
        }),
      nextStatus === 1 ? 'users.enabled' : 'users.disabled'
    )
  }

  function adjustQuota(user: AdminUser, delta: number): Promise<boolean> {
    return runRowAction(
      user,
      'quota',
      () => api.post<AdminUser>('/api/user/quota', { id: user.id, delta }),
      delta > 0 ? 'users.quotaGranted' : 'users.quotaDeducted'
    )
  }

  async function runCrudAction(
    action: UserCrudAction,
    id: number | null,
    request: (signal: AbortSignal) => Promise<void>
  ): Promise<boolean> {
    if (!canMutate.value) return false
    const controller = new AbortController()
    crudController = controller
    crudAction.value = { action, id }
    try {
      await request(controller.signal)
      return true
    } catch (error) {
      if (controller.signal.aborted) return false
      toast.error(error instanceof ApiError ? error.message : String(error))
      return false
    } finally {
      if (crudController === controller) crudController = null
      crudAction.value = null
    }
  }

  function createUser(input: AdminUserCreateInput): Promise<boolean> {
    return runCrudAction('create', null, async (signal) => {
      await api.post<AdminUser>('/api/user/', input, { signal })
      toast.success(t('users.created'))
      if (page.value !== 1) page.value = 1
      else await load({ background: true })
    })
  }

  function updateUserDetails(
    user: AdminUser,
    input: AdminUserUpdateInput
  ): Promise<boolean> {
    return runCrudAction('edit', user.id, async (signal) => {
      const updated = await api.put<AdminUser>(
        '/api/user/',
        { id: user.id, ...input },
        { signal }
      )
      replaceUser(updated)
      toast.success(t('users.updated'))
      await load({ background: true })
    })
  }

  function deleteUser(user: AdminUser): Promise<boolean> {
    return runCrudAction('delete', user.id, async (signal) => {
      await api.delete<{ id: number }>(`/api/user/${user.id}`, undefined, {
        signal,
      })
      toast.success(t('users.deleted'))
      if (rows.value.length === 1 && page.value > 1) page.value -= 1
      else await load({ background: true })
    })
  }

  async function runBulkAction(
    action: UserBulkAction,
    request: (signal: AbortSignal) => Promise<void>
  ): Promise<boolean> {
    if (!canMutate.value) return false
    const controller = new AbortController()
    bulkController = controller
    bulkAction.value = action
    try {
      await request(controller.signal)
      return true
    } catch (error) {
      if (controller.signal.aborted) return false
      toast.error(error instanceof ApiError ? error.message : String(error))
      return false
    } finally {
      if (bulkController === controller) bulkController = null
      bulkAction.value = null
    }
  }

  /** Only manageable rows in the requested direction are worth sending. */
  function bulkStatusTargets(
    action: Extract<UserBulkAction, 'enable' | 'disable'>,
    users: AdminUser[]
  ): AdminUser[] {
    const wanted = action === 'enable' ? 1 : 2
    return users.filter((user) => canManage(user) && user.status !== wanted)
  }

  function updateUsersStatus(
    action: Extract<UserBulkAction, 'enable' | 'disable'>,
    users: AdminUser[]
  ): Promise<boolean> {
    const targets = bulkStatusTargets(action, users)
    if (targets.length === 0) return Promise.resolve(false)

    return runBulkAction(action, async (signal) => {
      const changed = await api.post<number>(
        '/api/user/status/batch',
        {
          ids: targets.map((user) => user.id),
          status: action === 'enable' ? 1 : 2,
        },
        { signal }
      )
      toast.success(
        t(action === 'enable' ? 'users.bulkEnabled' : 'users.bulkDisabled', {
          count: changed,
        })
      )
      await load({ background: true })
    })
  }

  function deleteSelectedUsers(users: AdminUser[]): Promise<boolean> {
    const ids = users.filter(canManage).map((user) => user.id)
    if (ids.length === 0) return Promise.resolve(false)

    return runBulkAction('delete', async (signal) => {
      const deleted = await api.post<number>(
        '/api/user/batch',
        { ids },
        { signal }
      )
      toast.success(t('users.bulkDeleted', { count: deleted }))
      const clearsPage = rows.value.every((user) => ids.includes(user.id))
      if (clearsPage && page.value > 1) page.value -= 1
      else await load({ background: true })
    })
  }

  onMounted(() => void load())
  onBeforeUnmount(() => {
    crudController?.abort()
    bulkController?.abort()
    window.clearTimeout(searchTimer)
  })

  return {
    rows,
    total,
    roleCounts,
    statusCounts,
    page,
    pageSize,
    keyword,
    role,
    status,
    sortBy,
    sortOrder,
    loading,
    refreshing,
    initialError,
    isCrudBusy,
    isBulkBusy,
    canMutate,
    operatorLevel,
    operator,
    canManage,
    isSelf,
    load,
    isBusy,
    isRowBusy,
    isCrudActionBusy,
    isBulkActionBusy,
    toggleStatus,
    adjustQuota,
    createUser,
    updateUserDetails,
    deleteUser,
    updateUsersStatus,
    deleteSelectedUsers,
  }
}
