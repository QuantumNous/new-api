import { useState } from 'react'

export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className='relative'>
      <button
        onClick={copy}
        className='absolute right-3 top-3 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[#94A3B8] transition hover:bg-white/10 hover:text-[#F8FAFC]'
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className='overflow-x-auto rounded-xl border border-white/10 bg-[#0b1220] p-5 pr-16 text-sm leading-relaxed text-[#E2E8F0]'>
        <code>{code}</code>
      </pre>
    </div>
  )
}
