import type { ReactNode } from 'react'
import { Background, ReactFlow, type ReactFlowProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Controls } from './controls'

type CanvasProps = ReactFlowProps & {
  children?: ReactNode
}

export const Canvas = ({ children, ...props }: CanvasProps) => (
  <ReactFlow
    deleteKeyCode={['Backspace', 'Delete']}
    fitView
    panOnDrag={false}
    panOnScroll
    selectionOnDrag={true}
    zoomOnDoubleClick={false}
    {...props}
  >
    <Background bgColor='var(--sidebar)' />
    <Controls />
    {children}
  </ReactFlow>
)
