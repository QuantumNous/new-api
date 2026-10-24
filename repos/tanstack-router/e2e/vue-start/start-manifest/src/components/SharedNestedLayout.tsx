/// <reference types="vite/client" />
import { Link, linkOptions } from '@tanstack/vue-router'
import { defineComponent } from 'vue'
import styles from '~/styles/shared-layout.module.css'

const ROUTES = linkOptions([
  { to: '/shared-a', label: '/shared-a' },
  { to: '/shared-b', label: '/shared-b' },
  { to: '/shared-c', label: '/shared-c' },
])

export const SharedNestedLayout = defineComponent({
  setup(_, { slots }) {
    return () => (
      <section class={styles.layout} data-testid="shared-layout-shell">
        <div class={styles.heading} data-testid="shared-layout-heading">
          Shared nested layout CSS
        </div>

        <nav class={styles.nav}>
          {ROUTES.map((route) => (
            <Link key={route.to} {...route} data-testid={`nav-${route.label}`}>
              {route.label}
            </Link>
          ))}
        </nav>

        <div class={styles.body} data-testid="shared-layout-copy">
          {slots.default?.()}
        </div>
      </section>
    )
  },
})
