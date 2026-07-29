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
import { useCallback, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Sankey,
  Tooltip,
  type SankeyElementType,
  type SankeyLinkProps,
  type SankeyNodeProps,
} from 'recharts'

import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import {
  flowLinkSelectionFromSankeyLink,
  flowNodeFilterFromSankeyNode,
} from '@/features/dashboard/lib'
import type {
  FlowLinkSelection,
  FlowNodeFilter,
  FlowSankeyData,
  FlowSankeyLinkDatum,
  FlowSankeyNodeDatum,
} from '@/features/dashboard/types'
import { formatNumber, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

interface FlowSankeyChartProps {
  data: FlowSankeyData
  onSelectNode: (filter: FlowNodeFilter) => void
  onSelectLink: (selection: FlowLinkSelection) => void
  onClearSelection: () => void
}

// Node labels are drawn outside the node rectangles, so the reserved horizontal
// margins have to fit the first and last column labels.
const FLOW_SANKEY_MARGIN = { top: 12, right: 132, bottom: 12, left: 132 }

// The Sankey colors itself from the graph data, so it needs no series config.
const FLOW_SANKEY_CHART_CONFIG: ChartConfig = {}

const FLOW_SANKEY_INITIAL_DIMENSION = { width: 960, height: 560 }

const FLOW_LABEL_OFFSET = 8

const MAX_FLOW_LABEL_CHARS = 22

// Nodes and links tag themselves with `data-flow-item` so that a click landing
// anywhere else inside the chart area is read as "clear the current highlight".
const FLOW_ITEM_SELECTOR = '[data-flow-item]'

// Recharts gives a node no minimum size, so the smallest flows would otherwise
// collapse into an unclickable sliver.
const MIN_FLOW_NODE_HEIGHT = 3

function clippedFlowLabel(label: string): string {
  if (label.length <= MAX_FLOW_LABEL_CHARS) return label
  return `${label.slice(0, MAX_FLOW_LABEL_CHARS - 1)}\u2026`
}

function nodeFillOpacity(node: FlowSankeyNodeDatum): number {
  if (node.dimmed) return 0.2
  if (node.highlighted) return 1
  return 0.92
}

function linkStrokeOpacity(link: FlowSankeyLinkDatum): number {
  if (link.dimmed) return 0.08
  if (link.highlighted) return 0.85
  return link.linkAlpha
}

function FlowSankeyTooltipContent(props: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: unknown }>
}) {
  const { t } = useTranslation()
  const datum = props.payload?.[0]?.payload
  if (!props.active || !datum || typeof datum !== 'object') return null

  const flow = datum as Partial<FlowSankeyLinkDatum & FlowSankeyNodeDatum>
  const title =
    flow.sourceLabel && flow.targetLabel
      ? `${flow.sourceLabel} \u2192 ${flow.targetLabel}`
      : (flow.name ?? '')
  const rows = [
    { label: t('Quota'), value: formatQuota(flow.quota ?? 0) },
    { label: t('Tokens'), value: formatNumber(flow.tokens ?? 0) },
    { label: t('Requests'), value: formatNumber(flow.requests ?? 0) },
  ]
  if (flow.share) {
    rows.push({
      label: t('Share'),
      value: `${(flow.share * 100).toFixed(1)}%`,
    })
  }

  return (
    <div className='border-border/50 bg-background grid min-w-40 gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl'>
      <div className='truncate font-medium'>{title}</div>
      <div className='grid gap-1'>
        {rows.map((row) => (
          <div
            key={row.label}
            className='flex items-center justify-between gap-4 leading-none'
          >
            <span className='text-muted-foreground'>{row.label}</span>
            <span className='text-foreground font-mono font-medium tabular-nums'>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FlowSankeyChart(props: FlowSankeyChartProps) {
  const handleItemClick = (
    item: SankeyNodeProps | SankeyLinkProps,
    type: SankeyElementType
  ) => {
    if (type === 'node') {
      const filter = flowNodeFilterFromSankeyNode(item.payload)
      if (filter) props.onSelectNode(filter)
      return
    }
    const selection = flowLinkSelectionFromSankeyLink(item.payload)
    if (selection) props.onSelectLink(selection)
  }
  const handleAreaClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (target instanceof Element && target.closest(FLOW_ITEM_SELECTOR)) return
    props.onClearSelection()
  }

  // Recharts recomputes the Sankey layout whenever the `node` or `link` render
  // props change identity, so both renderers must stay stable across renders.
  const renderNode = useCallback((nodeProps: SankeyNodeProps) => {
    const node = nodeProps.payload as unknown as FlowSankeyNodeDatum
    const height = Math.max(nodeProps.height, MIN_FLOW_NODE_HEIGHT)
    // The first column has no room on its right, so its labels sit in the left
    // margin while every other column labels into the gap ahead of it.
    const atFirstColumn = nodeProps.payload.depth === 0
    return (
      <g data-flow-item='node' className='cursor-pointer'>
        <rect
          x={nodeProps.x}
          y={nodeProps.y}
          width={nodeProps.width}
          height={height}
          rx={2}
          fill={node.color}
          fillOpacity={nodeFillOpacity(node)}
          strokeWidth={node.highlighted ? 1.5 : 1}
          className={cn(
            'hover:[fill-opacity:1]',
            node.highlighted ? 'stroke-foreground/70' : 'stroke-border/60'
          )}
        />
        <text
          x={
            atFirstColumn
              ? nodeProps.x - FLOW_LABEL_OFFSET
              : nodeProps.x + nodeProps.width + FLOW_LABEL_OFFSET
          }
          y={nodeProps.y + height / 2}
          textAnchor={atFirstColumn ? 'end' : 'start'}
          dominantBaseline='middle'
          className={cn(
            'fill-muted-foreground pointer-events-none text-[11px] font-semibold',
            node.dimmed && 'opacity-40'
          )}
        >
          {clippedFlowLabel(node.name)}
        </text>
      </g>
    )
  }, [])
  const renderLink = useCallback((linkProps: SankeyLinkProps) => {
    const link = linkProps.payload as unknown as FlowSankeyLinkDatum
    return (
      <path
        data-flow-item='link'
        d={`M${linkProps.sourceX},${linkProps.sourceY}C${linkProps.sourceControlX},${linkProps.sourceY} ${linkProps.targetControlX},${linkProps.targetY} ${linkProps.targetX},${linkProps.targetY}`}
        fill='none'
        stroke={link.color}
        strokeWidth={Math.max(linkProps.linkWidth, 1)}
        strokeOpacity={linkStrokeOpacity(link)}
        className='cursor-pointer hover:[stroke-opacity:0.9]'
      />
    )
  }, [])

  return (
    <div className='h-full w-full' onClick={handleAreaClick}>
      <ChartContainer
        config={FLOW_SANKEY_CHART_CONFIG}
        className='aspect-auto h-full w-full'
        initialDimension={FLOW_SANKEY_INITIAL_DIMENSION}
      >
        <Sankey
          data={props.data}
          nameKey='name'
          nodeWidth={16}
          nodePadding={14}
          iterations={48}
          margin={FLOW_SANKEY_MARGIN}
          node={renderNode}
          link={renderLink}
          onClick={handleItemClick}
        >
          <Tooltip content={<FlowSankeyTooltipContent />} />
        </Sankey>
      </ChartContainer>
    </div>
  )
}
