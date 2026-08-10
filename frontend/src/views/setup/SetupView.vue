<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Check,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  Home,
  KeyRound,
  Presentation,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import BrandMark from '@/components/console/BrandMark.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import LanguageSelector from '@/components/common/LanguageSelector.vue'
import ThemeSwitcher from '@/components/common/ThemeSwitcher.vue'
import TextInput from '@/components/common/TextInput.vue'
import { BRAND_NAME } from '@/constants/branding'
import { useSetupStore } from '@/stores/setup'
import { useAppStore } from '@/stores'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/api/types'
import {
  setupCharacterLength,
  isSetupUsernameWithinLimit,
  type SetupUsageMode,
} from '@/api/setup'

const { t } = useI18n()
const router = useRouter()
const setup = useSetupStore()
const app = useAppStore()
const toast = useToast()
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const fieldError = ref('')
const modeGroup = ref<HTMLElement | null>(null)

const steps = computed(() => [
  {
    title: t('setup.database'),
    description: t('setup.databaseDescription'),
    icon: Database,
  },
  {
    title: t('setup.administrator'),
    description: t('setup.administratorDescription'),
    icon: KeyRound,
  },
  {
    title: t('setup.usage'),
    description: t('setup.usageDescription'),
    icon: Users,
  },
  {
    title: t('setup.review'),
    description: t('setup.reviewDescription'),
    icon: CheckCircle2,
  },
])
const databaseKey = computed(
  () => setup.status?.database_type?.toLowerCase() || ''
)
const databaseLabel = computed(() => {
  if (databaseKey.value === 'sqlite') return t('setup.sqlite')
  if (databaseKey.value === 'mysql') return t('setup.mysql')
  if (databaseKey.value === 'postgres' || databaseKey.value === 'postgresql')
    return t('setup.postgres')
  return setup.status?.database_type || t('setup.unknownDatabase')
})
const databaseHint = computed(() => {
  if (databaseKey.value === 'sqlite') return t('setup.sqliteHint')
  if (databaseKey.value === 'mysql') return t('setup.mysqlHint')
  if (databaseKey.value === 'postgres' || databaseKey.value === 'postgresql')
    return t('setup.postgresHint')
  return t('setup.unknownHint')
})
const databaseIcon = computed(() =>
  databaseKey.value === 'sqlite'
    ? HardDrive
    : databaseKey.value
      ? Server
      : Database
)
const modeOptions = computed(() => [
  {
    value: 'external' as const,
    title: t('setup.external'),
    description: t('setup.externalDescription'),
    icon: Users,
    color: 'var(--accent)',
  },
  {
    value: 'self' as const,
    title: t('setup.self'),
    description: t('setup.selfDescription'),
    icon: Home,
    color: 'var(--status-success-text)',
  },
  {
    value: 'demo' as const,
    title: t('setup.demo'),
    description: t('setup.demoDescription'),
    icon: Presentation,
    color: 'var(--status-info-text)',
  },
])

const isReady = computed(
  () => setup.ready && setup.status && !setup.status.status
)
const currentStep = computed(() => setup.currentStep)

function validateStep(step = currentStep.value): boolean {
  fieldError.value = ''
  if (step !== 1 || setup.status?.root_init) return true
  const username = setup.values.username.trim()
  if (!username) {
    fieldError.value = t('setup.usernameRequired')
    return false
  }
  if (!isSetupUsernameWithinLimit(username)) {
    fieldError.value = t('setup.usernameTooLong')
    return false
  }
  if (setupCharacterLength(setup.values.password) < 8) {
    fieldError.value = t('setup.passwordTooShort')
    return false
  }
  if (setup.values.password !== setup.values.confirmPassword) {
    fieldError.value = t('setup.passwordsMismatch')
    return false
  }
  return true
}

function next() {
  if (!validateStep()) return
  setup.currentStep = Math.min(3, setup.currentStep + 1)
}

function back() {
  fieldError.value = ''
  setup.currentStep = Math.max(0, setup.currentStep - 1)
}

async function initialize() {
  if (!validateStep(1) || setup.submitting) return
  try {
    await setup.submit()
    toast.success(t('setup.initialized'))
    await router.replace({ name: 'home' })
  } catch (error) {
    if (
      setup.submitPhase === 'error' &&
      (setup.phase === 'error' ||
        (error instanceof ApiError &&
          error.code === 'SETUP_CONFIRMATION_FAILED'))
    ) {
      await router.replace({
        name: 'setup-error',
        query: { redirect: '/setup' },
      })
      return
    }
    if (error instanceof ApiError)
      toast.error(error.message || t('setup.submitFailed'))
    else toast.error(t('setup.submitFailed'))
  }
}

function selectMode(value: SetupUsageMode) {
  setup.setValue('usageMode', value)
}

function focusMode(index: number): void {
  modeGroup.value
    ?.querySelectorAll<HTMLButtonElement>('[data-setup-mode]')
    .item(index)
    ?.focus()
}

function handleModeKeydown(event: KeyboardEvent, index: number): void {
  const optionCount = modeOptions.value.length
  let nextIndex: number | null = null

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    nextIndex = (index + 1) % optionCount
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = (index - 1 + optionCount) % optionCount
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = optionCount - 1
  } else if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    selectMode(modeOptions.value[index]!.value)
    return
  }

  if (nextIndex === null) return
  event.preventDefault()
  selectMode(modeOptions.value[nextIndex]!.value)
  focusMode(nextIndex)
}

onMounted(async () => {
  if (!setup.ready) {
    try {
      await setup.load()
    } catch {
      await router.replace({
        name: 'setup-error',
        query: { redirect: '/setup' },
      })
      return
    }
  }
  if (setup.status?.status) await router.replace({ name: 'home' })
  if (!app.initialized) void app.initialize()
})
</script>

<template>
  <main
    class="setup-shell texture-paper draft-grid night-page-texture min-h-screen overflow-x-hidden bg-[var(--page-background)] text-[var(--text-primary)]"
  >
    <header
      class="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8"
      data-handdrawn="navigation-top"
    >
      <div class="flex min-w-0 items-center gap-3">
        <!-- Local brand asset: setup runs before /api/status is meaningful. -->
        <BrandMark class="h-9 w-9 sketch-sm" />
        <div class="min-w-0">
          <p
            class="display-title truncate text-lg font-bold tracking-tight text-[var(--text-primary)]"
          >
            {{ BRAND_NAME }}
          </p>
          <p
            class="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] sm:block"
          >
            {{ t('setup.eyebrow') }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <ThemeSwitcher variant="console" />
        <LanguageSelector variant="console" />
      </div>
    </header>

    <section
      class="mx-auto w-full max-w-[1200px] px-4 pb-12 sm:px-6 lg:px-8 lg:pb-20"
    >
      <div class="mx-auto max-w-[760px] pt-8 text-center sm:pt-12">
        <p
          class="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]"
        >
          {{ t('setup.eyebrow') }}
        </p>
        <h1
          class="gesture-mark display-title mt-3 text-3xl font-bold leading-tight text-[var(--text-primary)] sm:text-5xl"
        >
          {{ t('setup.title') }}
        </h1>
        <p
          class="mx-auto mt-4 max-w-[560px] text-sm leading-6 text-[var(--text-secondary)] sm:text-base"
        >
          {{ t('setup.intro') }}
        </p>
        <div
          class="ink-divider mx-auto mt-6 max-w-[320px]"
          aria-hidden="true"
        />
      </div>

      <ConsoleCard
        v-if="setup.loading || !isReady"
        variant="sketch"
        class="mx-auto mt-12 max-w-[760px] text-center"
      >
        <div
          class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--accent)]"
          aria-hidden="true"
        />
        <p class="mt-4 text-sm font-semibold text-[var(--text-primary)]">
          {{ t('setup.loading') }}
        </p>
        <p class="mt-1 text-xs text-[var(--text-tertiary)]">
          {{ t('setup.loadingDescription') }}
        </p>
      </ConsoleCard>

      <div v-else class="mx-auto mt-10 max-w-[1100px]">
        <ol class="grid gap-3 md:grid-cols-4" :aria-label="t('setup.progress')">
          <li
            v-for="(step, index) in steps"
            :key="step.title"
            class="setup-step pencil-control border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-3"
            :aria-current="index === currentStep ? 'step' : undefined"
            :class="
              index === currentStep
                ? 'setup-step--active'
                : index < currentStep
                  ? 'setup-step--done'
                  : ''
            "
            :data-mobile-hidden="index !== currentStep"
          >
            <div class="flex items-start gap-3">
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                :class="
                  index <= currentStep
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'border-[var(--border-default)] text-[var(--text-tertiary)]'
                "
              >
                <Check
                  v-if="index < currentStep"
                  :size="15"
                  aria-hidden="true"
                />
                <span v-else class="display-number">{{ index + 1 }}</span>
              </span>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-[var(--text-primary)]">
                  {{ step.title }}
                </p>
                <p class="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                  {{ step.description }}
                </p>
              </div>
            </div>
          </li>
        </ol>

        <div
          class="mt-5 flex items-center gap-2 overflow-hidden md:hidden"
          aria-hidden="true"
        >
          <span
            v-for="(_, index) in steps"
            :key="index"
            class="h-1.5 flex-1 rounded-full"
            :class="
              index <= currentStep
                ? 'bg-[var(--accent)]'
                : 'bg-[var(--border-subtle)]'
            "
          />
        </div>

        <ConsoleCard variant="sketch" :padded="false" class="mt-8">
          <div class="p-5 sm:p-8">
            <template v-if="currentStep === 0">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="section-heading">
                    {{ t('setup.detectedDatabase') }}
                  </p>
                  <h2 class="mt-3 text-2xl font-bold">{{ databaseLabel }}</h2>
                </div>
                <component
                  :is="databaseIcon"
                  :size="32"
                  class="text-[var(--accent)]"
                  aria-hidden="true"
                />
              </div>
              <p
                class="mt-5 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]"
              >
                {{ databaseHint }}
              </p>
            </template>

            <template v-else-if="currentStep === 1">
              <div class="flex items-start gap-3">
                <ShieldCheck
                  :size="24"
                  class="mt-0.5 text-[var(--accent)]"
                  aria-hidden="true"
                />
                <div>
                  <h2 class="text-2xl font-bold">
                    {{ t('setup.administrator') }}
                  </h2>
                  <p class="mt-2 text-sm text-[var(--text-secondary)]">
                    {{
                      setup.status?.root_init
                        ? t('setup.rootExists')
                        : t('setup.administratorDescription')
                    }}
                  </p>
                </div>
              </div>
              <div
                v-if="!setup.status?.root_init"
                class="mt-7 grid gap-5 sm:grid-cols-2"
              >
                <div>
                  <label
                    for="setup-username"
                    class="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
                  >
                    {{ t('setup.username') }}
                  </label>
                  <TextInput
                    id="setup-username"
                    v-model="setup.values.username"
                    autocomplete="username"
                    :aria-invalid="Boolean(fieldError)"
                    :aria-describedby="
                      fieldError ? 'setup-account-error' : undefined
                    "
                    :placeholder="t('setup.usernamePlaceholder')"
                  />
                </div>
                <div>
                  <label
                    for="setup-password"
                    class="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
                  >
                    {{ t('setup.password') }}
                  </label>
                  <div class="relative">
                    <TextInput
                      id="setup-password"
                      v-model="setup.values.password"
                      :type="showPassword ? 'text' : 'password'"
                      autocomplete="new-password"
                      :aria-invalid="Boolean(fieldError)"
                      :aria-describedby="
                        fieldError ? 'setup-account-error' : undefined
                      "
                      :placeholder="t('setup.passwordPlaceholder')"
                      class="[&_input]:pr-12"
                    />
                    <button
                      type="button"
                      class="sketch-sm absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[var(--text-tertiary)] transition-colors hover:bg-[var(--state-hover-layer)] hover:text-[var(--text-secondary)] focus-ring"
                      :aria-label="
                        showPassword
                          ? t('setup.hidePassword')
                          : t('setup.showPassword')
                      "
                      @click="showPassword = !showPassword"
                    >
                      <EyeOff v-if="showPassword" :size="17" /><Eye
                        v-else
                        :size="17"
                      />
                    </button>
                  </div>
                </div>
                <div class="sm:col-span-2">
                  <label
                    for="setup-confirm-password"
                    class="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
                  >
                    {{ t('setup.confirmPassword') }}
                  </label>
                  <div class="relative">
                    <TextInput
                      id="setup-confirm-password"
                      v-model="setup.values.confirmPassword"
                      :type="showConfirmPassword ? 'text' : 'password'"
                      autocomplete="new-password"
                      :aria-invalid="Boolean(fieldError)"
                      :aria-describedby="
                        fieldError ? 'setup-account-error' : undefined
                      "
                      :placeholder="t('setup.confirmPasswordPlaceholder')"
                      class="[&_input]:pr-12"
                    />
                    <button
                      type="button"
                      class="sketch-sm absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[var(--text-tertiary)] transition-colors hover:bg-[var(--state-hover-layer)] hover:text-[var(--text-secondary)] focus-ring"
                      :aria-label="
                        showConfirmPassword
                          ? t('setup.hidePassword')
                          : t('setup.showPassword')
                      "
                      @click="showConfirmPassword = !showConfirmPassword"
                    >
                      <EyeOff v-if="showConfirmPassword" :size="17" /><Eye
                        v-else
                        :size="17"
                      />
                    </button>
                  </div>
                </div>
              </div>
              <p
                v-if="fieldError"
                id="setup-account-error"
                class="mt-4 text-sm text-[var(--status-danger-text)]"
                role="alert"
              >
                {{ fieldError }}
              </p>
            </template>

            <template v-else-if="currentStep === 2">
              <h2 class="text-2xl font-bold">{{ t('setup.chooseMode') }}</h2>
              <div
                ref="modeGroup"
                class="mt-6 grid gap-4 md:grid-cols-3"
                role="radiogroup"
                :aria-label="t('setup.chooseMode')"
              >
                <button
                  v-for="(option, index) in modeOptions"
                  :key="option.value"
                  type="button"
                  role="radio"
                  :aria-checked="setup.values.usageMode === option.value"
                  :tabindex="setup.values.usageMode === option.value ? 0 : -1"
                  data-setup-mode
                  class="setup-mode pencil-control min-h-[150px] border bg-[var(--surface-solid)] p-5 text-left transition-all focus-ring"
                  data-handdrawn="control"
                  :class="
                    setup.values.usageMode === option.value
                      ? 'setup-mode--selected'
                      : 'border-[var(--border-subtle)]'
                  "
                  @click="selectMode(option.value)"
                  @keydown="handleModeKeydown($event, index)"
                >
                  <component
                    :is="option.icon"
                    :size="24"
                    :style="{ color: option.color }"
                    aria-hidden="true"
                  />
                  <span class="mt-4 block text-base font-semibold">{{
                    option.title
                  }}</span>
                  <span
                    class="mt-2 block text-sm leading-6 text-[var(--text-secondary)]"
                    >{{ option.description }}</span
                  >
                </button>
              </div>
            </template>

            <template v-else>
              <div class="flex items-start gap-3">
                <CheckCircle2
                  :size="28"
                  class="mt-0.5 text-[var(--status-success-text)]"
                  aria-hidden="true"
                />
                <div>
                  <h2 class="text-2xl font-bold">{{ t('setup.review') }}</h2>
                  <p class="mt-2 text-sm text-[var(--text-secondary)]">
                    {{ t('setup.reviewIntro') }}
                  </p>
                </div>
              </div>
              <dl
                class="setup-review mt-7 border-b border-[var(--border-subtle)]"
                data-handdrawn="ledger-rows"
              >
                <div
                  class="grid gap-1 border-t border-[var(--border-subtle)] py-4 sm:grid-cols-[180px_1fr] sm:gap-4"
                >
                  <dt class="setup-review__key">
                    {{ t('setup.detectedDatabase') }}
                  </dt>
                  <dd class="font-semibold text-[var(--text-primary)]">
                    {{ databaseLabel }}
                  </dd>
                </div>
                <div
                  class="grid gap-1 border-t border-[var(--border-subtle)] py-4 sm:grid-cols-[180px_1fr] sm:gap-4"
                >
                  <dt class="setup-review__key">
                    {{ t('setup.administrator') }}
                  </dt>
                  <dd class="font-semibold text-[var(--text-primary)]">
                    {{
                      setup.status?.root_init
                        ? t('setup.administratorReuse')
                        : t('setup.administratorCreate', {
                            username:
                              setup.values.username.trim() || t('setup.notSet'),
                          })
                    }}
                  </dd>
                </div>
                <div
                  class="grid gap-1 border-t border-[var(--border-subtle)] py-4 sm:grid-cols-[180px_1fr] sm:gap-4"
                >
                  <dt class="setup-review__key">{{ t('setup.mode') }}</dt>
                  <dd class="font-semibold text-[var(--text-primary)]">
                    {{
                      modeOptions.find(
                        (option) => option.value === setup.values.usageMode
                      )?.title
                    }}
                  </dd>
                </div>
              </dl>
            </template>
          </div>

          <div
            class="flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"
          >
            <ConsoleButton
              v-if="currentStep > 0"
              variant="secondary"
              size="lg"
              block
              class="sm:w-auto"
              @click="back"
              >{{ t('setup.back') }}</ConsoleButton
            >
            <span v-else />
            <ConsoleButton
              v-if="currentStep < 3"
              size="lg"
              block
              class="sm:w-auto"
              @click="next"
              >{{ t('setup.next') }}</ConsoleButton
            >
            <ConsoleButton
              v-else
              size="lg"
              block
              class="sm:w-auto"
              :loading="setup.submitting"
              @click="initialize"
              >{{ t('setup.initialize') }}</ConsoleButton
            >
          </div>
        </ConsoleCard>
      </div>
    </section>
  </main>
</template>

<style scoped>
.setup-step {
  min-width: 0;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.setup-step--active {
  border-color: var(--accent);
  box-shadow: var(--elevation-2);
}

.setup-step--done {
  border-color: color-mix(in srgb, var(--accent) 48%, var(--border-subtle));
}

/* Ledger key column: display serif + wide tracking, matching console table heads. */
.setup-review__key {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.setup-mode {
  border-color: var(--border-subtle);
}

.setup-mode:hover,
.setup-mode--selected {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: var(--elevation-2);
}

html.dark .setup-mode--selected {
  background: var(--state-press-layer);
  box-shadow:
    inset 2px 0 0 var(--accent),
    var(--elevation-2);
}

@media (max-width: 767px) {
  .setup-step[data-mobile-hidden='true'] {
    display: none;
  }
}
</style>
