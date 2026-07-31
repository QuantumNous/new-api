import { useState } from 'react'

interface CodeBlockProps {
  code: string
  lang?: string
}

export function CodeBlock({ code, lang }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className='relative rounded-xl border border-white/10 bg-[#0b1120]'>
      {lang && (
        <span className='absolute left-3 top-2 text-xs uppercase tracking-wide text-[#64748B]'>
          {lang}
        </span>
      )}
      <button
        onClick={onCopy}
        className='absolute right-2 top-2 rounded-md border border-white/10 px-2 py-1 text-xs text-[#94A3B8] transition hover:bg-white/5'
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className='overflow-x-auto p-4 pt-8 text-sm leading-relaxed text-[#E2E8F0]'>
        <code>{code}</code>
      </pre>
    </div>
  )
}
