<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Check,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Gauge,
  MessageCircle,
  Send,
  ShieldCheck,
  TicketCheck,
  X,
  Zap,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import qualityDayAsset from '@/assets/home/showcase/quality-workbench-day.webp'
import qualityNightAsset from '@/assets/home/showcase/quality-workbench-night.webp'
import { useTheme } from '@/composables/useTheme'
import { safeExternalUrl, safeImageUrl } from '@/utils/safeUrl'
import type {
  HomeQualityReport,
  HomeRouteChannel,
  HomeRuntimeBreakdown,
  HomeSupportLink,
} from '@/types/homeShowcase'

import HomeSectionHeading from './HomeSectionHeading.vue'

const props = defineProps<{
  runtime: HomeRuntimeBreakdown
  todayRequests: number
  uptimeLabel: string
  channels: HomeRouteChannel[]
  reports: HomeQualityReport[]
  supportLinks: HomeSupportLink[]
  authenticated: boolean
}>()

const { t, tm, locale } = useI18n()
const { resolvedTheme } = useTheme()
const agencyFilter = ref('all')
const selectedChannelId = ref('')
const failedEvidence = ref(new Set<string>())
const failedBackdropAssets = ref(new Set<string>())

const backdropAsset = computed(() =>
  resolvedTheme.value === 'dark' ? qualityNightAsset : qualityDayAsset
)
const backdropAvailable = computed(
  () => !failedBackdropAssets.value.has(backdropAsset.value)
)

interface SupportItem {
  link: HomeSupportLink
  href: string | null
}

const runtimeParts = computed(() => [
  { id: 'days', value: props.runtime.days, label: t('showcase.trust.day') },
  { id: 'hours', value: props.runtime.hours, label: t('showcase.trust.hour') },
  {
    id: 'minutes',
    value: props.runtime.minutes,
    label: t('showcase.trust.minute'),
  },
  {
    id: 'seconds',
    value: props.runtime.seconds,
    label: t('showcase.trust.second'),
  },
])

const agencies = computed(() => [
  ...new Set(props.reports.map((report) => report.agency)),
])

const filteredReports = computed(() =>
  props.reports.filter((report) => {
    const agencyMatches =
      agencyFilter.value === 'all' || report.agency === agencyFilter.value
    const channelMatches = report.channelId === selectedChannelId.value
    return agencyMatches && channelMatches
  })
)

const supportItems = computed<SupportItem[]>(() => {
  const items: SupportItem[] = []
  for (const link of props.supportLinks) {
    if (link.kind === 'route' && link.routeName) {
      items.push({ link, href: null })
      continue
    }
    if (!link.href) continue
    const href = safeExternalUrl(link.href, [link.href])
    if (href) items.push({ link, href })
  }
  return items
})

const validEvidenceItems = computed(() => {
  const items = tm('showcase.trust.validItems')
  return Array.isArray(items) ? items.map(String) : []
})

const invalidEvidenceItems = computed(() => {
  const items = tm('showcase.trust.invalidItems')
  return Array.isArray(items) ? items.map(String) : []
})

const primaryRoute = computed(() =>
  props.authenticated ? { name: 'dashboard' } : { name: 'sign-up' }
)

watch(
  () => props.channels,
  (channels) => {
    if (channels.some((channel) => channel.id === selectedChannelId.value)) {
      return
    }
    selectedChannelId.value = channels[0]?.id ?? ''
  },
  { immediate: true }
)

function formatNumber(value: number): string {
  return new Intl.NumberFormat(locale.value).format(value)
}

function formatRuntimeValue(value: number): string {
  return String(value).padStart(2, '0')
}

function formatReportDate(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--'
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function reportsForChannel(channelId: string): HomeQualityReport[] {
  return props.reports.filter((report) => report.channelId === channelId)
}

function reportHref(report: HomeQualityReport): string | null {
  if (!report.reportUrl) return null
  return safeExternalUrl(report.reportUrl, [report.reportUrl])
}

function evidenceHref(report: HomeQualityReport): string | null {
  if (!report.evidenceAsset || failedEvidence.value.has(report.id)) return null
  return safeImageUrl(report.evidenceAsset)
}

function markEvidenceFailed(reportId: string): void {
  failedEvidence.value = new Set(failedEvidence.value).add(reportId)
}

function markBackdropFailed(): void {
  failedBackdropAssets.value = new Set(failedBackdropAssets.value).add(
    backdropAsset.value
  )
}

function supportIcon(link: HomeSupportLink) {
  if (link.id === 'ticket') return TicketCheck
  if (link.id === 'telegram') return Send
  return MessageCircle
}
</script>

<template>
  <section id="assurance" class="home-showcase-band trust-showcase-band">
    <div class="home-showcase-inner">
      <HomeSectionHeading
        :eyebrow="t('showcase.trust.eyebrow')"
        :title="t('showcase.trust.title')"
        :description="t('showcase.trust.description')"
      />

      <div class="runtime-ledger">
        <div class="runtime-ledger__clock">
          <p><Gauge :size="17" />{{ t('showcase.trust.runtime') }}</p>
          <div class="runtime-parts" aria-live="off">
            <div
              v-for="part in runtimeParts"
              :key="part.id"
              class="runtime-part"
            >
              <span class="runtime-part__value">
                <Transition name="runtime-flip">
                  <strong :key="part.value">{{
                    formatRuntimeValue(part.value)
                  }}</strong>
                </Transition>
              </span>
              <small>{{ part.label }}</small>
            </div>
          </div>
        </div>

        <dl class="runtime-ledger__signals">
          <div>
            <dt><Zap :size="16" />{{ t('showcase.trust.requests') }}</dt>
            <dd>{{ formatNumber(todayRequests) }}</dd>
            <small>{{ t('showcase.trust.requestsHint') }}</small>
          </div>
          <div>
            <dt>
              <ShieldCheck :size="16" />{{ t('showcase.trust.availability') }}
            </dt>
            <dd>{{ uptimeLabel }}</dd>
            <small>{{ t('showcase.trust.availabilityHint') }}</small>
          </div>
        </dl>
      </div>

      <div class="quality-workbench">
        <div class="quality-workbench__backdrop" aria-hidden="true">
          <img
            v-if="backdropAvailable"
            :src="backdropAsset"
            alt=""
            loading="lazy"
            @error="markBackdropFailed"
          />
        </div>
        <div class="quality-workbench__intro">
          <div>
            <p class="quality-workbench__eyebrow">QUALITY LEDGER</p>
            <h3>{{ t('showcase.trust.qualityTitle') }}</h3>
            <p>{{ t('showcase.trust.qualityHint') }}</p>
          </div>
          <label class="quality-provider-filter">
            <span>{{ t('showcase.trust.agency') }}</span>
            <select v-model="agencyFilter">
              <option value="all">{{ t('showcase.trust.allAgencies') }}</option>
              <option v-for="agency in agencies" :key="agency" :value="agency">
                {{ agency }}
              </option>
            </select>
          </label>
        </div>

        <div class="quality-layout">
          <div
            class="quality-channel-list"
            role="list"
            :aria-label="t('showcase.trust.channelOverview')"
          >
            <button
              v-for="channel in channels"
              :key="channel.id"
              type="button"
              class="quality-channel"
              :class="{ 'is-active': selectedChannelId === channel.id }"
              :aria-pressed="selectedChannelId === channel.id"
              @click="selectedChannelId = channel.id"
            >
              <span class="quality-channel__marker" aria-hidden="true" />
              <span class="quality-channel__copy">
                <strong>{{ t(channel.nameKey) }}</strong>
                <small>{{ channel.vendor }} · {{ channel.model }}</small>
              </span>
              <span class="quality-channel__score">
                <b>{{ channel.qualityScore }}</b>
                <small>{{ t('showcase.trust.channelScore') }}</small>
              </span>
              <span class="quality-channel__count">
                {{ reportsForChannel(channel.id).length }}
              </span>
            </button>
          </div>

          <div class="quality-report-list" aria-live="polite">
            <article
              v-for="report in filteredReports"
              :key="report.id"
              class="quality-report"
            >
              <div class="quality-report__evidence" aria-hidden="true">
                <img
                  v-if="evidenceHref(report)"
                  :src="evidenceHref(report) ?? undefined"
                  alt=""
                  loading="lazy"
                  @error="markEvidenceFailed(report.id)"
                />
                <div v-else class="quality-evidence-placeholder">
                  <FileCheck2 :size="26" />
                  <span /><span /><span />
                </div>
              </div>

              <div class="quality-report__body">
                <div class="quality-report__meta">
                  <span>{{ report.agency }}</span>
                  <span
                    class="quality-report__verdict"
                    :data-verdict="report.verdict"
                  >
                    <CheckCircle2
                      v-if="report.verdict === 'verified'"
                      :size="14"
                    />
                    <X v-else :size="14" />
                    {{ t(report.verdictKey) }}
                  </span>
                </div>
                <h4>{{ report.model }}</h4>
                <dl>
                  <div>
                    <dt>{{ t('showcase.trust.reportId') }}</dt>
                    <dd>{{ report.reportNumber }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('showcase.trust.checkedAt') }}</dt>
                    <dd>{{ formatReportDate(report.inspectedAt) }}</dd>
                  </div>
                </dl>
              </div>

              <div class="quality-report__result">
                <strong>{{ report.score ?? '--' }}</strong>
                <a
                  v-if="reportHref(report)"
                  :href="reportHref(report) ?? undefined"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ t('showcase.trust.openReport') }}
                  <ExternalLink :size="15" />
                </a>
                <span v-else>{{ t('showcase.trust.reportUnavailable') }}</span>
              </div>
            </article>

            <div
              v-if="filteredReports.length === 0"
              class="quality-report-empty"
            >
              <FileCheck2 :size="28" />
              <strong>{{ t('showcase.trust.emptyReports') }}</strong>
              <p>{{ t('showcase.trust.emptyReportsHint') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="support" class="home-showcase-band support-showcase-band">
    <div class="home-showcase-inner support-layout">
      <div class="support-copy">
        <p class="support-copy__eyebrow">TICKET FIRST</p>
        <h2>{{ t('showcase.trust.supportTitle') }}</h2>
        <p>{{ t('showcase.trust.supportDescription') }}</p>
        <div class="support-actions">
          <template v-for="item in supportItems" :key="item.link.id">
            <RouterLink
              v-if="item.link.kind === 'route' && item.link.routeName"
              :to="{ name: item.link.routeName }"
              class="support-action support-action--primary"
            >
              <component :is="supportIcon(item.link)" :size="18" />
              {{ t(item.link.labelKey) }}
            </RouterLink>
            <a
              v-else-if="item.href"
              :href="item.href"
              class="support-action support-action--secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              <component :is="supportIcon(item.link)" :size="18" />
              {{ t(item.link.labelKey) }}
              <ExternalLink :size="14" />
            </a>
          </template>
        </div>
      </div>

      <div class="support-evidence">
        <div>
          <h3><Check :size="19" />{{ t('showcase.trust.validEvidence') }}</h3>
          <ul>
            <li v-for="item in validEvidenceItems" :key="item">
              <CheckCircle2 :size="15" />{{ item }}
            </li>
          </ul>
        </div>
        <div>
          <h3><X :size="19" />{{ t('showcase.trust.invalidEvidence') }}</h3>
          <ul>
            <li v-for="item in invalidEvidenceItems" :key="item">
              <X :size="15" />{{ item }}
            </li>
          </ul>
        </div>
        <p>{{ t('showcase.trust.disclaimer') }}</p>
      </div>
    </div>
  </section>

  <section class="home-showcase-band final-showcase-band">
    <div class="home-showcase-inner final-showcase-layout">
      <div>
        <p>ONE KEY · YOUR ROUTE</p>
        <h2>{{ t('showcase.trust.finalTitle') }}</h2>
        <span>{{ t('showcase.trust.finalDescription') }}</span>
      </div>
      <div class="final-showcase-actions">
        <RouterLink
          :to="primaryRoute"
          class="final-action final-action--primary"
        >
          <Zap :size="18" />
          {{
            authenticated
              ? t('showcase.common.openConsole')
              : t('showcase.trust.finalPrimary')
          }}
        </RouterLink>
        <RouterLink
          :to="{ name: 'market' }"
          class="final-action final-action--secondary"
        >
          {{ t('showcase.trust.finalSecondary') }}
          <ExternalLink :size="16" />
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.trust-showcase-band {
  background: var(--surface-solid);
}

.runtime-ledger {
  display: grid;
  gap: clamp(2rem, 5vw, 5rem);
  margin-top: 3.5rem;
  padding-block: clamp(1.75rem, 4vw, 3.25rem);
  border-block: 1px solid var(--border-subtle);
}

.runtime-ledger__clock > p,
.runtime-ledger__signals dt {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--text-tertiary);
  font-size: 0.72rem;
  font-weight: 750;
  text-transform: uppercase;
}

.runtime-parts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(0.45rem, 1.8vw, 1.25rem);
  margin-top: 1.1rem;
}

.runtime-part {
  min-width: 0;
  text-align: center;
}

.runtime-part__value {
  position: relative;
  display: grid;
  min-height: clamp(4rem, 9vw, 6.25rem);
  overflow: hidden;
  place-items: center;
  border: 1px solid var(--border-default);
  border-radius: var(--shape-control);
  background: var(--surface-footer);
  color: var(--footer-text-primary);
  box-shadow: inset 0 50% 0
    color-mix(in srgb, var(--surface-solid) 5%, transparent);
}

.runtime-part__value::after {
  position: absolute;
  right: 0;
  bottom: 50%;
  left: 0;
  height: 1px;
  background: var(--footer-border);
  content: '';
}

.runtime-part strong {
  grid-area: 1 / 1;
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: clamp(1.55rem, 5vw, 3.15rem);
  line-height: 1;
}

.runtime-part small {
  display: block;
  margin-top: 0.55rem;
  color: var(--text-tertiary);
  font-size: 0.68rem;
}

.runtime-ledger__signals {
  display: grid;
  align-self: stretch;
  gap: 1.5rem;
  margin: 0;
}

.runtime-ledger__signals > div {
  display: grid;
  align-content: center;
  border-left: 2px solid var(--border-default);
  padding-left: 1.25rem;
}

.runtime-ledger__signals dd {
  margin: 0.7rem 0 0;
  color: var(--text-primary);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: clamp(2rem, 5vw, 3.4rem);
  font-weight: 760;
  line-height: 1;
}

.runtime-ledger__signals small {
  margin-top: 0.5rem;
  color: var(--text-tertiary);
  font-size: 0.7rem;
}

.quality-workbench {
  position: relative;
  overflow: hidden;
  margin-top: clamp(4rem, 8vw, 7rem);
  padding-block: clamp(1.5rem, 3vw, 2.5rem);
}

.quality-workbench__backdrop {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  opacity: 0.16;
  pointer-events: none;
}

.quality-workbench__backdrop::after {
  position: absolute;
  inset: 0;
  background: var(--surface-solid);
  content: '';
  opacity: 0.56;
}

.quality-workbench__backdrop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  filter: saturate(0.74) contrast(0.94);
}

.quality-workbench > *:not(.quality-workbench__backdrop) {
  position: relative;
  z-index: 1;
}

html.dark .quality-workbench__backdrop {
  opacity: 0.24;
}

html.dark .quality-workbench__backdrop::after {
  opacity: 0.62;
}

.quality-workbench__intro {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-default);
}

.quality-workbench__eyebrow,
.support-copy__eyebrow,
.final-showcase-layout > div > p {
  margin: 0;
  color: var(--accent-text);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: 0.68rem;
  font-weight: 800;
}

.quality-workbench__intro h3,
.support-copy h2,
.final-showcase-layout h2 {
  margin: 0.55rem 0 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3.5vw, 2.55rem);
  line-height: 1.15;
}

.quality-workbench__intro > div > p:last-child,
.support-copy > p:not(.support-copy__eyebrow) {
  max-width: 42rem;
  margin: 0.7rem 0 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.quality-provider-filter {
  display: grid;
  gap: 0.45rem;
  color: var(--text-tertiary);
  font-size: 0.68rem;
  font-weight: 700;
}

.quality-provider-filter select {
  min-width: 10rem;
  min-height: 2.6rem;
  border: 1px solid var(--border-default);
  border-radius: var(--shape-control);
  background: var(--surface-solid);
  padding-inline: 0.75rem 2rem;
  color: var(--text-primary);
}

.quality-provider-filter select:focus-visible,
.quality-channel:focus-visible,
.support-action:focus-visible,
.final-action:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}

.quality-layout {
  display: grid;
  gap: 2rem;
  margin-top: 2rem;
}

.quality-channel-list {
  display: grid;
  align-content: start;
}

.quality-channel {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.85rem;
  min-height: 4.75rem;
  border-bottom: 1px solid var(--border-subtle);
  padding: 0.8rem 0.65rem;
  color: var(--text-secondary);
  text-align: left;
  transition:
    background-color 180ms ease,
    color 180ms ease;
}

.quality-channel:hover,
.quality-channel.is-active {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.quality-channel__marker {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--signal);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--signal) 13%, transparent);
}

.quality-channel.is-active .quality-channel__marker {
  background: var(--status-success);
}

.quality-channel__copy {
  min-width: 0;
}

.quality-channel__copy strong,
.quality-channel__copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quality-channel__copy strong {
  font-size: 0.86rem;
}

.quality-channel__copy small,
.quality-channel__score small {
  margin-top: 0.3rem;
  color: var(--text-tertiary);
  font-size: 0.65rem;
}

.quality-channel__score {
  text-align: right;
}

.quality-channel__score b,
.quality-channel__score small {
  display: block;
}

.quality-channel__score b {
  color: var(--text-primary);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
}

.quality-channel__count {
  display: grid;
  width: 1.7rem;
  height: 1.7rem;
  place-items: center;
  border: 1px solid var(--border-default);
  border-radius: 50%;
  color: var(--text-tertiary);
  font-size: 0.68rem;
}

.quality-report-list {
  display: grid;
  align-content: start;
  gap: 0.75rem;
}

.quality-report {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr) auto;
  align-items: stretch;
  min-width: 0;
  border: 1px solid var(--border-subtle);
  background: color-mix(
    in srgb,
    var(--surface-solid) 90%,
    var(--surface-muted)
  );
}

.quality-report__evidence {
  display: grid;
  min-height: 7.5rem;
  overflow: hidden;
  place-items: center;
  border-right: 1px solid var(--border-subtle);
  background: var(--surface-muted);
}

.quality-report__evidence img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.quality-evidence-placeholder {
  display: grid;
  width: 70%;
  gap: 0.42rem;
  color: var(--signal);
}

.quality-evidence-placeholder svg {
  margin-bottom: 0.25rem;
}

.quality-evidence-placeholder span {
  display: block;
  height: 2px;
  background: var(--border-default);
}

.quality-evidence-placeholder span:nth-child(3) {
  width: 72%;
}

.quality-report__body,
.quality-report__result {
  min-width: 0;
  padding: 1rem;
}

.quality-report__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  color: var(--text-tertiary);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  font-weight: 750;
}

.quality-report__verdict {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 999px;
  background: var(--status-warning-soft);
  padding: 0.25rem 0.45rem;
  color: var(--status-warning-text);
}

.quality-report__verdict[data-verdict='verified'] {
  background: var(--status-success-soft);
  color: var(--status-success-text);
}

.quality-report__verdict[data-verdict='unavailable'] {
  background: var(--status-danger-soft);
  color: var(--status-danger-text);
}

.quality-report h4 {
  margin: 0.7rem 0 0;
  color: var(--text-primary);
  font-size: 1.05rem;
}

.quality-report dl {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.4rem;
  margin: 0.8rem 0 0;
}

.quality-report dt,
.quality-report dd {
  display: inline;
  margin: 0;
  font-size: 0.68rem;
}

.quality-report dt {
  margin-right: 0.4rem;
  color: var(--text-tertiary);
}

.quality-report dd {
  color: var(--text-secondary);
}

.quality-report__result {
  display: grid;
  min-width: 7rem;
  align-content: center;
  justify-items: end;
  border-left: 1px solid var(--border-subtle);
}

.quality-report__result strong {
  color: var(--status-success-text);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', monospace;
  font-size: 2.25rem;
}

.quality-report__result a,
.quality-report__result span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.55rem;
  color: var(--accent-text);
  font-size: 0.68rem;
  font-weight: 700;
}

.quality-report-empty {
  display: grid;
  min-height: 14rem;
  place-items: center;
  align-content: center;
  border: 1px dashed var(--border-default);
  color: var(--text-tertiary);
  text-align: center;
}

.quality-report-empty strong {
  margin-top: 0.7rem;
  color: var(--text-primary);
}

.quality-report-empty p {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
}

.support-showcase-band {
  background: var(--page-background);
}

.support-layout {
  display: grid;
  gap: clamp(3rem, 7vw, 7rem);
}

.support-actions,
.final-showcase-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.6rem;
}

.support-action,
.final-action {
  display: inline-flex;
  min-height: 2.8rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: var(--shape-control);
  padding: 0.65rem 1rem;
  font-size: 0.82rem;
  font-weight: 760;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.support-action:hover,
.final-action:hover {
  transform: translateY(-2px);
}

.support-action--primary,
.final-action--primary {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--button-shadow);
}

.support-action--secondary,
.final-action--secondary {
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.support-evidence {
  display: grid;
  gap: 1.5rem;
  border-left: 1px solid var(--border-default);
  padding-left: clamp(1.25rem, 4vw, 3rem);
}

.support-evidence > div {
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
}

.support-evidence h3 {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.support-evidence ul {
  display: grid;
  gap: 0.65rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.support-evidence li {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
  line-height: 1.55;
}

.support-evidence li svg {
  flex: 0 0 auto;
  margin-top: 0.18rem;
  color: var(--status-success-text);
}

.support-evidence > div:nth-child(2) li svg {
  color: var(--status-danger-text);
}

.support-evidence > p {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 0.68rem;
  line-height: 1.65;
}

.final-showcase-band {
  overflow: hidden;
  background: var(--surface-footer);
}

.final-showcase-layout {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.final-showcase-layout h2 {
  max-width: 48rem;
  color: var(--footer-text-primary);
}

.final-showcase-layout > div > p {
  color: var(--footer-accent);
}

.final-showcase-layout > div > span {
  display: block;
  max-width: 42rem;
  margin-top: 0.8rem;
  color: var(--footer-text-secondary);
  line-height: 1.65;
}

.final-action--secondary {
  border-color: var(--footer-border);
  color: var(--footer-text-primary);
}

.runtime-flip-enter-active,
.runtime-flip-leave-active {
  transition:
    transform 260ms ease,
    opacity 260ms ease;
}

.runtime-flip-enter-from {
  opacity: 0;
  transform: translateY(-45%);
}

.runtime-flip-leave-to {
  opacity: 0;
  transform: translateY(45%);
}

@media (min-width: 800px) {
  .runtime-ledger {
    grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.65fr);
  }

  .quality-layout {
    grid-template-columns: minmax(17rem, 0.7fr) minmax(0, 1.3fr);
  }

  .support-layout {
    grid-template-columns: minmax(0, 0.9fr) minmax(26rem, 1.1fr);
    align-items: start;
  }
}

@media (max-width: 640px) {
  .quality-report {
    grid-template-columns: 4.5rem minmax(0, 1fr);
  }

  .quality-report__result {
    grid-column: 1 / -1;
    grid-template-columns: 1fr auto;
    align-items: center;
    justify-items: start;
    border-top: 1px solid var(--border-subtle);
    border-left: 0;
  }

  .quality-report__result a,
  .quality-report__result span {
    justify-self: end;
    margin-top: 0;
  }

  .quality-report dl {
    display: grid;
  }

  .support-evidence {
    border-top: 1px solid var(--border-default);
    border-left: 0;
    padding-top: 2rem;
    padding-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .runtime-flip-enter-active,
  .runtime-flip-leave-active,
  .support-action,
  .final-action,
  .quality-channel {
    transition: none;
  }
}
</style>
