// Adapted from xqy2006/ModelTrace; pinned local scoring, independent of current generation.
import { analyzeGlobalOutputs, parseNumbers } from "./fingerprint-core.js";
import { generateChallenges } from "./challenge-browser.js";

const REVISION = "f267d0513aa06981d024ec5394746fceddf44e4e8a75fa6bf8304255f4b32d6d";
const state = { bank: null, challenges: [], samples: null, evidence: null, session: null, submitted: false };
const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[character]);
const percent = (value) => `${(value * 100).toFixed(1)}%`;

function message(text, type = "error") {
  byId("test-message").textContent = text;
  byId("test-message").className = `message ${type}`;
  byId("test-message").hidden = !text;
}

function regenerate() {
  state.challenges = generateChallenges(3);
  state.samples = state.evidence = null;
  state.submitted = false;
  byId("result").hidden = true;
  byId("download-evidence").disabled = byId("submit-evidence").disabled = true;
  byId("read-probe").disabled = true;
  byId("probe-id").value = "";
  byId("binding-select").disabled = false;
  byId("challenge-list").innerHTML = state.challenges.map((challenge, index) => `
    <article class="challenge-item"><div class="challenge-header"><strong>挑战 ${index + 1}</strong>
    <span>${challenge.expected_count} 个数字</span><button type="button" data-copy="${index}">复制提示词</button></div>
    <div class="challenge-columns"><div><label>发送给待测模型</label><pre>${escapeHtml(challenge.prompt)}</pre></div>
    <div><label for="output-${index}">粘贴完整输出 ${index + 1}</label>
    <textarea id="output-${index}" maxlength="65536" spellcheck="false" autocomplete="off"></textarea></div></div></article>`).join("");
  for (const button of document.querySelectorAll("[data-copy]")) {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(state.challenges[Number(button.dataset.copy)].prompt);
        button.textContent = "已复制";
      } catch {
        message("请选中并复制可见提示词。");
      }
    });
  }
}

function renderResult(payload) {
  const diagnostics = payload.diagnostics.map((item, index) => `
    <span class="diagnostic ${item.accepted ? "accepted" : "rejected"}">挑战 ${index + 1}: ${item.parsed_numbers} 个数字 / ${item.accepted ? "计入" : "忽略"}</span>`).join("");
  const rows = payload.results.map((item, index) => `
    <tr class="${index === 0 ? "winner" : ""}"><td>${index + 1}</td><td><strong>${escapeHtml(item.display_name)}</strong></td>
    <td>${escapeHtml(item.family_name)}</td><td>${percent(item.probability)}</td><td>${percent(item.profile_similarity)}</td></tr>`).join("");
  byId("result").innerHTML = `
    <div class="result-summary"><div><span>最可能模型 / Prediction</span><strong id="prediction">${escapeHtml(payload.prediction_name)}</strong></div>
    <div><span>闭集概率 / Closed-set</span><strong id="probability" data-value="${payload.probability}">${percent(payload.probability)}</strong></div>
    <div><span>有效查询</span><strong>${payload.used_outputs}/3</strong></div><div><span>Completeness</span><strong>${payload.used_outputs === 3 ? "complete" : "partial"}</strong></div></div>
    <div class="diagnostics">${diagnostics}</div>
    <div class="table-wrap"><table><thead><tr><th>排序</th><th>候选模型</th><th>家族</th><th>归因概率</th><th>分布相似度</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="result-guidance" role="note"><p>Inconclusive identity. Closed-set probability is not identity proof.</p>
    <p>仅对指纹库内的模型进行归因；库外模型可能得到任何结果。Claude Code 系统提示词会影响偏好，建议不要在 Claude Code 中测试。</p>
    <p>Pinned builtin revision: ${REVISION}. Not operator-current generation.</p></div>`;
  byId("result").hidden = false;
}

function analyze() {
  byId("result").hidden = true;
  try {
    const outputs = state.challenges.map((challenge, index) => ({
      challenge_id: challenge.id, expected_count: challenge.expected_count,
      text: byId(`output-${index}`).value,
    }));
    if (outputs.some((item) => new TextEncoder().encode(item.text).length > 65536)) throw new Error("input_too_large");
    const samples = outputs.map((item) => ({
      challenge_id: item.challenge_id, expected_count: item.expected_count, numbers: parseNumbers(item.text),
    }));
    for (let index = 0; index < 3; index += 1) byId(`output-${index}`).value = "";
    if (samples.some((sample) => sample.numbers.length > 4096)) throw new Error("too_many_numbers");
    const payload = analyzeGlobalOutputs(outputs, state.bank);
    state.samples = samples;
    state.evidence = null;
    state.submitted = false;
    byId("binding-select").disabled = false;
    byId("probe-id").value = "";
    renderResult(payload);
    byId("download-evidence").disabled = byId("submit-evidence").disabled = !state.session?.bindings.length;
    byId("read-probe").disabled = true;
    message("本地计算完成 / Local analysis complete.", "success");
  } catch {
    state.samples = null;
    byId("download-evidence").disabled = byId("submit-evidence").disabled = true;
    message("invalid_request / 无有效数字，或超过 64 KiB 原文、4096 数字上限。");
  }
}

async function api(path, value) {
  const options = { credentials: "same-origin", cache: "no-store", redirect: "error", mode: "same-origin" };
  if (value !== undefined) {
    options.method = "POST";
    options.headers = { "Content-Type": "application/json", "X-CSRF-Token": state.session.csrf_token };
    options.body = JSON.stringify(value);
    if (new TextEncoder().encode(options.body).length > 256 * 1024) throw new Error("invalid_request");
  }
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok || result.error) throw new Error("submission_rejected_or_unknown");
  return result;
}

function evidence() {
  if (!state.evidence) {
    if (!state.samples || !state.session?.bindings.length) throw new Error("invalid_request");
    state.evidence = {
      schema_version: 1, probe_id: crypto.randomUUID(),
      ...state.session.bindings[Number(byId("binding-select").value)],
      bank_revision: REVISION, samples: state.samples,
    };
    byId("probe-id").value = state.evidence.probe_id;
    byId("binding-select").disabled = true;
  }
  return state.evidence;
}

byId("regenerate").addEventListener("click", regenerate);
byId("analyze").addEventListener("click", analyze);
byId("download-evidence").addEventListener("click", () => {
  try {
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence())], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "modeltrace-numeric-evidence.json";
    anchor.click();
    URL.revokeObjectURL(url);
  } catch {
    message("invalid_request");
  }
});
byId("submit-evidence").addEventListener("click", async () => {
  if (state.submitted) return;
  state.submitted = true;
  byId("submit-evidence").disabled = true;
  try {
    const value = evidence();
    byId("read-probe").disabled = false;
    byId("export-status").textContent = JSON.stringify(await api("/api/export", {
      action_id: crypto.randomUUID(), evidence: value,
    }), null, 2);
  } catch {
    byId("export-status").textContent = "Submission rejected or unknown. No retry; preserve probe ID and pinned revision.";
  }
});
byId("read-probe").addEventListener("click", async () => {
  try {
    byId("export-status").textContent = JSON.stringify(await api(`/api/probes/${state.evidence.probe_id}`), null, 2);
  } catch {
    byId("export-status").textContent = "Readback unavailable. No POST was sent.";
  }
});

async function initialize() {
  try {
    const response = await fetch("./data/unified_bank.json", { cache: "no-store", redirect: "error" });
    if (!response.ok || Number(response.headers.get("Content-Length")) > 16 * 1024 * 1024) throw new Error();
    const chunks = [];
    const reader = response.body.getReader();
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 16 * 1024 * 1024) { await reader.cancel(); throw new Error(); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
      .map((value) => value.toString(16).padStart(2, "0")).join("");
    if (digest !== REVISION) throw new Error();
    state.bank = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    byId("bank-revision").textContent = `Fetched-byte SHA-256: ${digest}`;
    byId("topbar-bank-count").textContent = `${state.bank.models.length} 个候选模型`;
    byId("active-bank-badge").textContent = "Pinned builtin / 固定内置库";
    byId("regenerate").disabled = byId("analyze").disabled = false;
    regenerate();
    message("Pinned bank verified; local analysis ready.", "success");
    try {
      state.session = await api("/api/session");
      byId("binding-select").innerHTML = state.session.bindings.map((binding, index) => `
        <option value="${index}">${escapeHtml(binding.claimed_model)} / ${escapeHtml(binding.protocol)} / ${escapeHtml(binding.binding_id)}</option>`).join("");
    } catch {
      byId("export-status").textContent = "Same-origin operator unavailable. Local analysis only.";
    }
  } catch {
    message("Pinned bank integrity failed. Use canonical /static-manual/ via HTTP; analysis disabled.");
  }
}
initialize();
