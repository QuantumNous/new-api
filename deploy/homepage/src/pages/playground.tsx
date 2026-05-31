import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../i18n'
import { api, getAuthHeaders } from '../lib/api'
import { useAuth } from '../lib/auth'

interface ModelItem {
  id: string
  object?: string
  owned_by?: string
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export function Playground() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [models, setModels] = useState<ModelItem[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<ModelItem[]>('/api/models')
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setModels(list)
        if (list.length > 0 && !selectedModel) {
          setSelectedModel(list[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || !selectedModel || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setStreaming(true)

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
    setMessages([...updated, assistantMsg])

    try {
      const res = await fetch('/pg/chat/completions', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        assistantMsg.content = `Error: ${res.status} ${errText}`
        setMessages([...updated, assistantMsg])
        setStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        assistantMsg.content = 'Error: No response body'
        setMessages([...updated, assistantMsg])
        setStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              assistantMsg.content += delta
              setMessages([...updated, { ...assistantMsg }])
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err) {
      assistantMsg.content = `Error: ${err instanceof Error ? err.message : 'Request failed'}`
      setMessages([...updated, assistantMsg])
    }

    setStreaming(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="page-container">
      <h1 className="page-title">{t('playground.title')}</h1>

      <div className="pg-layout">
        <div className="pg-sidebar">
          <label className="pg-label">{t('playground.model')}</label>
          {loading ? (
            <div className="pg-loading"><div className="spinner" /></div>
          ) : (
            <select
              className="pg-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.id}</option>
              ))}
            </select>
          )}
        </div>

        <div className="pg-main">
          <div className="pg-chat">
            {messages.length === 0 && (
              <div className="pg-empty">{t('playground.placeholder')}</div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`pg-message pg-message-${msg.role}`}>
                <span className="pg-message-role">{msg.role}</span>
                <div className="pg-message-content">
                  {msg.content || (streaming && msg.role === 'assistant' ? '|' : '')}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="pg-input-bar">
            <textarea
              className="pg-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('playground.placeholder')}
              rows={2}
              disabled={streaming}
            />
            <button
              className="pg-send-btn"
              onClick={handleSend}
              disabled={streaming || !input.trim() || !selectedModel}
            >
              {t('playground.send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
