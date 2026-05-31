import { useState, useEffect } from 'react'
import {
  ArrowRight,
  BookOpen,
  Layers3,
  SquareTerminal,
  Route,
  KeyRound,
  PlayCircle,
  Languages,
} from 'lucide-react'
import { useI18n } from './i18n'

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

type StatusData = {
  system_name?: string
  logo?: string
}

const MODEL_GROUPS = [
  { titleKey: 'models.gpt.title', models: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-4o-mini'] },
  { titleKey: 'models.claude.title', models: ['claude-opus-4-8', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'] },
  { titleKey: 'models.gemini.title', models: ['gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'] },
  { titleKey: 'models.open.title', models: ['deepseek/deepseek-v3.2', 'qwen3.5-plus', 'GLM-5'] },
]

const CODE_LINES = [
  { text: 'from openai import OpenAI', cls: '' },
  { text: '', cls: '' },
  { text: 'client = OpenAI(', cls: '' },
  { text: '    api_key="sk-...",', cls: 'code-string' },
  { text: '    base_url="https://llm-api.vynexcloud.com/v1",', cls: 'code-string' },
  { text: ')', cls: '' },
  { text: '', cls: '' },
  { text: 'response = client.chat.completions.create(', cls: '' },
  { text: '    model="claude-opus-4-8",', cls: 'code-string' },
  { text: '    messages=[{"role": "user", "content": "Hello"}],', cls: 'code-string' },
  { text: ')', cls: '' },
]

const CURL_LINES = [
  { text: '$ curl https://llm-api.vynexcloud.com/v1/chat/completions \\', cls: '' },
  { text: '    -H "Authorization: Bearer $VYNEX_API_KEY" \\', cls: 'code-string' },
  { text: '    -H "Content-Type: application/json" \\', cls: '' },
  { text: '    -d \'{', cls: '' },
  { text: '        "model": "gpt-5.5",', cls: 'code-string' },
  { text: '        "messages": [{"role": "user", "content": "Hello"}]', cls: 'code-string' },
  { text: '    }\'', cls: '' },
]

const SIDEBAR_ITEMS = [
  { key: 'model', val: 'claude-opus-4-8' },
  { key: 'provider', val: 'gflux' },
  { key: 'endpoint', val: '/chat/completions' },
  { key: 'format', val: 'stream / json' },
]

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

export function App() {
  const [systemName, setSystemName] = useState('Vynex API')

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((json: { data?: StatusData }) => {
        if (json.data?.system_name) {
          setSystemName(json.data.system_name)
          document.title = json.data.system_name
        }
      })
      .catch(() => {})
  }, [])

  return (
    <>
      <Nav systemName={systemName} />
      <Hero />
      <Metrics />
      <Models />
      <Workflow />
      <DevLinks />
      <CTA systemName={systemName} />
      <Footer systemName={systemName} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Nav                                                                */
/* ------------------------------------------------------------------ */

function Nav({ systemName }: { systemName: string }) {
  const { t, toggle, label } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <nav className="nav">
      <a href="/" className="brand">
        <span className="brand-mark">V</span>
        {systemName}
      </a>
      <div className="nav-links">
        <a href="#models">{t('nav.models')}</a>
        <a href="/docs/">{t('nav.docs')}</a>
        <a href="/pricing">{t('nav.pricing')}</a>
        <button onClick={toggle} className="nav-lang" title="Switch language">
          <Languages size={14} />
          {label}
        </button>
        <a href="/sign-in" className="nav-action">{t('nav.console')}</a>
      </div>
      <div className="mobile-actions">
        <button onClick={toggle} className="nav-lang" title="Switch language">
          <Languages size={14} />
          {label}
        </button>
        <button className="mobile-toggle" onClick={() => setOpen(!open)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </div>
      {open && (
        <div className="mobile-menu">
          <a href="#models" onClick={() => setOpen(false)}>{t('nav.models')}</a>
          <a href="/docs/">{t('nav.docs')}</a>
          <a href="/pricing">{t('nav.pricing')}</a>
          <a href="/sign-in" className="nav-action" style={{ textAlign: 'center', marginTop: 8 }}>{t('nav.console')}</a>
        </div>
      )}
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero() {
  const { t } = useI18n()

  return (
    <header className="hero">
      <div className="hero-glow" />
      <div className="grid-bg" />
      <div className="hero-scan" />

      <div className="hero-layout">
        <div className="hero-text">
          <p className="eyebrow anim-in anim-in-1">
            <span className="eyebrow-dot" />
            {t('hero.eyebrow')}
          </p>
          <h1 className="anim-in anim-in-2">
            {t('hero.title')}<br />
            <span className="accent-word">{t('hero.title.accent')}</span>
          </h1>
          <p className="lead anim-in anim-in-3">
            {t('hero.lead')}
          </p>
          <div className="actions anim-in anim-in-4">
            <a href="/register" className="btn-primary">
              {t('hero.cta.primary')} <ArrowRight size={14} />
            </a>
            <a href="/docs/" className="btn-ghost">
              <BookOpen size={14} /> {t('hero.cta.secondary')}
            </a>
          </div>
          <div className="pill-strip anim-in anim-in-5">
            {['gpt-5.5', 'claude-opus-4-8', 'gemini-3.1-pro-preview', 'deepseek-v3.2'].map((m) => (
              <span key={m} className="pill">{m}</span>
            ))}
          </div>
        </div>

        <div className="terminal anim-in anim-in-6">
          <div className="terminal-bar">
            <div className="terminal-dots"><i /><i /><i /></div>
            <span>https://llm-api.vynexcloud.com/v1</span>
          </div>
          <div className="terminal-grid">
            <div className="terminal-sidebar">
              <div className="sidebar-title"><Route size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />{t('hero.routing')}</div>
              <div className="sidebar-rows">
                {SIDEBAR_ITEMS.map((item, i) => (
                  <div key={item.key} className={`sidebar-row ${i === 0 ? 'active' : ''}`}>
                    <span className="key">{item.key}</span>
                    <span style={{ color: 'var(--line)', fontSize: 10 }}>→</span>
                    <span className="val">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
            <pre>
              <code>{CODE_LINES.map((line, i) => (
                <div key={i} className={line.cls}>{line.text || ' '}</div>
              ))}</code>
            </pre>
          </div>
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/*  Metrics                                                            */
/* ------------------------------------------------------------------ */

function Metrics() {
  const { t } = useI18n()

  const keys = ['metric.1', 'metric.2', 'metric.3', 'metric.4'] as const
  return (
    <div className="metrics">
      {keys.map((k) => (
        <div key={k} className="metric">
          <div className="metric-val">{t(`${k}.value`)}</div>
          <div className="metric-label">{t(`${k}.label`)}</div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Models                                                             */
/* ------------------------------------------------------------------ */

function Models() {
  const { t } = useI18n()

  return (
    <section id="models" className="section">
      <div className="section-inner">
        <p className="section-eyebrow">// {t('models.eyebrow')}</p>
        <h2>{t('models.title')}</h2>
        <p className="section-desc">{t('models.desc')}</p>
        <div className="model-grid">
          {MODEL_GROUPS.map((g) => {
            const key = g.titleKey // e.g. 'models.gpt.title'
            const descKey = key.replace('.title', '.desc')
            return (
              <article key={g.titleKey} className="model-card">
                <div className="model-card-header">
                  <h3>{t(key)}</h3>
                  <Layers3 size={16} style={{ color: 'var(--accent)' }} />
                </div>
                <p className="model-desc">{t(descKey)}</p>
                <div className="model-list">
                  {g.models.map((m) => (
                    <div key={m} className="model-item">
                      <span className="dot" />
                      {m}
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Workflow                                                           */
/* ------------------------------------------------------------------ */

function Workflow() {
  const { t } = useI18n()
  const steps = ['step1', 'step2', 'step3'] as const

  return (
    <section id="workflow" className="section section-tinted">
      <div className="section-inner">
        <p className="section-eyebrow">// {t('workflow.eyebrow')}</p>
        <h2>{t('workflow.title')}</h2>
        <p className="section-desc">{t('workflow.desc')}</p>
        <div className="workflow-grid">
          <div className="steps">
            {steps.map((s, i) => (
              <div key={s} className="step">
                <div className="step-num">0{i + 1}</div>
                <div>
                  <h3>{t(`workflow.${s}.title`)}</h3>
                  <p>{t(`workflow.${s}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="code-panel">
            <div className="code-panel-head">
              <span className="status-dot" />
              <SquareTerminal size={13} />
              <span>cURL example</span>
            </div>
            <pre><code>{CURL_LINES.map((line, i) => (
              <div key={i} className={line.cls}>{line.text}</div>
            ))}</code></pre>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Developer Links                                                    */
/* ------------------------------------------------------------------ */

function DevLinks() {
  const { t } = useI18n()
  const links = [
    { key: 'docs', href: '/docs/', Icon: BookOpen },
    { key: 'console', href: '/dashboard', Icon: KeyRound },
    { key: 'playground', href: '/playground', Icon: PlayCircle },
  ] as const

  return (
    <section id="developers" className="section">
      <div className="section-inner">
        <p className="section-eyebrow">// {t('dev.eyebrow')}</p>
        <h2>{t('dev.title')}</h2>
        <p className="section-desc">{t('dev.desc')}</p>
        <div className="dev-grid">
          {links.map((item) => {
            const Icon = item.Icon
            return (
              <a key={item.key} href={item.href} className="dev-card">
                <div className="dev-icon"><Icon size={18} /></div>
                <h3>{t(`dev.${item.key}.title`)}</h3>
                <p>{t(`dev.${item.key}.desc`)}</p>
                <div className="dev-link">
                  {t(`dev.${item.key}.title`)} <ArrowRight size={14} className="arrow" />
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Final CTA                                                          */
/* ------------------------------------------------------------------ */

function CTA({ systemName }: { systemName: string }) {
  const { t } = useI18n()

  return (
    <section className="final-cta">
      <div className="cta-box">
        <div>
          <h2>{t('cta.title')}</h2>
          <p>{t('cta.desc', { brand: systemName })}</p>
        </div>
        <div className="cta-actions">
          <a href="/register" className="cta-primary">{t('cta.primary')}</a>
          <a href="/docs/" className="cta-secondary">{t('cta.secondary')}</a>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

function Footer({ systemName }: { systemName: string }) {
  const { t } = useI18n()

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-mark">V</span>
          {systemName}
        </div>
        <div className="footer-links">
          <a href="/docs/">{t('footer.docs')}</a>
          <span className="footer-divider" />
          <a href="/pricing">{t('footer.pricing')}</a>
          <span className="footer-divider" />
          <a href="/sign-in">{t('footer.console')}</a>
        </div>
      </div>
    </footer>
  )
}
