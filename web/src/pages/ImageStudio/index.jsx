import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import './style.css';

const SIZES = [
  { value: '1024x1024', label: '1:1' },
  { value: '1536x1024', label: '3:2' },
  { value: '1024x1536', label: '2:3' },
  { value: 'auto', label: 'Auto' },
];
const QUALITY_KEYS = {
  low: '快速',
  medium: '标准',
  high: '高清',
};
const ASPECT_PREFIX_KEYS = {
  '1024x1024': '方版 1:1，',
  '1536x1024': '横版 3:2，',
  '1024x1536': '竖版 2:3，',
};
const MODEL = 'gpt-image-2';
const TIMEOUT_MS = 300000;
const DB_NAME = 'image_studio_db';
const STORE_NAME = 'history';
const DB_VERSION = 1;
const MAX_ITEMS = 100;

let _taskId = 0;
const nextTaskId = () => ++_taskId;

// ─── IndexedDB ───
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getHistoryDB() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.timestamp - a.timestamp));
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}

async function saveHistoryDB(item) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(item);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    const all = await getHistoryDB();
    if (all.length > MAX_ITEMS) {
      const db2 = await openDB();
      const tx2 = db2.transaction(STORE_NAME, 'readwrite');
      const s2 = tx2.objectStore(STORE_NAME);
      for (const old of all.slice(MAX_ITEMS)) { if (old.id != null) s2.delete(old.id); }
    }
  } catch { /* silent */ }
}

async function clearHistoryDB() {
  try { const db = await openDB(); db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear(); } catch {}
}

// ─── API helpers ───
function getApiKey() { return localStorage.getItem('api_key') || ''; }
function getApiBaseUrl() { return (localStorage.getItem('api_base_url') || window.location.origin).replace(/\/$/, ''); }

function fetchT(input, init, ms = TIMEOUT_MS) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(input, { ...init, signal: c.signal }).finally(() => clearTimeout(t));
}

async function withRetry(fn, retries = 3, base = 2000, onRetry) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (err) {
      if (i >= retries) throw err;
      if (err.status >= 400 && err.status < 500 && err.status !== 429) throw err;
      if (onRetry) onRetry(i + 1);
      await new Promise(r => setTimeout(r, base * 2 ** i));
    }
  }
}

function normalizeImageItems(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const pick = (v) => {
    if (typeof v === 'string') {
      if (v.startsWith('data:image/')) return { url: v };
      if (v.startsWith('http')) return { url: v };
      return { b64_json: v };
    }
    if (!v || typeof v !== 'object') return null;
    if (typeof v.b64_json === 'string') return { b64_json: v.b64_json };
    if (typeof v.url === 'string') return { url: v.url };
    if (typeof v.image_url === 'string') return { url: v.image_url };
    return null;
  };
  for (const key of ['data', 'images', 'output']) {
    const items = payload[key];
    if (Array.isArray(items)) {
      const n = items.map(pick).filter(Boolean);
      if (n.length > 0) return n;
    }
  }
  return [];
}

async function imageToBase64(img) {
  if (img.b64_json) return img.b64_json;
  if (img.url) {
    if (img.url.startsWith('data:image/')) {
      const p = img.url.split(',', 2);
      return p.length === 2 ? p[1] : (() => { throw new Error('invalid data URL'); })();
    }
    const res = await fetchT(img.url);
    if (!res.ok) throw new Error(`图片下载失败：${res.status}`);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
  throw new Error('未返回图片数据');
}

async function apiGenerate(params, onRetry) {
  return withRetry(async () => {
    const res = await fetchT(`${getApiBaseUrl()}/v1/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getApiKey()}` },
      body: JSON.stringify({ model: MODEL, ...params }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) { const e = new Error(payload?.error?.message || res.statusText); e.status = res.status; throw e; }
    const data = normalizeImageItems(payload);
    if (!data.length) throw new Error('生成成功但未解析到图片');
    return { data };
  }, 3, 2000, onRetry);
}

async function apiGenerateConcurrent(params, onRetry) {
  if (params.n <= 1) return apiGenerate(params, onRetry);
  const reqs = Array.from({ length: params.n }, () =>
    apiGenerate({ ...params, n: 1 }, onRetry).catch(e => ({ data: [], error: e }))
  );
  const results = await Promise.all(reqs);
  const all = []; let last = null;
  for (const r of results) { if (r.error) last = r.error; else all.push(...r.data); }
  if (!all.length && last) throw last;
  return { data: all };
}

async function apiEdit(params, onRetry) {
  return withRetry(async () => {
    const form = new FormData();
    form.append('model', MODEL);
    form.append('prompt', params.prompt);
    params.images.forEach(img => form.append('image[]', img));
    if (params.mask) form.append('mask', params.mask);
    form.append('quality', params.quality || 'medium');
    form.append('size', params.size || '1024x1024');
    if (params.output_format) form.append('output_format', params.output_format);
    form.append('response_format', 'b64_json');
    const res = await fetchT(`${getApiBaseUrl()}/v1/images/edits`, {
      method: 'POST', headers: { Authorization: `Bearer ${getApiKey()}` }, body: form,
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) { const e = new Error(payload?.error?.message || res.statusText); e.status = res.status; throw e; }
    const data = normalizeImageItems(payload);
    if (!data.length) throw new Error('编辑成功但未解析到图片');
    return { data };
  }, 3, 2000, onRetry);
}

function downloadImg(b64, fmt, idx) {
  const mime = fmt === 'jpeg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png';
  const a = document.createElement('a');
  a.href = `data:${mime};base64,${b64}`;
  a.download = `image-${Date.now()}-${idx}.${fmt || 'png'}`;
  a.click();
}

// ─── Sub-components ───
function ProgressBar({ startTime }) {
  const [s, setS] = useState(0);
  const { t } = useTranslation();
  useEffect(() => {
    const iv = setInterval(() => setS(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startTime]);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ width: '100%', height: 4, background: 'var(--semi-color-fill-1)', borderRadius: 2, overflow: 'hidden' }}>
        <div className="is-animate-slide" style={{ height: '100%', width: '33%', background: 'var(--semi-color-primary)', borderRadius: 2 }} />
      </div>
      <p style={{ fontSize: 12, color: 'var(--semi-color-text-2)', textAlign: 'center', marginTop: 6 }}>{t('已等待 {{s}}s', { s })}</p>
    </div>
  );
}

function XIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

export default function ImageStudio() {
  const { t } = useTranslation();
  const QUALITIES = useMemo(() => [
    { value: 'low', label: t('快速') },
    { value: 'medium', label: t('标准') },
    { value: 'high', label: t('高清') },
  ], [t]);
  const ASPECT_PREFIX = useMemo(() => ({
    '1024x1024': t('方版 1:1，'),
    '1536x1024': t('横版 3:2，'),
    '1024x1536': t('竖版 2:3，'),
  }), [t]);
  const [mode, setMode] = useState('generate');
  const [tasks, setTasks] = useState([]);
  const retryMap = useRef({});
  // generate form
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState('medium');
  const [fmt, setFmt] = useState('png');
  const [count, setCount] = useState(1);
  // edit form
  const [ePrompt, setEPrompt] = useState('');
  const [eSize, setESize] = useState('1024x1024');
  const [eQuality, setEQuality] = useState('medium');
  const [eFmt, setEFmt] = useState('png');
  const [eImages, setEImages] = useState([]);
  const [ePreviews, setEPreviews] = useState([]);
  const [eMask, setEMask] = useState(null);
  const imgRef = useRef(null);
  const maskRef = useRef(null);
  // history + preview
  const [history, setHistory] = useState([]);
  const [preview, setPreview] = useState(null);
  const [refPreview, setRefPreview] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // server image search
  const [searchRequestId, setSearchRequestId] = useState('');
  const [serverImages, setServerImages] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  // token selector
  const [tokens, setTokens] = useState([]);
  const [selectedTokenId, setSelectedTokenId] = useState(() => {
    const saved = localStorage.getItem('image_studio_token_id');
    return saved ? Number(saved) : null;
  });

  const fetchTokens = useCallback(async () => {
    try {
      const res = await API.get('/api/token/?p=0&size=100');
      if (res.data.success) {
        const active = (res.data.data?.items || res.data.data || []).filter(t => t.status === 1);
        setTokens(active);
      }
    } catch { /* silent */ }
  }, []);

  const selectToken = useCallback(async (tokenId) => {
    if (!tokenId) return;
    try {
      const res = await API.post(`/api/token/${tokenId}/key`);
      if (res.data.success) {
        const fullKey = res.data.data.key;
        localStorage.setItem('api_key', `sk-${fullKey}`);
        localStorage.setItem('api_base_url', window.location.origin);
        localStorage.setItem('image_studio_token_id', String(tokenId));
        setSelectedTokenId(tokenId);
        Toast.success(t('令牌已设置'));
      }
    } catch { Toast.error(t('获取令牌失败')); }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const addTask = useCallback((t) => setTasks(prev => [t, ...prev]), []);
  const updateTask = useCallback((id, u) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...u } : t)), []);
  const removeTask = useCallback((id) => { setTasks(prev => prev.filter(t => t.id !== id)); delete retryMap.current[id]; }, []);

  const doGenerate = useCallback(async (id, params, f, dp) => {
    updateTask(id, { status: 'loading', error: undefined, startTime: Date.now(), retryCount: 0 });
    try {
      const res = await apiGenerateConcurrent(params, (attempt) => updateTask(id, { retryCount: attempt }));
      const imgs = await Promise.all(res.data.map(d => imageToBase64(d)));
      updateTask(id, { status: 'done', images: imgs });
      saveHistoryDB({ type: 'generate', prompt: dp, params: { size: params.size, quality: params.quality, format: f, count: params.n }, images: imgs, timestamp: Date.now() });
    } catch (e) { updateTask(id, { status: 'error', error: e.message || t('生成失败') }); }
  }, [updateTask]);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    if (!getApiKey()) { Toast.warning(t('请先选择令牌')); return; }
    const id = nextTaskId();
    const p = prompt.trim();
    const prefix = ASPECT_PREFIX[size] || '';
    const params = { prompt: prefix + p, size, quality, n: count, output_format: fmt };
    addTask({ id, type: 'generate', images: [], format: fmt, prompt: p, status: 'loading', startTime: Date.now() });
    retryMap.current[id] = () => doGenerate(id, params, fmt, p);
    doGenerate(id, params, fmt, p);
  }, [prompt, size, quality, fmt, count, addTask, doGenerate]);

  const doEdit = useCallback(async (id, p, imgs, m, s, q, f) => {
    updateTask(id, { status: 'loading', error: undefined, startTime: Date.now(), retryCount: 0 });
    try {
      const prefix = ASPECT_PREFIX[s] || '';
      const res = await apiEdit({ prompt: prefix + p, images: imgs, mask: m || undefined, size: s, quality: q, output_format: f }, (attempt) => updateTask(id, { retryCount: attempt }));
      const b64s = await Promise.all(res.data.map(d => imageToBase64(d)));
      updateTask(id, { status: 'done', images: b64s });
      saveHistoryDB({ type: 'edit', prompt: p, params: { size: s, quality: q, format: f }, images: b64s, timestamp: Date.now() });
    } catch (e) { updateTask(id, { status: 'error', error: e.message || t('编辑失败') }); }
  }, [updateTask]);

  const handleEdit = useCallback(() => {
    if (!ePrompt.trim() || eImages.length === 0) return;
    if (!getApiKey()) { Toast.warning(t('请先选择令牌')); return; }    const id = nextTaskId();
    const p = ePrompt.trim();
    const imgs = [...eImages]; const m = eMask; const s = eSize; const q = eQuality; const f = eFmt;
    addTask({ id, type: 'edit', images: [], format: f, prompt: p, status: 'loading', startTime: Date.now() });
    retryMap.current[id] = () => doEdit(id, p, imgs, m, s, q, f);
    doEdit(id, p, imgs, m, s, q, f);
  }, [ePrompt, eImages, eMask, eSize, eQuality, eFmt, addTask, doEdit]);

  const handleImgChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setEImages(prev => [...prev, ...files]);
    files.forEach(f => { const r = new FileReader(); r.onload = () => setEPreviews(prev => [...prev, r.result]); r.readAsDataURL(f); });
    e.target.value = '';
  };
  const removeImg = (i) => { setEImages(prev => prev.filter((_, j) => j !== i)); setEPreviews(prev => prev.filter((_, j) => j !== i)); };

  const sendToEdit = (b64) => {
    const byteStr = atob(b64);
    const ab = new ArrayBuffer(byteStr.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
    const file = new File([ab], `edit-${Date.now()}.png`, { type: 'image/png' });
    setEImages(prev => [...prev, file]);
    setEPreviews(prev => [...prev, `data:image/png;base64,${b64}`]);
    setMode('edit');
    setPreview(null);
  };

  const loadHist = useCallback(async () => {
    setRefreshing(true);
    try { setHistory(await getHistoryDB()); } finally { setRefreshing(false); }
  }, []);

  const searchServerImages = useCallback(async () => {
    const rid = searchRequestId.trim();
    if (!rid) return;
    setSearching(true);
    setSearchError('');
    setServerImages(null);
    try {
      const res = await API.get(`/api/user/images/${encodeURIComponent(rid)}`);
      if (res.data.success && res.data.data?.length > 0) {
        setServerImages(res.data.data);
      } else if (res.data.success) {
        setSearchError(t('未找到该请求ID对应的图片'));
      } else {
        setSearchError(res.data.message || t('查询失败'));
      }
    } catch {
      setSearchError(t('查询失败，请检查请求ID是否正确'));
    } finally {
      setSearching(false);
    }
  }, [searchRequestId]);

  useEffect(() => { loadHist(); }, [loadHist]);
  useEffect(() => { if (mode === 'history') loadHist(); }, [mode, loadHist]);
  useEffect(() => {
    if (!preview) return;
    const h = (e) => { if (e.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [preview]);

  const modeBtn = (m, label) => (
    <button onClick={() => setMode(m)} style={{ flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 14, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: mode === m ? 'var(--semi-color-primary-light-default)' : 'transparent', color: mode === m ? 'var(--semi-color-primary)' : 'var(--semi-color-text-2)' }}>{label}</button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)', marginTop: 60 }}>
      <div style={{ flexShrink: 0, padding: '0 0 12px' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--semi-color-fill-0)', borderRadius: 10, padding: 4, border: '1px solid var(--semi-color-border)' }}>
          {modeBtn('generate', t('生成'))}
          {modeBtn('edit', t('编辑'))}
          {modeBtn('history', t('历史'))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
      {mode !== 'history' && (
        <div style={{ width: 360, flexShrink: 0, background: 'var(--semi-color-bg-1)', borderRadius: 12, border: '1px solid var(--semi-color-border)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 16 }}>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 14, color: 'var(--semi-color-text-1)', marginBottom: 8, fontWeight: 500 }}>{t('令牌')}</label>
              <select
                value={selectedTokenId || ''}
                onChange={e => { const v = Number(e.target.value); if (v) selectToken(v); }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--semi-color-border)', background: 'var(--semi-color-fill-0)', color: 'var(--semi-color-text-0)', fontSize: 14, cursor: 'pointer', appearance: 'auto' }}
              >
                <option value="">{getApiKey() ? t('已配置令牌') : t('请选择令牌')}</option>
                {tokens.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {getApiKey() && <p style={{ fontSize: 12, color: 'var(--semi-color-success)', marginTop: 4 }}>● {t('令牌已就绪')}</p>}
            </div>

            {mode === 'generate' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: 'var(--semi-color-text-1)', marginBottom: 8, fontWeight: 500 }}>{t('描述画面')}</label>
                  <textarea className="is-panel-input" style={{ height: 120 }} placeholder={t('描述你想要的画面...')} value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleGenerate(); }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: 'var(--semi-color-text-1)', marginBottom: 8, fontWeight: 500 }}>{t('画面比例')}</label>
                  <div className="is-opt-group">
                    {SIZES.map(s => <button key={s.value} onClick={() => setSize(s.value)} className={`is-opt-item ${size === s.value ? 'active' : ''}`}>{s.label}</button>)}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: 'var(--semi-color-text-1)', marginBottom: 8, fontWeight: 500 }}>{t('生成质量')}</label>
                  <div className="is-opt-group">
                    {QUALITIES.map(q => <button key={q.value} onClick={() => setQuality(q.value)} className={`is-opt-item ${quality === q.value ? 'active' : ''}`}>{q.label}</button>)}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: 'var(--semi-color-text-1)', marginBottom: 8, fontWeight: 500 }}>{t('格式')}</label>
                    <div className="is-opt-group">
                      {['png','jpeg','webp'].map(f => <button key={f} onClick={() => setFmt(f)} className={`is-opt-item ${fmt === f ? 'active' : ''}`}>{f.toUpperCase()}</button>)}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, color: 'var(--semi-color-text-1)', marginBottom: 8, fontWeight: 500 }}>{t('数量')} <span style={{ color: 'var(--semi-color-primary)' }}>{count}</span></label>
                    <input type="range" min={1} max={8} value={count} onChange={e => setCount(Number(e.target.value))} style={{ width: '100%', marginTop: 12, accentColor: 'var(--semi-color-primary)' }} />
                  </div>
                </div>
                <button className="is-btn-generate" disabled={!prompt.trim()} onClick={handleGenerate}>{t('开始生成')}</button>
                <p style={{ fontSize: 12, color: 'var(--semi-color-text-2)', textAlign: 'center' }}>⌘ + Enter {t('快速生成')}</p>
              </div>
            )}

            {mode === 'edit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: 'var(--semi-color-text-1)', marginBottom: 8, fontWeight: 500 }}>{t('参考图片')} <span style={{ fontWeight: 400, color: 'var(--semi-color-text-2)' }}>{t('最多 10 张')}</span></label>
                  {ePreviews.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                      {ePreviews.map((src, i) => (
                        <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--semi-color-border)', cursor: 'pointer' }} onClick={() => setRefPreview(src)}>
                          <img src={src} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                          <button onClick={(e) => { e.stopPropagation(); removeImg(i); }} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '2px 4px', fontSize: 12 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {eImages.length < 10 && (
                    <div onClick={() => imgRef.current?.click()} style={{ height: 80, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px dashed var(--semi-color-border)', background: 'var(--semi-color-fill-0)', color: 'var(--semi-color-text-2)' }}>
                      {eImages.length === 0 ? t('点击上传图片') : t('继续添加图片')}
                    </div>
                  )}
                  <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImgChange} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: 'var(--semi-color-text-1)', marginBottom: 8, fontWeight: 500 }}>{t('编辑区域')} <span style={{ fontWeight: 400, color: 'var(--semi-color-text-2)' }}>{t('可选')}</span></label>
                  <div onClick={() => maskRef.current?.click()} style={{ height: 64, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px dashed var(--semi-color-border)', background: 'var(--semi-color-fill-0)', color: 'var(--semi-color-text-2)', fontSize: 13 }}>
                    {eMask ? eMask.name : t('上传 PNG 蒙版，透明区域将被 AI 重绘')}
                  </div>
                  <input ref={maskRef} type="file" accept="image/png" style={{ display: 'none' }} onChange={e => setEMask(e.target.files?.[0] || null)} />
                  {eMask && <button onClick={() => setEMask(null)} style={{ fontSize: 12, color: 'var(--semi-color-text-2)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>{t('移除蒙版')}</button>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: 'var(--semi-color-text-1)', marginBottom: 8, fontWeight: 500 }}>{t('描述最终效果')}</label>
                  <textarea className="is-panel-input" style={{ height: 96 }} placeholder={t('描述你想要的最终图片效果...')} value={ePrompt} onChange={e => setEPrompt(e.target.value)} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleEdit(); }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: 'var(--semi-color-text-1)', marginBottom: 8, fontWeight: 500 }}>{t('画面比例')}</label>
                  <div className="is-opt-group">
                    {SIZES.map(s => <button key={s.value} onClick={() => setESize(s.value)} className={`is-opt-item ${eSize === s.value ? 'active' : ''}`}>{s.label}</button>)}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: 'var(--semi-color-text-1)', marginBottom: 8, fontWeight: 500 }}>{t('生成质量')}</label>
                  <div className="is-opt-group">
                    {QUALITIES.map(q => <button key={q.value} onClick={() => setEQuality(q.value)} className={`is-opt-item ${eQuality === q.value ? 'active' : ''}`}>{q.label}</button>)}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, color: 'var(--semi-color-text-1)', marginBottom: 8, fontWeight: 500 }}>{t('格式')}</label>
                  <div className="is-opt-group">
                    {['png','jpeg','webp'].map(f => <button key={f} onClick={() => setEFmt(f)} className={`is-opt-item ${eFmt === f ? 'active' : ''}`}>{f.toUpperCase()}</button>)}
                  </div>
                </div>
                <button className="is-btn-generate" disabled={!ePrompt.trim() || eImages.length === 0} onClick={handleEdit}>{t('开始编辑')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ flex: 1, background: 'var(--semi-color-bg-1)', borderRadius: 12, border: '1px solid var(--semi-color-border)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {mode !== 'history' ? (
          tasks.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, color: 'var(--semi-color-text-2)', opacity: 0.2 }}>✦</div>
                <p style={{ color: 'var(--semi-color-text-2)', fontSize: 15, marginTop: 12 }}>{t('在左侧输入描述，开始创作')}</p>
              </div>
            </div>
          ) : (
            <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 32 }}>
              {tasks.map(task => (
                <div key={task.id} className="is-animate-in">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      {task.status === 'loading' && <div style={{ width: 16, height: 16, border: '2px solid var(--semi-color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
                      {task.status === 'done' && <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(52,211,153)' }} /></div>}
                      {task.status === 'error' && <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(248,113,113)' }} /></div>}
                      <p style={{ fontSize: 14, color: 'var(--semi-color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.prompt}</p>
                    </div>
                    <button onClick={() => removeTask(task.id)} style={{ color: 'var(--semi-color-text-2)', opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0 }}><XIcon /></button>
                  </div>
                  {task.status === 'loading' && (
                    <div style={{ borderRadius: 12, background: 'var(--semi-color-fill-0)', border: '1px solid var(--semi-color-border)', padding: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                        <div style={{ textAlign: 'center', width: '100%', maxWidth: 240 }}>
                          <div style={{ width: 40, height: 40, margin: '0 auto', border: '2px solid var(--semi-color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                          <p style={{ fontSize: 14, color: 'var(--semi-color-text-2)', marginTop: 16 }}>{t('AI 正在创作中...')}</p>
                          {task.retryCount > 0 && <p style={{ fontSize: 13, color: 'var(--semi-color-warning)', marginTop: 4 }}>{t('第 {{count}} 次重试...', { count: task.retryCount })}</p>}
                          <ProgressBar startTime={task.startTime} />
                        </div>
                      </div>
                    </div>
                  )}
                  {task.status === 'error' && (
                    <div style={{ borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', padding: 16 }}>
                      <p style={{ fontSize: 14, color: 'rgb(248,113,113)', marginBottom: 12 }}>{task.error}</p>
                      <button onClick={() => retryMap.current[task.id]?.()} style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.1)', color: 'rgb(248,113,113)', fontSize: 14, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 500 }}>{t('重试')}</button>
                    </div>
                  )}
                  {task.status === 'done' && task.images.length > 0 && (
                    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: task.images.length === 1 ? '1fr' : task.images.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', maxWidth: task.images.length === 1 ? 560 : task.images.length <= 4 ? 720 : 960 }}>
                      {task.images.map((b64, i) => {
                        const mime = task.format === 'jpeg' ? 'image/jpeg' : task.format === 'webp' ? 'image/webp' : 'image/png';
                        return (
                          <div key={i} className="is-img-card" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setRefPreview(`data:${mime};base64,${b64}`)}>
                            <img src={`data:${mime};base64,${b64}`} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 12 }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={(e) => { e.stopPropagation(); sendToEdit(b64); }} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>{t('编辑')}</button>
                                <button onClick={(e) => { e.stopPropagation(); downloadImg(b64, task.format, i); }} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>{t('下载')}</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 32px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {history.length > 0 && <span style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }}>{t('{{count}} 条创作记录', { count: history.length })}</span>}
                  <button onClick={loadHist} disabled={refreshing} style={{ fontSize: 14, color: 'var(--semi-color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>{refreshing ? t('刷新中...') : t('刷新')}</button>
                </div>
                {history.length > 0 && <button onClick={async () => { await clearHistoryDB(); setHistory([]); setPreview(null); }} style={{ fontSize: 14, color: 'var(--semi-color-text-2)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('清空本地')}</button>}
              </div>
            </div>
            <div style={{ padding: '12px 32px 0' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="is-panel-input"
                  style={{ flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 8 }}
                  placeholder={t('输入请求ID查询服务端保存的图片')}
                  value={searchRequestId}
                  onChange={e => setSearchRequestId(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') searchServerImages(); }}
                />
                <button
                  onClick={searchServerImages}
                  disabled={searching || !searchRequestId.trim()}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--semi-color-primary)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: searching || !searchRequestId.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}
                >{searching ? t('查询中...') : t('查询')}</button>
              </div>
              {searchError && <p style={{ fontSize: 12, color: 'var(--semi-color-danger)', marginTop: 8 }}>{searchError}</p>}
              {serverImages && serverImages.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 13, color: 'var(--semi-color-text-2)', marginBottom: 8 }}>
                    {t('服务端图片')} · {t('{{count}} 张', { count: serverImages.length })} · {t('请求ID')}: {serverImages[0].request_id}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: serverImages.length === 1 ? '1fr' : serverImages.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 12, maxWidth: serverImages.length === 1 ? 400 : 720 }}>
                    {serverImages.map((img) => {
                      const imgUrl = `/api/user/images/${encodeURIComponent(img.request_id)}/${img.image_index}`;
                      return (
                        <div key={`${img.request_id}_${img.image_index}`} className="is-img-card" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setRefPreview(imgUrl)}>
                          <img src={imgUrl} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: 12 }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{(img.image_size / 1024).toFixed(0)} KB</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={async (e) => { e.stopPropagation(); try { const r = await fetch(imgUrl); const blob = await r.blob(); const reader = new FileReader(); reader.onload = () => { const b64 = reader.result.split(',')[1]; sendToEdit(b64); }; reader.readAsDataURL(blob); } catch {} }} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>{t('编辑')}</button>
                              <a href={imgUrl} download={img.file_name} onClick={e => e.stopPropagation()} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>{t('下载')}</a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--semi-color-text-2)', marginTop: 8 }}>
                    {t('保存时间')}: {new Date(serverImages[0].created_at * 1000).toLocaleString('zh-CN')} · {t('图片保留7天')}
                  </p>
                </div>
              )}
            </div>
            {history.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 40, color: 'var(--semi-color-text-2)', opacity: 0.2 }}>◷</div>
                  <p style={{ color: 'var(--semi-color-text-2)', fontSize: 15, marginTop: 12 }}>{t('暂无本地历史记录')}</p>
                  <p style={{ color: 'var(--semi-color-text-2)', fontSize: 13, marginTop: 4 }}>{t('可在上方通过请求ID查询服务端保存的图片')}</p>
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px 32px 32px' }}>
                <p style={{ fontSize: 13, color: 'var(--semi-color-text-2)', marginBottom: 12 }}>{t('本地历史')}</p>
                <div style={{ columnCount: 4, columnGap: 16 }}>
                  {history.map((item, i) => (
                    <div key={item.id ?? i} className="is-img-card" onClick={() => setPreview(item)} style={{ cursor: 'pointer', breakInside: 'avoid', marginBottom: 16 }}>
                      <img src={`data:image/png;base64,${item.images[0]}`} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
                      <div style={{ padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, fontWeight: 500, background: item.type === 'generate' ? 'var(--semi-color-primary-light-default)' : 'rgba(16,185,129,0.1)', color: item.type === 'generate' ? 'var(--semi-color-primary)' : 'rgb(52,211,153)' }}>{item.type === 'generate' ? t('生成') : t('编辑')}</span>
                          {item.images.length > 1 && <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>{t('{{count}} 张', { count: item.images.length })}</span>}
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--semi-color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.prompt}</p>
                        <p style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 4 }}>{new Date(item.timestamp).toLocaleString('zh-CN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {preview && (
        <div className="is-preview-overlay" onClick={() => setPreview(null)}>
          <div className="is-preview-modal is-animate-in" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '24px 24px 16px', flexShrink: 0 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, color: 'var(--semi-color-text-0)' }}>{preview.prompt}</p>
                <p style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 4 }}>{new Date(preview.timestamp).toLocaleString('zh-CN')}</p>
              </div>
              <button onClick={() => setPreview(null)} style={{ color: 'var(--semi-color-text-2)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}><XIcon size={18} /></button>
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: '0 24px 24px', display: 'grid', gap: 16, gridTemplateColumns: preview.images.length === 1 ? '1fr' : 'repeat(2, 1fr)' }}>
              {preview.images.map((b64, j) => (
                <div key={j} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--semi-color-border)', background: 'var(--semi-color-fill-0)', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={`data:image/png;base64,${b64}`} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 12 }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { sendToEdit(b64); }} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>{t('编辑')}</button>
                      <button onClick={() => downloadImg(b64, 'png', j)} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>{t('下载')}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {refPreview && (
        <div className="is-preview-overlay" onClick={() => setRefPreview(null)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }} onClick={e => e.stopPropagation()}>
            <img src={refPreview} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
          </div>
        </div>
      )}
    </div>
  );
}
