/*
DeepRouter pricing cheatsheet — single-page admin reference for the
Channel / Model / Group relationship + the quota formula. Linked from
the Admin sidebar so an operator never has to re-derive the model in
their head when they come back to the dashboard a week later.

This is a static page; if you change the pricing system (e.g. add a
new factor like TimeOfDayRatio), update this page so it stays the
single source of truth.
*/
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  Box,
  Radio,
  Users as UsersIcon,
  Calculator,
  Lightbulb,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Header } from '@/components/layout/components/header'
import { Main } from '@/components/layout'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ConfigDrawer } from '@/components/config-drawer'

export function PricingCheatsheet() {
  const { t } = useTranslation()

  return (
    <>
      <Header>
        <Search />
        <div className='ms-auto flex items-center md:space-x-4'>
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <Main className='overflow-y-auto'>
        <div className='mx-auto max-w-4xl px-4 py-6'>
          <div className='mb-8'>
            <h1 className='text-3xl font-bold tracking-tight'>
              {t('Pricing Cheatsheet')}
            </h1>
            <p className='text-muted-foreground mt-2 text-sm'>
              {t(
                'How requests get routed and how quota is calculated. Open this whenever you forget the formula.'
              )}
            </p>
          </div>

          {/* ── Three-layer diagram ─────────────────────────────────── */}
          <section className='mb-10'>
            <h2 className='mb-4 text-lg font-semibold'>
              {t('The 3-Layer Model')}
            </h2>
            <div className='grid gap-4 sm:grid-cols-3'>
              <Card
                icon={<Box className='size-4' />}
                title={t('Model')}
                tag='ModelRatio'
                role={t('What the user wants')}
                description={t(
                  'User sends model="gpt-4o" in the request body. Sets the cost basis — ModelRatio = upstream input price ÷ 2.'
                )}
                href='/models/metadata'
                hrefLabel={t('Manage models')}
              />
              <Card
                icon={<Radio className='size-4' />}
                title={t('Channel')}
                tag={t('routing only')}
                role={t('Which upstream pipe')}
                description={t(
                  'Admin-only. DeepRouter picks one of the enabled channels that serves the requested model. Channel decides upstream URL + key — NOT price.'
                )}
                href='/channels'
                hrefLabel={t('Manage channels')}
              />
              <Card
                icon={<UsersIcon className='size-4' />}
                title={t('Group')}
                tag='GroupRatio'
                role={t('Your markup lever')}
                description={t(
                  'Each user belongs to a group (default / vip / svip / enterprise / airbotix-kids / jr-academy). GroupRatio multiplies the model cost to set your sell price.'
                )}
                href='/system-settings/operations/group-ratio'
                hrefLabel={t('Edit group ratios')}
              />
            </div>
          </section>

          {/* ── Formula ─────────────────────────────────────────────── */}
          <section className='mb-10'>
            <h2 className='mb-4 text-lg font-semibold'>
              {t('Quota Formula')}
            </h2>
            <div className='bg-muted/50 rounded-lg border p-5 font-mono text-sm leading-relaxed'>
              <div className='text-muted-foreground mb-2 text-xs uppercase tracking-wider'>
                {t('quota deducted from user per request')}
              </div>
              <div>
                quota = (prompt_tokens × <Hl>ModelRatio</Hl>
              </div>
              <div className='pl-12'>
                + completion_tokens × <Hl>ModelRatio</Hl> × <Hl>CompletionRatio</Hl>)
              </div>
              <div className='pl-8'>
                × <Hl>GroupRatio</Hl>
              </div>
              <div className='text-muted-foreground mt-3 text-xs'>
                {t(
                  '$1 ≈ QuotaPerUnit quota units (default 500,000). Channel is NOT in this formula — it only decides routing.'
                )}
              </div>
            </div>
          </section>

          {/* ── Worked example ──────────────────────────────────────── */}
          <section className='mb-10'>
            <h2 className='mb-4 flex items-center gap-2 text-lg font-semibold'>
              <Calculator className='size-4' />
              {t('Worked example')}
            </h2>
            <div className='space-y-3 rounded-lg border p-5 text-sm'>
              <div className='text-muted-foreground'>
                {t(
                  'User sends gpt-4o with 1000 prompt + 500 completion tokens. user.group = "default".'
                )}
              </div>
              <pre className='bg-background overflow-x-auto rounded border p-3 text-xs'>{`ModelRatio[gpt-4o]         = 1.25   (= $2.5 / 1M input)
CompletionRatio[gpt-4o]    = 4      (output = 4× input)
GroupRatio[default]        = 3.333  (your 70% gross margin)

quota = (1000 × 1.25 + 500 × 1.25 × 4) × 3.333
      = (1250 + 2500) × 3.333
      = 3750 × 3.333
      = 12,499 quota units

User pays      = 12,499 / 500,000 = $0.025
Your cost      = $0.025 / 3.333   = $0.0075   ← actual OpenAI bill
Your margin    = $0.025 - $0.0075 = $0.0175   (= 70% ✓)`}</pre>
            </div>
          </section>

          {/* ── Where to change each lever ──────────────────────────── */}
          <section className='mb-10'>
            <h2 className='mb-4 text-lg font-semibold'>
              {t('Where to change each lever')}
            </h2>
            <div className='overflow-hidden rounded-lg border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50'>
                  <tr>
                    <th className='px-4 py-2 text-left font-medium'>
                      {t('Lever')}
                    </th>
                    <th className='px-4 py-2 text-left font-medium'>
                      {t('Sets')}
                    </th>
                    <th className='px-4 py-2 text-left font-medium'>
                      {t('Where')}
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-border divide-y'>
                  <Row
                    lever='ModelRatio'
                    sets={t('Upstream input price (cost basis)')}
                    href='/system-settings/operations'
                    where={t('System Settings → Operations → Model Ratio')}
                  />
                  <Row
                    lever='CompletionRatio'
                    sets={t('Output / input multiplier')}
                    href='/system-settings/operations'
                    where={t('Same page → Completion Ratio')}
                  />
                  <Row
                    lever='GroupRatio'
                    sets={t('Your sell price multiplier (markup)')}
                    href='/system-settings/operations'
                    where={t('Same page → Group Ratio')}
                  />
                  <Row
                    lever={t('Channel.models')}
                    sets={t('Which models the channel serves')}
                    href='/channels'
                    where={t('Channels → edit each row → Models field')}
                  />
                  <Row
                    lever={t('User.Group')}
                    sets={t('Which group ratio applies to this user')}
                    href='/users'
                    where={t('Users → edit row → Group dropdown')}
                  />
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Common confusions ────────────────────────────────────── */}
          <section>
            <h2 className='mb-4 flex items-center gap-2 text-lg font-semibold'>
              <Lightbulb className='size-4' />
              {t('Common confusions')}
            </h2>
            <ul className='space-y-3 text-sm'>
              <Q
                q={t('User calls a Channel or a Model?')}
                a={t(
                  'Model. The user only specifies a model name (e.g. "gpt-4o"). Channels are admin-only — users never see them.'
                )}
              />
              <Q
                q={t('Does Channel affect the price?')}
                a={t(
                  'No. Channel only decides which upstream key/URL handles the request. Price comes from Model + Group ratios.'
                )}
              />
              <Q
                q={t('Why do I have multiple channels for the same model?')}
                a={t(
                  'Multi-key pool: load balance + automatic failover. If one key gets rate-limited, traffic redistributes to the others without user-visible errors.'
                )}
              />
              <Q
                q={t("A model exists in Models page but /v1/models doesn't list it")}
                a={t(
                  'No enabled channel serves it. Add it to a channel\'s models field or enable an existing channel that includes it.'
                )}
              />
              <Q
                q={t('How do I give different users different prices?')}
                a={t(
                  'Put them in different groups (Users → edit → Group). Each group has its own GroupRatio = its own markup level.'
                )}
              />
            </ul>
          </section>
        </div>
      </Main>
    </>
  )
}

// ── Small presentational helpers (kept local — not worth their own files) ──

function Card(props: {
  icon: React.ReactNode
  title: string
  tag: string
  role: string
  description: string
  href: string
  hrefLabel: string
}) {
  return (
    <div className='flex flex-col rounded-lg border p-4'>
      <div className='mb-2 flex items-center gap-2'>
        <span className='bg-muted text-muted-foreground inline-flex size-7 items-center justify-center rounded'>
          {props.icon}
        </span>
        <span className='font-semibold'>{props.title}</span>
        <span className='bg-accent/10 text-accent ml-auto rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wider'>
          {props.tag}
        </span>
      </div>
      <p className='text-muted-foreground text-xs font-medium uppercase tracking-wider'>
        {props.role}
      </p>
      <p className='mt-2 flex-1 text-xs leading-relaxed'>{props.description}</p>
      <Link
        to={props.href}
        className='text-accent mt-3 inline-flex items-center gap-1 text-xs font-medium hover:underline'
      >
        {props.hrefLabel}
        <ArrowRight className='size-3' />
      </Link>
    </div>
  )
}

function Hl(props: { children: React.ReactNode }) {
  return (
    <span className='bg-accent/10 text-accent rounded px-1 py-0.5 text-[13px]'>
      {props.children}
    </span>
  )
}

function Row(props: {
  lever: string
  sets: string
  href: string
  where: string
}) {
  return (
    <tr>
      <td className='px-4 py-2 font-mono text-xs'>{props.lever}</td>
      <td className='text-muted-foreground px-4 py-2'>{props.sets}</td>
      <td className='px-4 py-2'>
        <Link
          to={props.href}
          className='text-accent hover:underline'
        >
          {props.where}
        </Link>
      </td>
    </tr>
  )
}

function Q(props: { q: string; a: string }) {
  return (
    <li className='rounded-md border p-3'>
      <div className='font-medium'>{props.q}</div>
      <div className='text-muted-foreground mt-1 text-xs'>{props.a}</div>
    </li>
  )
}
