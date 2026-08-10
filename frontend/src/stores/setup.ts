import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  setupApi,
  buildSetupPayload,
  type SetupFormValues,
  type SetupStatus,
} from '@/api/setup'
import { ApiError } from '@/api/types'

export type SetupLoadPhase = 'idle' | 'loading' | 'ready' | 'error'
export type SetupSubmitPhase = 'idle' | 'submitting' | 'success' | 'error'

const DEFAULT_VALUES: SetupFormValues = {
  username: '',
  password: '',
  confirmPassword: '',
  usageMode: 'external',
}

export const useSetupStore = defineStore('setup', () => {
  const phase = ref<SetupLoadPhase>('idle')
  const submitPhase = ref<SetupSubmitPhase>('idle')
  const status = ref<SetupStatus | null>(null)
  const currentStep = ref(0)
  const values = ref<SetupFormValues>({ ...DEFAULT_VALUES })
  const lastError = ref<unknown>(null)
  let inflight: Promise<SetupStatus> | null = null

  const loading = computed(() => phase.value === 'loading')
  const ready = computed(() => phase.value === 'ready' && status.value !== null)
  const submitting = computed(() => submitPhase.value === 'submitting')

  function clearSensitiveValues(): void {
    values.value.password = ''
    values.value.confirmPassword = ''
  }

  async function load(force = false): Promise<SetupStatus> {
    if (!force && ready.value && status.value) return status.value
    if (!force && phase.value === 'error') {
      throw (
        lastError.value ??
        new ApiError('Setup status is unavailable', {
          status: 503,
          code: 'SETUP_STATUS_UNAVAILABLE',
        })
      )
    }
    if (inflight) return inflight

    phase.value = 'loading'
    lastError.value = null
    inflight = setupApi
      .status()
      .then((result) => {
        status.value = result
        phase.value = 'ready'
        if (result.status || result.root_init) {
          values.value.username = ''
          clearSensitiveValues()
        }
        return result
      })
      .catch((error: unknown) => {
        phase.value = 'error'
        lastError.value = error
        throw error
      })
      .finally(() => {
        inflight = null
      })
    return inflight
  }

  async function retry(): Promise<SetupStatus> {
    return load(true)
  }

  async function submit(): Promise<SetupStatus> {
    if (submitting.value) {
      throw new ApiError('Setup submission is already in progress', {
        status: 409,
        code: 'SETUP_SUBMIT_IN_PROGRESS',
      })
    }
    if (!status.value) {
      throw new ApiError('Setup status is not available', {
        status: 409,
        code: 'SETUP_STATUS_MISSING',
      })
    }

    submitPhase.value = 'submitting'
    lastError.value = null
    try {
      await setupApi.submit(
        buildSetupPayload(values.value, status.value.root_init)
      )
      clearSensitiveValues()
      const confirmed = await load(true)
      if (!confirmed.status) {
        throw new ApiError('Setup status could not be confirmed', {
          status: 502,
          code: 'SETUP_CONFIRMATION_FAILED',
        })
      }
      submitPhase.value = 'success'
      return confirmed
    } catch (error) {
      submitPhase.value = 'error'
      lastError.value = error
      throw error
    }
  }

  function setValue<K extends keyof SetupFormValues>(
    key: K,
    value: SetupFormValues[K]
  ): void {
    values.value[key] = value
  }

  function resetWizard(): void {
    currentStep.value = 0
    values.value = { ...DEFAULT_VALUES }
    submitPhase.value = 'idle'
  }

  return {
    phase,
    submitPhase,
    status,
    currentStep,
    values,
    loading,
    ready,
    submitting,
    lastError,
    load,
    retry,
    submit,
    setValue,
    resetWizard,
  }
})
