export function TrustBar({ items }: { items: string[] }) {
  return (
    <div className='flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-[#94A3B8]'>
      {items.map((item) => (
        <span key={item} className='flex items-center gap-2'>
          <span className='h-1.5 w-1.5 rounded-full bg-[#22D3EE]' />
          {item}
        </span>
      ))}
    </div>
  )
}
