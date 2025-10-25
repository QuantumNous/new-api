import { useModels } from './models-provider'

type DescriptionCellProps = {
  modelName: string
  description: string
}

export function DescriptionCell({
  modelName,
  description,
}: DescriptionCellProps) {
  const { setOpen, setDescriptionData } = useModels()

  if (!description) {
    return <span className='text-muted-foreground text-xs'>-</span>
  }

  const handleClick = () => {
    setDescriptionData({ modelName, description })
    setOpen('description')
  }

  return (
    <div className='max-w-[150px]'>
      <button
        onClick={handleClick}
        className='text-muted-foreground hover:text-foreground block w-full cursor-pointer overflow-hidden text-left text-sm text-ellipsis whitespace-nowrap transition-colors'
      >
        {description}
      </button>
    </div>
  )
}
