<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api } from '@/api/console'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import ConsoleToggle from '@/components/common/ConsoleToggle.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import { useToast } from '@/composables/useToast'

interface CustomOAuthProvider {
  id: number
  name: string
  slug: string
  icon: string
  enabled: boolean
  client_id: string
  authorization_endpoint: string
  token_endpoint: string
  user_info_endpoint: string
  scopes: string
  user_id_field: string
  username_field: string
  display_name_field: string
  email_field: string
  well_known: string
  auth_style: number
  access_policy: string
  access_denied_message: string
}

interface DiscoveryResponse {
  well_known_url: string
  discovery: Record<string, unknown>
}

const toast = useToast()
const providers = ref<CustomOAuthProvider[]>([])
const loading = ref(false)
const saving = ref(false)
const discovering = ref(false)
const dialogOpen = ref(false)
const deleteTarget = ref<CustomOAuthProvider | null>(null)
const editingId = ref<number | null>(null)

const form = reactive({
  name: '',
  slug: '',
  icon: '',
  enabled: true,
  client_id: '',
  client_secret: '',
  authorization_endpoint: '',
  token_endpoint: '',
  user_info_endpoint: '',
  scopes: 'openid profile email',
  user_id_field: 'sub',
  username_field: 'preferred_username',
  display_name_field: 'name',
  email_field: 'email',
  well_known: '',
  auth_style: 0,
  access_policy: '',
  access_denied_message: '',
})

function resetForm(provider?: CustomOAuthProvider) {
  editingId.value = provider?.id ?? null
  form.name = provider?.name ?? ''
  form.slug = provider?.slug ?? ''
  form.icon = provider?.icon ?? ''
  form.enabled = provider?.enabled ?? true
  form.client_id = provider?.client_id ?? ''
  form.client_secret = ''
  form.authorization_endpoint = provider?.authorization_endpoint ?? ''
  form.token_endpoint = provider?.token_endpoint ?? ''
  form.user_info_endpoint = provider?.user_info_endpoint ?? ''
  form.scopes = provider?.scopes || 'openid profile email'
  form.user_id_field = provider?.user_id_field || 'sub'
  form.username_field = provider?.username_field || 'preferred_username'
  form.display_name_field = provider?.display_name_field || 'name'
  form.email_field = provider?.email_field || 'email'
  form.well_known = provider?.well_known ?? ''
  form.auth_style = provider?.auth_style ?? 0
  form.access_policy = provider?.access_policy ?? ''
  form.access_denied_message = provider?.access_denied_message ?? ''
}

async function loadProviders() {
  loading.value = true
  try {
    const data = await api.get<CustomOAuthProvider[]>(
      '/api/custom-oauth-provider/'
    )
    providers.value = Array.isArray(data) ? data : []
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetForm()
  dialogOpen.value = true
}

function openEdit(provider: CustomOAuthProvider) {
  resetForm(provider)
  dialogOpen.value = true
}

async function discoverEndpoints() {
  if (!form.well_known.trim()) {
    toast.error('请先填写 Well-Known 地址或 Issuer URL。')
    return
  }

  discovering.value = true
  try {
    const result = await api.post<DiscoveryResponse>(
      '/api/custom-oauth-provider/discovery',
      { well_known_url: form.well_known }
    )
    const discovery = result.discovery
    form.well_known = result.well_known_url
    form.authorization_endpoint = String(discovery.authorization_endpoint ?? '')
    form.token_endpoint = String(discovery.token_endpoint ?? '')
    form.user_info_endpoint = String(discovery.userinfo_endpoint ?? '')
    if (Array.isArray(discovery.scopes_supported)) {
      form.scopes = discovery.scopes_supported
        .filter((scope): scope is string => typeof scope === 'string')
        .join(' ')
    }
    toast.success('已从 Discovery 文档填充 OAuth 端点。')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    discovering.value = false
  }
}

async function saveProvider() {
  if (!form.name.trim() || !form.slug.trim() || !form.client_id.trim()) {
    toast.error('请填写名称、Slug 和 Client ID。')
    return
  }
  if (
    editingId.value === null &&
    (!form.client_secret.trim() ||
      !form.authorization_endpoint.trim() ||
      !form.token_endpoint.trim() ||
      !form.user_info_endpoint.trim())
  ) {
    toast.error('新提供商需要完整的 Client Secret 和 OAuth 端点。')
    return
  }
  if (form.access_policy.trim()) {
    try {
      JSON.parse(form.access_policy)
    } catch {
      toast.error('访问策略必须是有效的 JSON。')
      return
    }
  }

  saving.value = true
  const payload = { ...form }
  try {
    if (editingId.value === null) {
      await api.post('/api/custom-oauth-provider/', payload)
    } else {
      await api.put(`/api/custom-oauth-provider/${editingId.value}`, payload)
    }
    dialogOpen.value = false
    await loadProviders()
    toast.success('OAuth 提供商已保存')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    saving.value = false
  }
}

async function deleteProvider() {
  if (!deleteTarget.value) return
  saving.value = true
  try {
    await api.delete(`/api/custom-oauth-provider/${deleteTarget.value.id}`)
    deleteTarget.value = null
    await loadProviders()
    toast.success('OAuth 提供商已删除')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    saving.value = false
  }
}

onMounted(loadProviders)
</script>

<template>
  <section class="custom-oauth-panel" aria-label="自定义 OAuth 提供商">
    <div class="custom-oauth-panel-header">
      <div>
        <h3>自定义 OAuth 提供商</h3>
        <p>凭据不会在列表或编辑表单中回显。</p>
      </div>
      <ConsoleButton size="sm" @click="openCreate">新增提供商</ConsoleButton>
    </div>

    <div v-if="loading" class="py-4 text-sm text-[var(--text-tertiary)]">
      加载中…
    </div>
    <div
      v-else-if="providers.length === 0"
      class="py-4 text-sm text-[var(--text-tertiary)]"
    >
      尚未配置自定义 OAuth 提供商。
    </div>
    <div v-else class="custom-oauth-list">
      <article
        v-for="provider in providers"
        :key="provider.id"
        class="custom-oauth-row"
      >
        <div class="min-w-0">
          <p class="font-semibold text-[var(--text-primary)]">
            {{ provider.name }}
          </p>
          <p
            class="mt-0.5 truncate font-mono text-xs text-[var(--text-tertiary)]"
          >
            {{ provider.slug }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="text-xs"
            :class="
              provider.enabled
                ? 'text-[var(--signal)]'
                : 'text-[var(--text-tertiary)]'
            "
          >
            {{ provider.enabled ? '已启用' : '已停用' }}
          </span>
          <ConsoleButton variant="ghost" size="sm" @click="openEdit(provider)"
            >编辑</ConsoleButton
          >
          <ConsoleButton
            variant="danger"
            size="sm"
            @click="deleteTarget = provider"
            >删除</ConsoleButton
          >
        </div>
      </article>
    </div>
  </section>

  <ConsoleModal
    :open="dialogOpen"
    :title="editingId === null ? '新增 OAuth 提供商' : '编辑 OAuth 提供商'"
    size="lg"
    @close="dialogOpen = false"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <FormField label="名称"><TextInput v-model="form.name" /></FormField>
      <FormField label="Slug"><TextInput v-model="form.slug" /></FormField>
      <FormField label="图标名称"><TextInput v-model="form.icon" /></FormField>
      <FormField label="Client ID"
        ><TextInput v-model="form.client_id"
      /></FormField>
      <FormField label="Client Secret">
        <TextInput
          v-model="form.client_secret"
          type="password"
          autocomplete="new-password"
        />
      </FormField>
      <FormField label="授权端点" class="sm:col-span-2"
        ><TextInput v-model="form.authorization_endpoint" type="url"
      /></FormField>
      <FormField label="Token 端点" class="sm:col-span-2"
        ><TextInput v-model="form.token_endpoint" type="url"
      /></FormField>
      <FormField label="用户信息端点" class="sm:col-span-2"
        ><TextInput v-model="form.user_info_endpoint" type="url"
      /></FormField>
      <FormField label="Scopes"><TextInput v-model="form.scopes" /></FormField>
      <FormField label="Well-Known 地址">
        <div class="flex gap-2">
          <TextInput v-model="form.well_known" type="url" />
          <ConsoleButton
            variant="secondary"
            size="sm"
            :loading="discovering"
            @click="discoverEndpoints"
          >
            Discovery
          </ConsoleButton>
        </div>
      </FormField>
      <FormField label="用户 ID 字段"
        ><TextInput v-model="form.user_id_field"
      /></FormField>
      <FormField label="用户名字段"
        ><TextInput v-model="form.username_field"
      /></FormField>
      <FormField label="显示名字段"
        ><TextInput v-model="form.display_name_field"
      /></FormField>
      <FormField label="邮箱字段"
        ><TextInput v-model="form.email_field"
      /></FormField>
      <FormField label="客户端认证方式">
        <select v-model.number="form.auth_style" class="custom-oauth-select">
          <option :value="0">自动</option>
          <option :value="1">请求参数</option>
          <option :value="2">Basic Auth Header</option>
        </select>
      </FormField>
      <FormField label="访问拒绝消息"
        ><TextInput v-model="form.access_denied_message"
      /></FormField>
      <FormField label="访问策略 JSON" class="sm:col-span-2">
        <textarea
          v-model="form.access_policy"
          rows="4"
          class="custom-oauth-textarea"
          spellcheck="false"
        />
      </FormField>
      <div
        class="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 sm:col-span-2"
      >
        <span class="text-sm font-semibold text-[var(--text-primary)]"
          >启用提供商</span
        >
        <ConsoleToggle v-model="form.enabled" label="启用提供商" />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-3">
        <ConsoleButton
          variant="secondary"
          :disabled="saving"
          @click="dialogOpen = false"
          >取消</ConsoleButton
        >
        <ConsoleButton :loading="saving" @click="saveProvider"
          >保存提供商</ConsoleButton
        >
      </div>
    </template>
  </ConsoleModal>

  <ConfirmDialog
    :open="deleteTarget !== null"
    title="删除 OAuth 提供商"
    :message="`将删除 ${deleteTarget?.name ?? ''}。存在用户绑定时服务器会拒绝该操作。`"
    :loading="saving"
    confirm-text="确认删除"
    @cancel="deleteTarget = null"
    @confirm="deleteProvider"
  />
</template>

<style scoped>
.custom-oauth-panel {
  margin-top: 1.5rem;
  border-top: 1px dashed var(--border-default);
  padding-top: 1rem;
}
.custom-oauth-panel-header,
.custom-oauth-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.custom-oauth-select,
.custom-oauth-textarea {
  width: 100%;
  border: 1.5px solid var(--border-default);
  border-radius: var(--sketch-border-radius-sm);
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  outline: none;
}
.custom-oauth-select {
  height: 2.75rem;
  padding: 0 0.75rem;
}
.custom-oauth-textarea {
  min-height: 6rem;
  resize: vertical;
  padding: 0.75rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
}
.custom-oauth-panel-header h3 {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-primary);
}
.custom-oauth-panel-header p {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}
.custom-oauth-list {
  margin-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
}
.custom-oauth-row {
  min-height: 4rem;
  border-bottom: 1px solid var(--border-subtle);
  padding: 0.75rem 0;
}
@media (max-width: 767px) {
  .custom-oauth-panel-header,
  .custom-oauth-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
