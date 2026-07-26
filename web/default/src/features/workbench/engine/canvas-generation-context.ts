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
/*
Adapted from open-ai-canvas (https://github.com/ddcat-ai/open-ai-canvas),
based on basketikun/infinite-canvas. AGPL-3.0; see THIRD-PARTY-LICENSES.md.
*/
import {
  CanvasNodeType,
  type CanvasConnection,
  type CanvasNodeData,
} from '../types'
import { mentionedNodeIds } from './canvas-prompt-shortcuts'

export type NodeGenerationInput = {
  nodeId: string
  type: 'text' | 'image' | 'video' | 'audio'
  title: string
  text?: string
  mediaUrl?: string
}

export type NodeGenerationContext = {
  prompt: string
  referenceImages: string[]
  referenceVideos: string[]
  referenceAudios: string[]
  presetNodeId?: string
  textCount: number
  imageCount: number
  videoCount: number
  audioCount: number
}

function inputTypeForNode(
  node: CanvasNodeData
): NodeGenerationInput['type'] | null {
  if (node.type === CanvasNodeType.Text) return 'text'
  if (node.type === CanvasNodeType.Image) return 'image'
  if (node.type === CanvasNodeType.Video) return 'video'
  if (node.type === CanvasNodeType.Audio) return 'audio'
  return null
}

export function getUpstreamNodes(
  nodeId: string,
  nodes: CanvasNodeData[],
  connections: CanvasConnection[]
): CanvasNodeData[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return connections
    .filter((connection) => connection.toNodeId === nodeId)
    .map((connection) => byId.get(connection.fromNodeId))
    .filter((node): node is CanvasNodeData => Boolean(node))
}

export function buildNodeGenerationInputs(
  nodeId: string,
  nodes: CanvasNodeData[],
  connections: CanvasConnection[]
): NodeGenerationInput[] {
  return getUpstreamNodes(
    nodeId,
    nodes,
    connections
  ).flatMap<NodeGenerationInput>((node) => {
    const type = inputTypeForNode(node)
    if (!type) return []
    const content = node.metadata?.content?.trim() || ''
    if (!content) return []
    return type === 'text'
      ? [{ nodeId: node.id, type, title: node.title, text: content }]
      : [{ nodeId: node.id, type, title: node.title, mediaUrl: content }]
  })
}

/**
 * Resolves the effective prompt and reference media for a generation node by
 * collecting everything connected into it. Text upstream is appended to the
 * node's own prompt; media upstream becomes references for edit / i2v runs.
 */
export function buildNodeGenerationContext(
  nodeId: string,
  nodes: CanvasNodeData[],
  connections: CanvasConnection[],
  prompt: string
): NodeGenerationContext {
  const connectedInputs = buildNodeGenerationInputs(nodeId, nodes, connections)
  const connectedIds = new Set(connectedInputs.map((input) => input.nodeId))
  const mentionedInputs = mentionedNodeIds(prompt).flatMap<NodeGenerationInput>(
    (id) => {
      if (connectedIds.has(id) || id === nodeId) return []
      const node = nodes.find((item) => item.id === id)
      if (!node) return []
      const type = inputTypeForNode(node)
      const content = node.metadata?.content?.trim()
      if (!type || !content) return []
      return type === 'text'
        ? [{ nodeId: id, type, title: node.title, text: content }]
        : [{ nodeId: id, type, title: node.title, mediaUrl: content }]
    }
  )
  const inputs = [...connectedInputs, ...mentionedInputs]
  const presetNode = getUpstreamNodes(nodeId, nodes, connections).find(
    (node) => node.type === CanvasNodeType.Config
  )
  const textInputs = inputs.filter((input) => input.type === 'text')
  const upstreamText = textInputs
    .map((input) => input.text?.trim())
    .filter(Boolean)
    .join('\n\n')
  const referenceImages = inputs
    .filter((input) => input.type === 'image' && input.mediaUrl)
    .map((input) => input.mediaUrl as string)
  const referenceVideos = inputs
    .filter((input) => input.type === 'video' && input.mediaUrl)
    .map((input) => input.mediaUrl as string)
  const referenceAudios = inputs
    .filter((input) => input.type === 'audio' && input.mediaUrl)
    .map((input) => input.mediaUrl as string)
  const basePrompt = prompt
    .replaceAll(/@\[[^\]]*\]\(node:[^\s)]+\)/g, '')
    .replaceAll(/\s{2,}/g, ' ')
    .trim()

  return {
    prompt: upstreamText
      ? `${basePrompt}${basePrompt ? '\n\n' : ''}${upstreamText}`
      : basePrompt,
    referenceImages,
    referenceVideos,
    referenceAudios,
    presetNodeId: presetNode?.id,
    textCount: textInputs.length,
    imageCount: referenceImages.length,
    videoCount: referenceVideos.length,
    audioCount: referenceAudios.length,
  }
}
