import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ModelConfig {
  id: string
  name: string
  response: string
  tokens: number
  latency: number
  badgeClass: string
}

const MODELS: ModelConfig[] = [
  {
    id: 'gpt-4o',
    name: 'gpt-4o',
    response:
      'Artificial intelligence models can be seamlessly accessed through a unified API gateway, enabling developers to switch between providers effortlessly.',
    tokens: 27,
    latency: 142,
    badgeClass:
      'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/25',
  },
  {
    id: 'claude-sonnet',
    name: 'claude-sonnet-4-20250514',
    response:
      'A unified gateway abstracts away provider differences, letting you focus on building great products while we handle routing, failover, and cost optimization.',
    tokens: 31,
    latency: 168,
    badgeClass:
      'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-500/25',
  },
  {
    id: 'gemini-pro',
    name: 'gemini-2.5-pro',
    response:
      'By consolidating multiple AI providers behind one endpoint, teams can reduce integration complexity and gain unified observability across all model usage.',
    tokens: 29,
    latency: 156,
    badgeClass:
      'bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-blue-500/25',
  },
  {
    id: 'deepseek',
    name: 'deepseek-chat',
    response:
      'An API gateway provides automatic load balancing, rate limiting, and cost tracking — essential infrastructure for production AI applications at scale.',
    tokens: 25,
    latency: 93,
    badgeClass:
      'bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:bg-violet-500/15 dark:text-violet-400 dark:ring-violet-500/25',
  },
]

const CYCLE_INTERVAL = 4000

export function HeroTerminalDemo() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return

    intervalRef.current = setInterval(() => {
      setTransitioning(true)
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % MODELS.length)
        setTransitioning(false)
      }, 300)
    }, CYCLE_INTERVAL)

    return () => clearInterval(intervalRef.current)
  }, [])

  const model = MODELS[activeIndex]

  return (
    <div className='mx-auto mt-16 w-full max-w-2xl'>
      <div
        className={cn(
          'overflow-hidden rounded-xl border',
          'border-border/60 bg-white shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1),0_0_0_0.5px_rgba(0,0,0,0.04)]',
          'dark:border-border/40 dark:bg-[#0d1117] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6),0_0_0_0.5px_rgba(255,255,255,0.05)]'
        )}
      >
        {/* Title bar */}
        <div
          className={cn(
            'flex items-center justify-between border-b px-4 py-2.5',
            'border-border/40 bg-gray-50/80',
            'dark:border-white/[0.06] dark:bg-transparent'
          )}
        >
          <div className='flex items-center gap-1.5'>
            <div className='size-2.5 rounded-full bg-[#ff5f57]/80 dark:bg-[#ff5f57]' />
            <div className='size-2.5 rounded-full bg-[#febc2e]/80 dark:bg-[#febc2e]' />
            <div className='size-2.5 rounded-full bg-[#28c840]/80 dark:bg-[#28c840]' />
          </div>
          <div className='flex items-center gap-2'>
            <ModelSelector
              models={MODELS}
              activeIndex={activeIndex}
              onSelect={(i) => {
                clearInterval(intervalRef.current)
                setTransitioning(true)
                setTimeout(() => {
                  setActiveIndex(i)
                  setTransitioning(false)
                }, 300)
              }}
            />
          </div>
          <div className='flex items-center gap-2'>
            <span className='inline-block size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400' />
            <span className='text-foreground/30 text-[10px]'>200 OK</span>
          </div>
        </div>

        {/* Terminal body — fixed height */}
        <div className='grid min-h-[280px] grid-rows-[auto_1fr] font-mono text-[12.5px] leading-[1.7]'>
          {/* Request */}
          <div
            className={cn(
              'border-b px-5 py-3.5',
              'border-border/30',
              'dark:border-white/[0.04]'
            )}
          >
            <div className='mb-1.5 flex items-center gap-2'>
              <span className='text-[10px] font-medium tracking-wider text-blue-500/60 uppercase dark:text-blue-400/60'>
                Request
              </span>
            </div>
            <div className='text-foreground/80'>
              <span className='text-emerald-600 dark:text-emerald-400'>
                curl
              </span>{' '}
              <span className='text-blue-600 dark:text-blue-400'>-X POST</span>{' '}
              <span className='text-amber-600 dark:text-amber-400'>
                &quot;/v1/chat/completions&quot;
              </span>
              {' \\\n'}
              <span className='text-foreground/15'>{'  '}</span>
              <span className='text-blue-600 dark:text-blue-400'>-H</span>{' '}
              <span className='text-amber-600 dark:text-amber-400'>
                &quot;Authorization: Bearer sk-••••&quot;
              </span>
              {' \\\n'}
              <span className='text-foreground/15'>{'  '}</span>
              <span className='text-blue-600 dark:text-blue-400'>-d</span>{' '}
              <span className='text-amber-600 dark:text-amber-400'>
                {'\'{"model": "'}
              </span>
              <span
                className={cn(
                  'transition-all duration-300',
                  transitioning
                    ? 'text-foreground/20'
                    : 'text-amber-700 dark:text-amber-300'
                )}
              >
                {model.name}
              </span>
              <span className='text-amber-600 dark:text-amber-400'>
                {'", "messages": [...]}\''}
              </span>
            </div>
          </div>

          {/* Response */}
          <div className='px-5 py-3.5'>
            <div className='mb-2 flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <span className='text-[10px] font-medium tracking-wider text-emerald-600/60 uppercase dark:text-emerald-400/60'>
                  Response
                </span>
                <span
                  className={cn(
                    'text-foreground/25 text-[10px] tabular-nums transition-opacity duration-300',
                    transitioning ? 'opacity-0' : 'opacity-100'
                  )}
                >
                  {model.latency}ms
                </span>
              </div>
              <div
                className={cn(
                  'text-foreground/25 flex items-center gap-3 text-[10px] tabular-nums transition-opacity duration-300',
                  transitioning ? 'opacity-0' : 'opacity-100'
                )}
              >
                <span>{model.tokens} tokens</span>
                <span>${(model.tokens * 0.00003).toFixed(5)}</span>
              </div>
            </div>
            <div
              className={cn(
                'rounded-lg border px-3.5 py-3',
                'border-border/40 bg-muted/30',
                'dark:border-white/[0.06] dark:bg-white/[0.02]'
              )}
            >
              <div className='text-foreground/35'>{'{'}</div>
              <div className='pl-4'>
                <span className='text-blue-600 dark:text-blue-400'>
                  &quot;model&quot;
                </span>
                <span className='text-foreground/25'>: </span>
                <span
                  className={cn(
                    'transition-all duration-300',
                    transitioning
                      ? 'text-foreground/15'
                      : 'text-amber-600 dark:text-amber-400'
                  )}
                >
                  &quot;{model.name}&quot;
                </span>
                <span className='text-foreground/25'>,</span>
              </div>
              <div className='pl-4'>
                <span className='text-blue-600 dark:text-blue-400'>
                  &quot;content&quot;
                </span>
                <span className='text-foreground/25'>: </span>
                <span
                  className={cn(
                    'text-emerald-600 transition-all duration-300 dark:text-emerald-400',
                    transitioning ? 'opacity-0' : 'opacity-100'
                  )}
                >
                  &quot;{model.response}&quot;
                </span>
              </div>
              <div className='pl-4'>
                <span className='text-blue-600 dark:text-blue-400'>
                  &quot;usage&quot;
                </span>
                <span className='text-foreground/25'>: {'{'} </span>
                <span className='text-blue-600 dark:text-blue-400'>
                  &quot;total_tokens&quot;
                </span>
                <span className='text-foreground/25'>: </span>
                <span
                  className={cn(
                    'text-violet-600 transition-all duration-300 dark:text-violet-400',
                    transitioning ? 'opacity-0' : 'opacity-100'
                  )}
                >
                  {model.tokens}
                </span>
                <span className='text-foreground/25'> {'}'}</span>
              </div>
              <div className='text-foreground/35'>{'}'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModelSelector(props: {
  models: ModelConfig[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <div className='flex items-center gap-1'>
      {props.models.map((m, i) => (
        <button
          key={m.id}
          onClick={() => props.onSelect(i)}
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 transition-all duration-300 ring-inset',
            i === props.activeIndex
              ? m.badgeClass
              : 'text-foreground/20 ring-border/30 hover:text-foreground/40 hover:ring-border/50 dark:ring-white/[0.06] dark:hover:ring-white/10'
          )}
        >
          {m.id}
        </button>
      ))}
    </div>
  )
}
