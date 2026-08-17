<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '@/api/console'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import { useSystemSettings } from '@/composables/useSystemSettings'
import { useToast } from '@/composables/useToast'

interface CatalogProduct {
  id: string
  name: string
  status: string
}

interface CatalogStore {
  id: string
  name: string
  status: string
  prodEnabled: boolean
  onetimeProducts: CatalogProduct[]
}

interface Catalog {
  stores: CatalogStore[]
}

const emit = defineEmits<{ saved: [] }>()

const toast = useToast()
const { load, rawValue, isSecretConfigured } = useSystemSettings()
const loadingCatalog = ref(false)
const saving = ref(false)
const creating = ref(false)
const catalog = ref<Catalog | null>(null)
const form = reactive({
  merchantId: '',
  privateKey: '',
  returnUrl: '',
  storeId: '',
  productId: '',
})

const selectedStore = computed(() =>
  catalog.value?.stores.find((store) => store.id === form.storeId)
)
const privateKeyConfigured = computed(() =>
  isSecretConfigured('WaffoPancakePrivateKey')
)

function syncForm() {
  form.merchantId = String(rawValue('WaffoPancakeMerchantID', ''))
  form.returnUrl = String(rawValue('WaffoPancakeReturnURL', ''))
  form.storeId = String(rawValue('WaffoPancakeStoreID', ''))
  form.productId = String(rawValue('WaffoPancakeProductID', ''))
}

function ensureProductBelongsToStore() {
  if (
    !selectedStore.value?.onetimeProducts.some(
      (item) => item.id === form.productId
    )
  ) {
    form.productId = ''
  }
}

async function saveConfiguration(loadCatalogAfterSave = false) {
  if (!form.merchantId.trim() || !form.returnUrl.trim()) {
    toast.error('请填写 Waffo Pancake 商户 ID 和返回地址。')
    return false
  }
  if (!form.privateKey.trim() && !privateKeyConfigured.value) {
    toast.error('请填写 Waffo Pancake 私钥。')
    return false
  }

  saving.value = true
  try {
    await api.post('/api/option/waffo-pancake/save', {
      merchant_id: form.merchantId,
      private_key: form.privateKey,
      return_url: form.returnUrl,
      store_id: form.storeId,
      product_id: form.productId,
    })
    form.privateKey = ''
    emit('saved')
    toast.success('Waffo Pancake 配置已保存')
    if (loadCatalogAfterSave) await loadCatalog()
    return true
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
    return false
  } finally {
    saving.value = false
  }
}

async function loadCatalog() {
  loadingCatalog.value = true
  try {
    catalog.value = await api.get<Catalog>('/api/option/waffo-pancake/catalog')
    ensureProductBelongsToStore()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    loadingCatalog.value = false
  }
}

async function createPair() {
  if (!form.merchantId.trim() || !form.returnUrl.trim()) {
    toast.error('请填写商户 ID 和返回地址后再创建店铺与产品。')
    return
  }
  if (!form.privateKey.trim() && !privateKeyConfigured.value) {
    toast.error('请填写私钥后再创建店铺与产品。')
    return
  }

  creating.value = true
  try {
    const result = await api.post<{
      store_id: string
      product_id: string
    }>('/api/option/waffo-pancake/pair', {
      merchant_id: form.merchantId,
      private_key: form.privateKey,
      return_url: form.returnUrl,
    })
    form.storeId = result.store_id
    form.productId = result.product_id
    toast.success('已创建店铺与产品，请确认后保存配置。')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  await load()
  syncForm()
})
</script>

<template>
  <section class="waffo-pancake-panel" aria-label="Waffo Pancake 配置">
    <div class="grid gap-4 sm:grid-cols-2">
      <FormField label="商户 ID">
        <TextInput v-model="form.merchantId" autocomplete="off" />
      </FormField>
      <FormField label="私钥">
        <TextInput
          v-model="form.privateKey"
          type="password"
          autocomplete="new-password"
        />
        <p v-if="privateKeyConfigured" class="waffo-hint">
          已配置。留空会保留现有私钥。
        </p>
      </FormField>
      <FormField label="返回地址" class="sm:col-span-2">
        <TextInput v-model="form.returnUrl" type="url" autocomplete="off" />
      </FormField>
    </div>

    <div class="waffo-actions">
      <ConsoleButton
        variant="secondary"
        size="sm"
        :loading="creating"
        @click="createPair"
      >
        创建店铺和产品
      </ConsoleButton>
      <ConsoleButton
        variant="secondary"
        size="sm"
        :loading="saving || loadingCatalog"
        @click="saveConfiguration(true)"
      >
        保存并加载目录
      </ConsoleButton>
      <ConsoleButton size="sm" :loading="saving" @click="saveConfiguration()">
        保存网关配置
      </ConsoleButton>
    </div>

    <div v-if="catalog" class="mt-5 grid gap-4 sm:grid-cols-2">
      <FormField label="店铺">
        <select
          v-model="form.storeId"
          class="waffo-select"
          @change="ensureProductBelongsToStore"
        >
          <option value="">选择店铺</option>
          <option
            v-for="store in catalog.stores"
            :key="store.id"
            :value="store.id"
          >
            {{ store.name }} ({{ store.id }})
          </option>
        </select>
      </FormField>
      <FormField label="一次性产品">
        <select
          v-model="form.productId"
          class="waffo-select"
          :disabled="!selectedStore"
        >
          <option value="">选择产品</option>
          <option
            v-for="product in selectedStore?.onetimeProducts ?? []"
            :key="product.id"
            :value="product.id"
          >
            {{ product.name }} ({{ product.id }})
          </option>
        </select>
      </FormField>
    </div>
  </section>
</template>

<style scoped>
.waffo-pancake-panel {
  margin-top: 1.5rem;
  border-top: 1px dashed var(--border-default);
  padding-top: 1rem;
}
.waffo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}
.waffo-select {
  width: 100%;
  height: 2.75rem;
  border: 1.5px solid var(--border-default);
  border-radius: var(--sketch-border-radius-sm);
  background: transparent;
  padding: 0 0.75rem;
  color: var(--text-primary);
  font: inherit;
}
.waffo-select:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.waffo-hint {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--signal);
}
</style>
