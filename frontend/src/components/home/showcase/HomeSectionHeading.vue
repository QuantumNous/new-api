<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow: string
    title: string
    description: string
    align?: 'left' | 'center'
  }>(),
  { align: 'left' }
)
</script>

<template>
  <header
    class="home-showcase-heading"
    :class="align === 'center' ? 'home-showcase-heading--center' : ''"
  >
    <p class="home-showcase-heading__eyebrow">{{ eyebrow }}</p>
    <h2 class="home-showcase-heading__title">{{ title }}</h2>
    <p class="home-showcase-heading__description">{{ description }}</p>
  </header>
</template>

<style scoped>
.home-showcase-heading {
  max-width: 48rem;
}

.home-showcase-heading--center {
  margin-inline: auto;
  text-align: center;
}

.home-showcase-heading__eyebrow {
  margin: 0;
  color: var(--accent-text);
  font-family: 'Ren2JetBrainsMono', 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0;
  text-transform: uppercase;
}

.home-showcase-heading__title {
  margin: 0.75rem 0 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: clamp(2rem, 4.6vw, 3.75rem);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: 0;
  text-wrap: balance;
}

.home-showcase-heading__description {
  max-width: 43rem;
  margin: 1rem 0 0;
  color: var(--text-secondary);
  font-size: clamp(0.95rem, 1.6vw, 1.125rem);
  line-height: 1.75;
  text-wrap: pretty;
}

.home-showcase-heading--center .home-showcase-heading__description {
  margin-inline: auto;
}

html.light .home-showcase-heading__title {
  font-family: 'Ren2NotoSerifSC', 'Noto Serif SC', serif;
}

html.light .home-showcase-heading__title::after {
  display: block;
  width: min(8rem, 28%);
  height: 0.35rem;
  margin-top: 0.75rem;
  background: linear-gradient(
    90deg,
    transparent,
    var(--pencil-line-soft) 12%,
    var(--accent) 54%,
    transparent
  );
  content: '';
  opacity: 0.72;
  transform: rotate(-0.7deg);
}

html.light .home-showcase-heading--center .home-showcase-heading__title::after {
  margin-inline: auto;
}

@media (max-width: 640px) {
  .home-showcase-heading__title {
    font-size: 2rem;
  }
}
</style>
