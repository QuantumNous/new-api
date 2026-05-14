import { API } from '../helpers/api';
import { getUserIdFromLocalStorage } from '../helpers';

const serverBase = import.meta.env.VITE_REACT_APP_SERVER_URL || '';

export const getAgentConfig = () => API.get('/api/agent/config');
export const listAgentSessions = (limit = 20) =>
  API.get('/api/agent/sessions', { params: { limit } });
export const getAgentSession = (id) => API.get(`/api/agent/sessions/${id}`);
export const deleteAgentSession = (id) => API.delete(`/api/agent/sessions/${id}`);
export const listAgentTools = () => API.get('/api/agent/tools');
export const adminListAgentTools = () => API.get('/api/agent/admin/tools');
export const adminUpdateAgentTool = (name, enabled) =>
  API.put(`/api/agent/admin/tools/${encodeURIComponent(name)}`, { enabled });
export const adminListAgentAudit = (params) =>
  API.get('/api/agent/admin/audit', { params });
export const adminListKBDocs = () => API.get('/api/agent/admin/kb/docs');
export const adminCreateKBDoc = (payload) =>
  API.post('/api/agent/admin/kb/docs', payload);
export const adminDeleteKBDoc = (id) =>
  API.delete(`/api/agent/admin/kb/docs/${id}`);
export const searchAgentKnowledge = (query) =>
  API.get('/api/agent/kb/search', { params: { query } });

export async function streamAgentChat(payload, onEvent, signal) {
  return streamAgentEvents('/api/agent/chat', payload, onEvent, signal);
}

export async function streamAgentConfirm(payload, onEvent, signal) {
  return streamAgentEvents('/api/agent/confirm', payload, onEvent, signal);
}

async function streamAgentEvents(path, payload, onEvent, signal) {
  const response = await fetch(`${serverBase}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'New-Api-User': String(getUserIdFromLocalStorage()),
      'Cache-Control': 'no-store',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Agent request failed: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    const json = await response.json();
    if (json?.success === false) {
      throw new Error(json.message || 'Agent request failed');
    }
    onEvent?.({ type: 'done', data: json });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      const event = parseSSEBlock(block);
      if (event) {
        onEvent?.(event);
      }
    }
  }

  if (buffer.trim()) {
    const event = parseSSEBlock(buffer);
    if (event) {
      onEvent?.(event);
    }
  }
}

function parseSSEBlock(block) {
  const lines = block.split('\n');
  const eventLine = lines.find((line) => line.startsWith('event:'));
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());
  if (dataLines.length === 0) return null;
  const raw = dataLines.join('\n');
  if (raw === '[DONE]') return { type: 'done', done: true };
  try {
    const parsed = JSON.parse(raw);
    return { type: parsed.type || eventLine?.slice(6).trim(), ...parsed };
  } catch (error) {
    return { type: eventLine?.slice(6).trim() || 'message', delta: raw };
  }
}
