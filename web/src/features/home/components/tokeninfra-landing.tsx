/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Box,
  Braces,
  Cpu,
  Globe2,
  Network,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { TokenFactoryVisual } from './token-factory-visual'
import { TokenInfraDevelopers } from './tokeninfra-developers'

import '@/styles/tokeninfra-home.css'

interface TokenInfraLandingProps {
  isAuthenticated: boolean
  docsUrl: string
}

export function TokenInfraLanding(props: TokenInfraLandingProps) {
  const { t } = useTranslation()
  const destination = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const action = props.isAuthenticated ? t('Go to Dashboard') : t('Get Started')
  const stages = [
    {
      icon: Network,
      title: t('Unified access'),
      text: t(
        'One OpenAI-compatible API connects OpenAI, Claude, Gemini, DeepSeek, Qwen and Llama.'
      ),
    },
    {
      icon: Cpu,
      title: t('Intelligent routing'),
      text: t(
        'Balance workloads, control request rates and track costs to improve inference efficiency.'
      ),
    },
    {
      icon: Box,
      title: t('On-demand delivery'),
      text: t(
        'Turn distributed compute into measurable token services. Pay for what your applications use.'
      ),
    },
  ]
  const capabilities = [
    {
      icon: Zap,
      title: t('Inference efficiency'),
      text: t(
        'Optimize routing and resource utilization for reliable, cost-effective token production.'
      ),
      tag: '01',
    },
    {
      icon: ShieldCheck,
      title: t('Enterprise security'),
      text: t(
        'Manage access permissions and team collaboration with enterprise-grade controls.'
      ),
      tag: '02',
    },
    {
      icon: Globe2,
      title: t('Global infrastructure'),
      text: t(
        'Support multi-region deployments and dependable access for applications around the world.'
      ),
      tag: '03',
    },
    {
      icon: Braces,
      title: t('Open and extensible'),
      text: t(
        'Build with APIs, SDKs, CLI tools and documentation. Self-host and extend with your business.'
      ),
      tag: '04',
    },
  ]

  return (
    <main className='ti-home'>
      <section className='ti-hero ti-section' aria-labelledby='ti-hero-title'>
        <div className='ti-hero-copy'>
          <p className='ti-eyebrow'>
            <span className='ti-status-dot' />
            TokenInfra · {t('AI infrastructure, delivered')}
          </p>
          <h1 id='ti-hero-title'>
            {t('Compute into productivity.')}
            <span>{t('Tokens on demand.')}</span>
          </h1>
          <p className='ti-hero-description'>
            {t(
              'One gateway. A world of models. TokenInfra turns distributed compute into reliable, measurable token services for your next AI application.'
            )}
          </p>
          <div className='ti-hero-actions'>
            <Button
              role='link'
              size='lg'
              className='ti-primary'
              render={<Link to={destination} />}
            >
              {action}
              <ArrowUpRight size={17} aria-hidden='true' />
            </Button>
            <Button
              role='link'
              size='lg'
              variant='outline'
              render={<Link to='/pricing' />}
            >
              {t('View Pricing')}
              <ArrowRight size={16} aria-hidden='true' />
            </Button>
          </div>
          <div className='ti-hero-meta'>
            <span>{t('OpenAI-compatible')}</span>
            <span>{t('Pay as you go')}</span>
            <span>{t('Self-hostable')}</span>
          </div>
          <a className='ti-explore' href='#token-factory'>
            {t('Explore the token factory')}
            <ArrowDown size={14} aria-hidden='true' />
          </a>
        </div>
        <TokenFactoryVisual />
      </section>

      <section className='ti-model-band' aria-label={t('Model ecosystem')}>
        <div className='ti-section'>
          <p>{t('One interface. Your choice of models.')}</p>
          <div className='ti-models'>
            <span>◎ OpenAI</span>
            <span>✳ Claude</span>
            <span>✦ Gemini</span>
            <span>DeepSeek</span>
            <span>Qwen</span>
            <span>∞ Llama</span>
          </div>
        </div>
      </section>

      <section
        className='ti-section ti-about'
        id='about'
        aria-labelledby='ti-about-title'
      >
        <div>
          <p className='ti-eyebrow'>01 / {t('About TokenInfra')}</p>
          <h2 id='ti-about-title'>
            {t('The infrastructure between')}
            <br />
            <span className='ti-muted'>{t('compute and possibility.')}</span>
          </h2>
        </div>
        <div>
          <p className='ti-about-lead'>
            {t('We build the foundation that lets AI applications grow.')}
          </p>
          <p>
            {t(
              'TokenInfra is an AI infrastructure provider focused on token production. We connect compute resources with models and applications through inference optimization, multi-model routing and a unified API.'
            )}
          </p>
          <p>
            {t(
              'We do not build general-purpose models or chips. We make their capabilities accessible, so your team can focus on products and business.'
            )}
          </p>
          <a href='https://tokeninfra.com.cn' className='ti-text-link'>
            tokeninfra.com.cn
            <ArrowUpRight size={15} aria-hidden='true' />
          </a>
        </div>
      </section>

      <section
        className='ti-section ti-production'
        id='token-factory'
        aria-labelledby='ti-factory-title'
      >
        <div className='ti-section-heading'>
          <div>
            <p className='ti-eyebrow'>02 / {t('Token Factory')}</p>
            <h2 id='ti-factory-title'>
              {t('One gateway. A complete token factory.')}
            </h2>
          </div>
          <p>{t('From compute to useful tokens')}</p>
        </div>
        <div className='ti-production-grid'>
          {stages.map((stage, index) => (
            <article key={stage.title}>
              <div className='ti-stage-top'>
                <stage.icon size={27} strokeWidth={1.4} aria-hidden='true' />
                <span>0{index + 1}</span>
              </div>
              <h3>{stage.title}</h3>
              <p>{stage.text}</p>
              {index < 2 && (
                <span className='ti-stage-arrow' aria-hidden='true'>
                  <ArrowRight size={18} />
                </span>
              )}
            </article>
          ))}
        </div>
        <div className='ti-capability-grid'>
          {capabilities.map((item) => (
            <article key={item.title}>
              <div className='ti-capability-icon'>
                <item.icon size={22} strokeWidth={1.5} aria-hidden='true' />
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <TokenInfraDevelopers />

      <section
        className='ti-section ti-mission'
        aria-labelledby='ti-mission-title'
      >
        <div className='ti-mission-mark' aria-hidden='true'>
          <Box size={64} strokeWidth={0.8} />
        </div>
        <p className='ti-eyebrow'>04 / {t('Our mission')}</p>
        <h2 id='ti-mission-title'>
          {t('Make tokens a resource')}
          <br />
          {t('every business can build on.')}
        </h2>
        <p>
          {t(
            'Simplify AI integration with efficient, transparent and reliable token infrastructure. Focus on what you create. We take care of the complexity beneath.'
          )}
        </p>
        <div className='ti-mission-actions'>
          <Button
            role='link'
            size='lg'
            className='ti-primary'
            render={<Link to={destination} />}
          >
            {action}
            <ArrowUpRight size={17} aria-hidden='true' />
          </Button>
          <Button
            role='link'
            size='lg'
            variant='ghost'
            render={<Link to={props.docsUrl} />}
          >
            {t('Docs')}
            <ArrowUpRight size={16} aria-hidden='true' />
          </Button>
        </div>
        <p className='ti-attribution'>
          {t(
            'Supports one-click configuration and perfectly adapts to NewAPI multi-protocol configuration.'
          )}
        </p>
      </section>
    </main>
  )
}
