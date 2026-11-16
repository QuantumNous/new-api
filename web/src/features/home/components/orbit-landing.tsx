import { Link } from '@tanstack/react-router'
import Lenis from 'lenis'
import {
  ArrowRight,
  Box,
  BookOpen,
  Home,
  ScrollText,
  Tag,
  Sparkles,
  Moon,
  Sun,
  ExternalLink,
  Pause,
  Play,
  Code2,
  Bot,
  Zap,
  Feather,
  Brain,
  Wrench,
  Eye,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/theme-provider'
import { useStatus } from '@/hooks/use-status'
import { ORBIT_BRAND } from '@/lib/orbit-brand'
import { ORBIT_MODELS } from '@/lib/orbit-models'

import '@/styles/orbit.css'

const modelIcons = {
  'orbit-auto': Sparkles,
  'orbit-deep-code': Code2,
  'orbit-agent': Bot,
  'orbit-fast-code': Zap,
  'orbit-light': Feather,
  'orbit-reason': Brain,
  'orbit-engineer': Wrench,
  'orbit-vision': Eye,
} as const
function OrbitModelIcon(props: { id: keyof typeof modelIcons; size?: number }) {
  const Icon = modelIcons[props.id]
  return <Icon size={props.size ?? 21} aria-hidden='true' />
}

const navigation = [
  { title: 'Home', href: '/', icon: Home },
  { title: 'Model Hub', href: '/model-hub', icon: Box },
  { title: 'Docs', href: '/docs', icon: BookOpen },
  { title: 'Terms', href: '/terms', icon: ScrollText },
  { title: 'Access & Limits', href: '/access-limits', icon: Tag },
] as const

export function OrbitHeader({
  active = '/',
  isAuthenticated = false,
}: {
  active?: string
  isAuthenticated?: boolean
}) {
  const { status } = useStatus()
  const signup = status?.register_enabled !== false
  let accountPath: '/dashboard' | '/sign-up' | '/sign-in' = '/sign-in'
  let accountLabel = 'Sign In'
  if (isAuthenticated) {
    accountPath = '/dashboard'
    accountLabel = 'Dashboard'
  } else if (signup) {
    accountPath = '/sign-up'
    accountLabel = 'Sign Up'
  }
  return (
    <header className='orbit-header'>
      <Link to='/' className='orbit-wordmark'>
        <img src={ORBIT_BRAND.logo} alt='' />
        <span>{ORBIT_BRAND.name}</span>
      </Link>
      <nav className='orbit-navigation' aria-label='Primary'>
        {navigation.map(({ title, href, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            aria-current={active === href ? 'page' : undefined}
          >
            <Icon size={14} aria-hidden='true' />
            <span>{title}</span>
          </Link>
        ))}
      </nav>
      <Button
        role='link'
        className='orbit-button orbit-signup'
        render={<Link to={accountPath} />}
      >
        {accountLabel}
        <ArrowRight size={14} aria-hidden='true' />
      </Button>
    </header>
  )
}

export function OrbitFooter() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <footer className='orbit-footer'>
      <div>
        <Link to='/terms'>Terms</Link>
        <Link to='/privacy'>Privacy</Link>
        <Link to='/contact'>Contact</Link>
        <a href={`${ORBIT_BRAND.source}/blob/main/LICENSE`}>License</a>
        <button
          type='button'
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? (
            <Sun size={15} aria-hidden='true' />
          ) : (
            <Moon size={15} aria-hidden='true' />
          )}
        </button>
      </div>
      <p>
        © {new Date().getFullYear()} {ORBIT_BRAND.name} · A community project by{' '}
        {ORBIT_BRAND.organization}.
      </p>
      <a href={ORBIT_BRAND.upstream}>{ORBIT_BRAND.attribution}</a>
    </footer>
  )
}

/** Smooth scrolling belongs only to the public homepage and follows live OS preferences. */
function PublicSmoothScroll() {
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let lenis: Lenis | undefined
    function sync() {
      lenis?.destroy()
      lenis = preference.matches
        ? undefined
        : new Lenis({ autoRaf: true, duration: 0.46, anchors: true })
    }
    sync()
    preference.addEventListener('change', sync)
    return () => {
      preference.removeEventListener('change', sync)
      lenis?.destroy()
    }
  }, [])
  return null
}

export function OrbitPublicPage({
  title,
  active,
  children,
}: {
  title: string
  active?: string
  children: ReactNode
}) {
  return (
    <div className='orbit-site'>
      <a className='orbit-skip' href='#main-content'>
        Skip to content
      </a>
      <OrbitHeader active={active} />
      <main id='main-content' className='orbit-content'>
        <h1>{title}</h1>
        {children}
      </main>
      <OrbitFooter />
    </div>
  )
}

export function OrbitLanding({
  isAuthenticated,
}: {
  isAuthenticated: boolean
}) {
  const [tickerPaused, setTickerPaused] = useState(false)
  const { status } = useStatus()
  const register = status?.register_enabled !== false
  let startPath: '/dashboard' | '/sign-up' | '/sign-in' = '/sign-in'
  let startLabel = 'Sign In'
  if (isAuthenticated) {
    startPath = '/dashboard'
    startLabel = 'Open Dashboard'
  } else if (register) {
    startPath = '/sign-up'
    startLabel = 'Get Started'
  }
  return (
    <div className='orbit-site'>
      <PublicSmoothScroll />
      <a className='orbit-skip' href='#orbit-title'>
        Skip to content
      </a>
      <main id='main-content'>
        <section
          className='orbit-first-screen'
          aria-label='BEU Developer Orbit introduction'
        >
          <OrbitHeader isAuthenticated={isAuthenticated} />
          <div className='orbit-glow' aria-hidden='true' />
          <img
            className='orbit-globe'
            src={ORBIT_BRAND.globe}
            alt=''
            aria-hidden='true'
          />
          <div className='orbit-hero'>
            <div className='orbit-promo'>
              <img
                className='orbit-promo-corner'
                src={ORBIT_BRAND.logo}
                alt=''
                aria-hidden='true'
              />
              <span>Community Access</span>
              <Sparkles size={16} aria-hidden='true' />
              <span>Free Developer API Access</span>
            </div>
            <h1 id='orbit-title' tabIndex={-1}>
              Built for Developers.<span>Powered by AI.</span>
            </h1>
            <p className='orbit-hero-description'>
              Community-supported AI APIs for building,
              <br className='orbit-desktop-break' /> experimenting and
              developing projects.
            </p>
            <div className='orbit-actions'>
              <Button
                role='link'
                className='orbit-button'
                render={<Link to={startPath} />}
              >
                {startLabel}
              </Button>
              <Button
                role='link'
                className='orbit-button orbit-button-dark'
                render={<Link to='/model-hub' />}
              >
                View Models
              </Button>
            </div>
            <div className='orbit-endpoint'>
              <span>https://api.beudeveloper.in/v1</span>
              <Sparkles size={16} aria-hidden='true' />
            </div>
            <p className='orbit-endpoint-note'>
              Planned endpoint · Not deployed
            </p>
            <div
              className='orbit-model-icons'
              aria-label='Eight planned model capabilities'
            >
              {ORBIT_MODELS.map((model, i) => (
                <span key={model.id} title={`${model.name} · Planned`}>
                  <OrbitModelIcon id={model.id} size={17} />
                  <span className='sr-only'>{model.name}</span>
                  <small aria-hidden='true'>{i + 1}</small>
                </span>
              ))}
            </div>
          </div>
          <div className='orbit-ticker' aria-label='Planned Orbit models'>
            <div
              className={`orbit-ticker-track${tickerPaused ? ' is-paused' : ''}`}
            >
              {[0, 1].map((copy) => (
                <div
                  className='orbit-ticker-group'
                  key={copy}
                  aria-hidden={copy === 1 ? true : undefined}
                >
                  {ORBIT_MODELS.map((model) => (
                    <span key={model.id}>
                      <OrbitModelIcon id={model.id} />
                      {model.name}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <button
            className='orbit-ticker-toggle'
            type='button'
            onClick={() => setTickerPaused(!tickerPaused)}
            aria-label={
              tickerPaused ? 'Play model ticker' : 'Pause model ticker'
            }
          >
            {tickerPaused ? (
              <Play size={12} aria-hidden='true' />
            ) : (
              <Pause size={12} aria-hidden='true' />
            )}
          </button>
          <p className='orbit-fold-credit'>
            © {new Date().getFullYear()} {ORBIT_BRAND.name} · Community AI
            Gateway · <a href='#orbit-about'>Explore Orbit ↓</a>
          </p>
        </section>
        <div id='orbit-about' className='orbit-sections'>
          <section className='orbit-section'>
            <p className='orbit-eyebrow'>How Orbit works</p>
            <h2>One gateway. A familiar way to build.</h2>
            <ol className='orbit-grid orbit-steps'>
              <li>
                <span>01</span>
                <h3>Create an account</h3>
                <p>
                  Register when account creation is open, then sign in to your
                  dashboard.
                </p>
              </li>
              <li>
                <span>02</span>
                <h3>Check your access</h3>
                <p>
                  Review configured models, your allowance, and account
                  permissions before creating an API key.
                </p>
              </li>
              <li>
                <span>03</span>
                <h3>Connect your project</h3>
                <p>
                  Use a supported SDK and your instance endpoint. Track requests
                  and usage in the dashboard.
                </p>
              </li>
            </ol>
          </section>
          <section className='orbit-section'>
            <p className='orbit-eyebrow'>
              Model capabilities · Planned catalog
            </p>
            <h2>Eight ways to develop with Orbit.</h2>
            <p>
              The following are planned Orbit capabilities, not live provider
              assignments. Availability depends on future configuration.
            </p>
            <div className='orbit-grid orbit-model-preview'>
              {ORBIT_MODELS.map((model) => (
                <article key={model.id}>
                  <OrbitModelIcon id={model.id} size={22} />
                  <h3>{model.name}</h3>
                  <code>{model.id}</code>
                  <p>{model.capability}</p>
                  <span className='orbit-planned'>Planned</span>
                </article>
              ))}
            </div>
            <Link className='orbit-text-link' to='/model-hub'>
              Explore the Model Hub <ArrowRight size={15} aria-hidden='true' />
            </Link>
          </section>
          <section className='orbit-section orbit-access'>
            <p className='orbit-eyebrow'>
              Free access & account limits · Planned policy
            </p>
            <h2>Shared access. Clear boundaries.</h2>
            <div className='orbit-grid'>
              <article>
                <h3>Unverified accounts</h3>
                <p>
                  10 requests per minute. 1 million chargeable tokens per
                  four-hour window. 4 million chargeable tokens per day.
                </p>
              </article>
              <article>
                <h3>Verified BEU students</h3>
                <p>
                  15 requests per minute. Standard token caps removed, subject
                  to fair use and provider availability.
                </p>
              </article>
            </div>
            <p className='orbit-notice'>
              These limits are planned and are not enforced by this Phase 1
              interface. Your dashboard shows the current instance allowance.
            </p>
            <Link className='orbit-text-link' to='/access-limits'>
              Read access & limits <ArrowRight size={15} aria-hidden='true' />
            </Link>
          </section>
          <section className='orbit-section'>
            <p className='orbit-eyebrow'>BEU student verification · Planned</p>
            <h2>More room for student projects.</h2>
            <p>
              Manual verification is planned for BEU students. The future
              application will ask for full name, roll number, registration
              number, branch, and college, followed by administrator review.
              Applications are not open.
            </p>
            <Link className='orbit-text-link' to='/student-verification'>
              Student verification details{' '}
              <ArrowRight size={15} aria-hidden='true' />
            </Link>
          </section>
          <section className='orbit-section orbit-grid'>
            <article>
              <BookOpen aria-hidden='true' />
              <h2>Developer documentation</h2>
              <p>
                Find the account, API key, SDK, and model configuration steps
                for your development instance.
              </p>
              <Link className='orbit-text-link' to='/docs'>
                Read the docs <ArrowRight size={15} aria-hidden='true' />
              </Link>
            </article>
            <article>
              <Tag aria-hidden='true' />
              <h2>Need additional access?</h2>
              <p>
                A limit-increase request workflow is planned. Requests cannot be
                submitted yet and additional access is not guaranteed.
              </p>
              <Link className='orbit-text-link' to='/requests'>
                Request information <ArrowRight size={15} aria-hidden='true' />
              </Link>
            </article>
          </section>
          <section className='orbit-section'>
            <p className='orbit-eyebrow'>College sponsorship · Planned</p>
            <h2>AI API Support for College Events & Tech Fests</h2>
            <p>
              A future program for BEU-affiliated hackathons, workshops, and
              tech fests. Support will depend on review, resources, and provider
              availability. Applications are not open and sponsorship is not
              guaranteed.
            </p>
            <Link className='orbit-text-link' to='/college-sponsorship'>
              College sponsorship information{' '}
              <ArrowRight size={15} aria-hidden='true' />
            </Link>
          </section>
          <section className='orbit-section'>
            <p className='orbit-eyebrow'>
              Community contributions & acknowledgment
            </p>
            <h2>Built through shared effort.</h2>
            <p>AI API access supported by BEU Developer Orbit.</p>
            <p>
              Orbit builds on New API and its open-source contributors. Help
              improve the project through bug reports, documentation, and code
              contributions.
            </p>
            <a className='orbit-text-link' href={ORBIT_BRAND.source}>
              Contribute on GitHub <ExternalLink size={15} aria-hidden='true' />
            </a>
          </section>
        </div>
      </main>
      <OrbitFooter />
    </div>
  )
}

export function OrbitModelHub() {
  const [query, setQuery] = useState('')
  const models = ORBIT_MODELS.filter((model) =>
    `${model.name} ${model.id} ${model.capability}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )
  return (
    <div className='orbit-site orbit-catalog'>
      <aside className='orbit-catalog-sidebar'>
        <Link className='orbit-wordmark' to='/'>
          <img src={ORBIT_BRAND.logo} alt='' />
          <span>Orbit</span>
        </Link>
        <nav aria-label='Model Hub navigation'>
          {[
            { title: 'Home', href: '/' },
            { title: 'Model Hub', href: '/model-hub' },
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'API Keys', href: '/keys' },
            { title: 'Documentation', href: '/docs' },
            { title: 'Terms of Service', href: '/terms' },
          ].map((item) => (
            <Link
              to={item.href}
              key={item.href}
              aria-current={item.href === '/model-hub' ? 'page' : undefined}
            >
              {item.title}
            </Link>
          ))}
        </nav>
      </aside>
      <div className='orbit-catalog-main'>
        <div className='orbit-catalog-top'>
          <Link to='/pricing'>Configured gateway models</Link>
          <Button
            role='link'
            className='orbit-button orbit-button-dark'
            render={<Link to='/sign-in' />}
          >
            Open Dashboard
          </Button>
        </div>
        <main id='main-content'>
          <h1>Orbit Model Hub</h1>
          <p>
            Explore the eight planned Orbit capabilities. This catalog does not
            configure providers or make models available.
          </p>
          <div className='orbit-catalog-toolbar'>
            <span>
              All models <strong>8</strong>
            </span>
            <label>
              Search models
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='Search by name or capability'
                type='search'
              />
            </label>
          </div>
          <div className='orbit-catalog-cards'>
            {models.map((model) => (
              <article key={model.id}>
                <div className='orbit-model-heading' title={model.description}>
                  <span>
                    <OrbitModelIcon id={model.id} size={23} />
                  </span>
                  <div>
                    <h2>{model.name}</h2>
                    <code>{model.id}</code>
                  </div>
                </div>
                <div className='orbit-model-detail'>
                  <span>{model.capability}</span>
                  <span className='orbit-planned'>Planned</span>
                </div>
                <p className='orbit-model-disclaimer'>
                  Provider, pricing, context size, and availability have not
                  been assigned.
                </p>
              </article>
            ))}
          </div>
          {models.length === 0 && (
            <p role='status' className='orbit-empty'>
              No planned models match your search.
            </p>
          )}
          <p className='orbit-notice'>
            For actual models enabled on this instance, use{' '}
            <Link to='/pricing'>Configured gateway models</Link>. Sign-in and
            permissions may be required.
          </p>
        </main>
        <OrbitFooter />
      </div>
    </div>
  )
}
