import { ScrollArea } from '@base-ui/react/scroll-area';
import clsx from 'clsx';
import './ScrollArea.css';

export const Root = ScrollArea.Root;

export function Viewport({ className, ...props }: ScrollArea.Viewport.Props) {
  return <ScrollArea.Viewport className={clsx('ScrollAreaViewport', className)} {...props} />;
}

export function Scrollbar({ className, ...props }: ScrollArea.Scrollbar.Props) {
  return (
    <ScrollArea.Scrollbar className={clsx('ScrollAreaScrollbar', className)} {...props}>
      <ScrollArea.Thumb className="ScrollAreaThumb" />
    </ScrollArea.Scrollbar>
  );
}

export function Corner({ className, ...props }: ScrollArea.Corner.Props) {
  return <ScrollArea.Corner className={clsx('ScrollAreaCorner', className)} {...props} />;
}
