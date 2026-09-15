import { createFileRoute } from '@tanstack/vue-router'
import Cookies from 'js-cookie'
import { defineComponent, onMounted, ref } from 'vue'

const RouteComponent = defineComponent({
  setup() {
    const cookies = ref<Record<string, string>>({})

    onMounted(() => {
      cookies.value = {
        session: Cookies.get('session') || '',
        csrf: Cookies.get('csrf') || '',
        theme: Cookies.get('theme') || '',
      }
    })

    return () => (
      <div>
        <h1 data-testid="multi-cookie-redirect-target">
          Multi Cookie Redirect Target
        </h1>
        <div>
          <p>
            Session cookie:{' '}
            <span data-testid="cookie-session">{cookies.value.session}</span>
          </p>
          <p>
            CSRF cookie:{' '}
            <span data-testid="cookie-csrf">{cookies.value.csrf}</span>
          </p>
          <p>
            Theme cookie:{' '}
            <span data-testid="cookie-theme">{cookies.value.theme}</span>
          </p>
        </div>
      </div>
    )
  },
})

export const Route = createFileRoute('/multi-cookie-redirect/target')({
  component: RouteComponent,
})
