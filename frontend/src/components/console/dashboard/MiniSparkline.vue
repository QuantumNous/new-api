<script setup lang="ts">
import { computed, useId } from 'vue'

/**
 * Decorative trend line for the KPI strip. Hand-rolled SVG rather than ECharts:
 * four of these live in one row, and four chart instances plus their resize and
 * theme observers would cost far more than the shape is worth. The figure above
 * carries the meaning, so this is aria-hidden.
 */
const props = withDefaults(
  defineProps<{
    points: number[]
    /** stroke colour — pass a CSS variable so it follows the theme */
    color?: string
    height?: number
    /**
     * Optional second series plotted on the same scale as `points` — e.g.
     * upload next to download. Normalising each series on its own would
     * stretch both to full height and erase their relative magnitude.
     */
    secondary?: number[]
    secondaryColor?: string
  }>(),
  {
    color: 'var(--accent)',
    height: 32,
    secondary: undefined,
    secondaryColor: 'var(--support)',
  }
)

const gradientId = `sparkline-${useId()}`

/** Fixed viewBox; the SVG scales to its container via width/height 100%. */
const WIDTH = 100
const PAD = 2

/** Normalised paths. Flat series sit on the centre line instead of the floor. */
const geometry = computed(() => {
  const values = props.points
  if (values.length < 2) return null
  const secondary =
    props.secondary && props.secondary.length > 1 ? props.secondary : null

  const all = secondary ? [...values, ...secondary] : values
  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = max - min
  const usable = props.height - PAD * 2

  const project = (series: number[]) =>
    series.map((value, i) => {
      const x = (i / (series.length - 1)) * WIDTH
      const ratio = span === 0 ? 0.5 : (value - min) / span
      // SVG y grows downward, so invert.
      const y = PAD + (1 - ratio) * usable
      return { x, y }
    })
  const toLine = (coords: { x: number; y: number }[]) =>
    coords
      .map(
        (c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)} ${c.y.toFixed(2)}`
      )
      .join(' ')

  const coords = project(values)
  const line = toLine(coords)
  const area = `${line} L${WIDTH} ${props.height} L0 ${props.height} Z`
  const last = coords[coords.length - 1]!

  const secondaryCoords = secondary ? project(secondary) : null
  return {
    line,
    area,
    last,
    secondaryLine: secondaryCoords ? toLine(secondaryCoords) : null,
    secondaryLast: secondaryCoords
      ? secondaryCoords[secondaryCoords.length - 1]!
      : null,
  }
})
</script>

<template>
  <svg
    v-if="geometry"
    :viewBox="`0 0 ${WIDTH} ${height}`"
    preserveAspectRatio="none"
    class="w-full"
    :style="{ height: `${height}px` }"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="color" stop-opacity="0.22" />
        <stop offset="100%" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path :d="geometry.area" :fill="`url(#${gradientId})`" />
    <path
      :d="geometry.line"
      fill="none"
      :stroke="color"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
    <!-- Line only for the second series: one shaded band is enough. -->
    <path
      v-if="geometry.secondaryLine"
      :d="geometry.secondaryLine"
      fill="none"
      :stroke="secondaryColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
    <!--
      Latest point, so the eye lands on where the series ends. r is in viewBox
      units and the box is stretched horizontally by preserveAspectRatio="none",
      so this renders as a small ellipse rather than a circle — at 2px that
      reads as a dot either way.
    -->
    <circle :cx="geometry.last.x" :cy="geometry.last.y" r="2" :fill="color" />
    <circle
      v-if="geometry.secondaryLast"
      :cx="geometry.secondaryLast.x"
      :cy="geometry.secondaryLast.y"
      r="2"
      :fill="secondaryColor"
    />
  </svg>
</template>
