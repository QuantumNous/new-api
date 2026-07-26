<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import BrandMark from '@/components/console/BrandMark.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import IconButton from '@/components/common/IconButton.vue'
import StatusChip from '@/components/common/StatusChip.vue'

const props = defineProps<{
  code: string
  inviteLink: string
  rebatePercent: number
}>()

const emit = defineEmits<{
  copyCode: []
  copyLink: []
  shareX: []
  shareTelegram: []
  shareEmail: []
}>()

const { t } = useI18n()

/**
 * Decorative-only QR matrix (per product decision: pure-style placeholder,
 * not scannable). Modules are derived deterministically from the invite code
 * so the pattern is stable, with three finder squares to read as a QR code.
 */
const MODULES = 21
const qrCells = computed(() => {
  const seedStr = props.code || 'RENREN'
  let h = 0
  for (let i = 0; i < seedStr.length; i++)
    h = (h * 31 + seedStr.charCodeAt(i)) >>> 0
  const cells: boolean[] = []
  for (let i = 0; i < MODULES * MODULES; i++) {
    // xorshift-ish stepping for a stable pseudo-random fill
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    h >>>= 0
    cells.push((h & 7) > 3)
  }
  return cells
})

/** Finder-pattern hit test for the three 7×7 corner squares. */
function isFinder(row: number, col: number) {
  const inSquare = (r0: number, c0: number) =>
    row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7
  return inSquare(0, 0) || inSquare(0, MODULES - 7) || inSquare(MODULES - 7, 0)
}

/** A finder module is dark on its outer ring and 3×3 core (donut shape). */
function finderDark(row: number, col: number) {
  const local = (r0: number, c0: number) => ({ r: row - r0, c: col - c0 })
  let p: { r: number; c: number }
  if (row < 7 && col < 7) p = local(0, 0)
  else if (row < 7 && col >= MODULES - 7) p = local(0, MODULES - 7)
  else p = local(MODULES - 7, 0)
  const onRing = p.r === 0 || p.r === 6 || p.c === 0 || p.c === 6
  const inCore = p.r >= 2 && p.r <= 4 && p.c >= 2 && p.c <= 4
  return onRing || inCore
}

function cellDark(idx: number) {
  const row = Math.floor(idx / MODULES)
  const col = idx % MODULES
  if (isFinder(row, col)) return finderDark(row, col)
  return qrCells.value[idx]
}
</script>

<template>
  <section
    class="sketch-card min-w-0 border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-6"
  >
    <!-- badges -->
    <div class="flex flex-wrap items-center gap-2">
      <span
        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
        style="background: var(--accent-soft); color: var(--accent-text)"
      >
        ◆ {{ t('invite.affiliateTag') }}
      </span>
      <StatusChip tone="success"
        >✓ {{ t('invite.affiliateVerified') }}</StatusChip
      >
    </div>

    <!-- headline -->
    <h2
      class="mt-4 text-2xl font-bold leading-snug tracking-tight text-[var(--text-primary)]"
    >
      {{ t('invite.affiliateHeadline') }}
      <span class="text-[var(--accent-text)]">
        {{ t('invite.affiliateHeadlineAccent', { rate: rebatePercent }) }}
      </span>
    </h2>
    <p
      class="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-tertiary)]"
    >
      {{ t('invite.affiliateSubheadline') }}
    </p>

    <div class="mt-6 grid gap-6 sm:grid-cols-[1fr_auto]">
      <!-- code + link + share -->
      <div class="min-w-0 space-y-4">
        <div>
          <p class="mb-1.5 text-xs text-[var(--text-tertiary)]">
            {{ t('invite.inviteCode') }}
          </p>
          <div class="flex gap-2">
            <code
              class="flex min-w-0 flex-1 items-center truncate rounded-xl bg-[var(--surface-muted)] px-4 py-2.5 font-mono text-lg font-bold tracking-wide text-[var(--text-primary)]"
            >
              {{ code || '…' }}
            </code>
            <ConsoleButton variant="secondary" @click="emit('copyCode')">
              {{ t('invite.copyCode') }}
            </ConsoleButton>
          </div>
        </div>

        <div>
          <p class="mb-1.5 text-xs text-[var(--text-tertiary)]">
            {{ t('invite.inviteLink') }}
          </p>
          <div class="flex gap-2">
            <code
              class="min-w-0 flex-1 truncate rounded-xl bg-[var(--surface-muted)] px-4 py-2.5 text-sm text-[var(--text-secondary)]"
            >
              {{ inviteLink || '…' }}
            </code>
            <ConsoleButton @click="emit('copyLink')">{{
              t('invite.copyLink')
            }}</ConsoleButton>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs text-[var(--text-tertiary)]">{{
            t('invite.shareLabel')
          }}</span>
          <IconButton :label="t('invite.shareX')" @click="emit('shareX')">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"
              />
            </svg>
          </IconButton>
          <IconButton
            :label="t('invite.shareTelegram')"
            @click="emit('shareTelegram')"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M21.94 4.6 18.9 19.2c-.23 1.02-.84 1.27-1.7.79l-4.7-3.46-2.27 2.18c-.25.25-.46.46-.94.46l.33-4.78 8.7-7.86c.38-.34-.08-.53-.59-.19L6.98 13.2l-4.63-1.45c-1-.31-1.03-1 .21-1.48l18.1-6.98c.84-.31 1.57.2 1.28 1.31Z"
              />
            </svg>
          </IconButton>
          <IconButton
            :label="t('invite.shareEmail')"
            @click="emit('shareEmail')"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </IconButton>
        </div>
      </div>

      <!-- decorative QR placeholder -->
      <div class="flex flex-col items-center justify-center gap-2">
        <div
          class="relative grid rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-3"
          :style="{
            gridTemplateColumns: `repeat(${MODULES}, 1fr)`,
            gridTemplateRows: `repeat(${MODULES}, 1fr)`,
            width: '160px',
            height: '160px',
          }"
          role="img"
          :aria-label="t('invite.qrCaption')"
        >
          <span
            v-for="(_, idx) in MODULES * MODULES"
            :key="idx"
            :style="{
              background: cellDark(idx) ? 'var(--text-primary)' : 'transparent',
            }"
          />
          <span
            class="absolute inset-0 m-auto flex h-9 w-9 items-center justify-center rounded-lg"
          >
            <BrandMark
              class="h-9 w-9 rounded-lg ring-2 ring-[var(--surface-solid)]"
            />
          </span>
        </div>
        <p class="text-center text-xs text-[var(--text-tertiary)]">
          {{ t('invite.qrCaption') }}<br />
          <span class="font-mono">ref · {{ code }}</span>
        </p>
      </div>
    </div>

    <!-- disclaimer -->
    <p
      class="mt-5 flex items-center gap-1.5 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-tertiary)]"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v4h1" />
      </svg>
      {{ t('invite.affiliateDisclaimer') }}
    </p>
  </section>
</template>
