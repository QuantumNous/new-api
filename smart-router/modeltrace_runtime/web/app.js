// Independent operator adaptation of xqy2006/ModelTrace; new-api / QuantumNous.
const byId = (id) => document.getElementById(id);
const state = {
  csrf: "", bindings: [], availableBindings: [], bank: null, plan: null, collection: null, enrollment: null,
  numeric: null, evidence: null, submitted: false, busy: false, blocked: new Set(),
};
const identity = () => crypto.randomUUID();
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[character]);

function message(text, kind = "error") {
  const element = byId("test-message");
  element.textContent = text;
  element.className = `message ${kind}`;
  element.hidden = !text;
}

async function api(path, value) {
  const options = { credentials: "same-origin", cache: "no-store", redirect: "error", mode: "same-origin" };
  if (value !== undefined) {
    options.method = "POST";
    options.headers = { "Content-Type": "application/json", "X-CSRF-Token": state.csrf };
    options.body = JSON.stringify(value);
    if (new TextEncoder().encode(options.body).length > 256 * 1024) throw new Error("invalid_request");
  }
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || "unavailable");
  return result;
}

function bindAction(id, callback) {
  byId(id).addEventListener("click", () => run(callback));
}

async function run(callback) {
  if (state.busy) return;
  state.busy = true;
  message("One admitted action is running. No automatic retry.", "working");
  try {
    await callback();
    message("Action finished.", "success");
  } catch (error) {
    const code = ["invalid_request", "no_eligible_samples", "busy", "conflict", "not_found",
      "forbidden", "session_required", "capacity", "stale_bank", "bank_changed",
      "restart_required", "write_unknown", "collection_incomplete", "unavailable"].includes(error.message)
      ? error.message : "write_unknown";
    message(`${code}. No action was retried.`);
  } finally {
    state.busy = false;
  }
}

function renderAnalysis(payload) {
  const analysis = payload.analysis;
  state.numeric = { samples: payload.samples, bank_revision: payload.bank_revision,
    collection_id: payload.collection_id };
  state.availableBindings = state.bindings.filter((binding) =>
    (!payload.protocol || binding.protocol === payload.protocol) &&
    (!payload.claimed_model || binding.claimed_model === payload.claimed_model));
  byId("binding-select").innerHTML = state.availableBindings.map((binding, index) =>
    `<option value="${index}">${escapeHtml(binding.claimed_model)} / ${escapeHtml(binding.protocol)} / ${escapeHtml(binding.binding_id)}</option>`).join("");
  state.evidence = null;
  state.submitted = false;
  byId("binding-select").disabled = false;
  byId("probe-id").value = "";
  byId("export-status").textContent = "";
  byId("submit-evidence").disabled = !state.availableBindings.length;
  byId("download-evidence").disabled = !state.availableBindings.length;
  byId("read-probe").disabled = true;
  const rows = analysis.results.map((item, index) => `
    <tr><td>${index + 1}</td><td>${escapeHtml(item.model)}</td><td>${escapeHtml(item.family)}</td>
    <td>${(item.probability * 100).toFixed(1)}%</td></tr>`).join("");
  byId("result").innerHTML = `
    <div class="result-summary"><div><span>Closed-set prediction</span><strong>${escapeHtml(analysis.prediction)}</strong></div>
    <div><span>Probability</span><strong>${(analysis.probability * 100).toFixed(1)}%</strong></div>
    <div><span>Samples</span><strong>${analysis.used_outputs}/3</strong></div>
    <div><span>Completeness</span><strong>${analysis.complete ? "complete" : "partial"}</strong></div></div>
    <div class="result-guidance"><p>Inconclusive identity. Closed-set probability is not identity proof.</p>
    <p>Historical scoring bank revision: ${escapeHtml(payload.bank_revision)}</p></div>
    <div class="table-wrap"><table><thead><tr><th>Rank</th><th>Model</th><th>Family</th><th>Probability</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  byId("result").hidden = false;
}

async function refreshBank() {
  state.bank = await api("/api/banks");
  const summary = state.bank;
  byId("topbar-bank-count").textContent = `${summary.model_count} candidates`;
  byId("active-bank-badge").textContent = "Operator current generation";
  byId("bank-revision").textContent = `${summary.generation} / ${summary.revision}`;
  byId("bank-inventory").innerHTML = summary.families.map((family) => `
    <span class="fingerprint-item">${escapeHtml(family.label || family.name || family.id)}:
    ${family.row_count} registered rows; ${family.active ? "active" : "inactive"}</span>`).join("");
  byId("enroll-family").innerHTML = summary.families.filter((family) => !["gpt", "claude"].includes(family.id))
    .map((family) => `<option value="${escapeHtml(family.id)}">${escapeHtml(family.label || family.name || family.id)}</option>`).join("");
}

async function challengePlan() {
  state.plan = await api("/api/challenges");
  byId("challenge-list").innerHTML = state.plan.challenges.map((challenge, index) => `
    <article class="challenge-item"><div class="challenge-header"><strong>Challenge ${index + 1}</strong>
    <span>${challenge.expected_count} numbers</span><button type="button" data-copy="${index}">Copy prompt</button></div>
    <div class="challenge-columns"><div><label>Owned generated prompt</label><pre>${escapeHtml(challenge.prompt)}</pre></div>
    <div><label for="output-${index}">Paste complete output ${index + 1}</label>
    <textarea id="output-${index}" maxlength="65536" spellcheck="false" autocomplete="off"></textarea></div></div></article>`).join("");
  for (const button of document.querySelectorAll("[data-copy]")) {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(state.plan.challenges[Number(button.dataset.copy)].prompt);
        button.textContent = "Copied";
      } catch {
        message("Clipboard unavailable. Select the visible prompt.");
      }
    });
  }
}

function target(prefix) {
  const value = {
    base_url: byId(`${prefix}-base`).value, api_model: byId(`${prefix}-model`).value,
    api_key: byId(`${prefix}-key`).value,
    api_format: byId(prefix === "test-api" ? "test-protocol" : "enroll-protocol").value,
  };
  byId(`${prefix}-key`).value = "";
  return value;
}

function committedSamples(record) {
  return Object.entries(record.slots || {}).filter(([, slot]) => slot.result?.eligible)
    .map(([challenge_id, slot]) => ({
      challenge_id, expected_count: slot.result.expected_count, numbers: slot.result.numbers,
    })).slice(0, 3);
}

function evidence() {
  if (!state.evidence) {
    if (!state.numeric || !state.availableBindings.length) throw new Error("invalid_request");
    const binding = state.availableBindings[Number(byId("binding-select").value)];
    state.evidence = {
      schema_version: 1, probe_id: identity(), ...binding,
      bank_revision: state.numeric.bank_revision, samples: state.numeric.samples,
    };
    byId("probe-id").value = state.evidence.probe_id;
    byId("binding-select").disabled = true;
  }
  return state.evidence;
}

function download() {
  const blob = new Blob([JSON.stringify(evidence())], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "modeltrace-numeric-evidence.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

for (const button of document.querySelectorAll("[data-workspace]")) {
  button.addEventListener("click", () => {
    for (const item of document.querySelectorAll("[data-workspace]")) item.classList.toggle("active", item === button);
    for (const panel of document.querySelectorAll(".workspace")) panel.classList.toggle("active", panel.id === `workspace-${button.dataset.workspace}`);
  });
}
for (const button of document.querySelectorAll("[data-mode]")) {
  button.addEventListener("click", () => {
    for (const item of document.querySelectorAll("[data-mode]")) item.classList.toggle("active", item === button);
    byId("test-manual").classList.toggle("active", button.dataset.mode === "manual");
    byId("test-api").classList.toggle("active", button.dataset.mode === "api");
  });
}
bindAction("regenerate", challengePlan);
bindAction("analyze", async () => {
  const outputs = state.plan.challenges.map((challenge, index) => ({
    challenge_id: challenge.id, expected_count: challenge.expected_count, text: byId(`output-${index}`).value,
  }));
  for (let index = 0; index < 3; index += 1) byId(`output-${index}`).value = "";
  const payload = await api("/api/analyze", { action_id: identity(), outputs });
  renderAnalysis(payload);
});
byId("api-test-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.busy || state.blocked.has("collection")) {
    byId("test-api-key").value = "";
    return;
  }
  const operation_id = identity();
  const value = { operation_id, target: target("test-api"), model_label: byId("test-label").value };
  const action = byId("test-action").value;
  if (action === "probe") {
    value.challenge_set_id = state.plan.challenge_set_id;
    value.challenge_id = state.plan.challenges[0].id;
  }
  run(async () => {
    state.blocked.add("collection");
    state.collection = { operation_id };
    const result = await api(action === "probe" ? "/api/test/probe" : "/api/test/auto", value);
    state.collection = { ...result, operation_id,
      protocol: value.target.api_format === "openai" ? "chat" : "messages",
      claimed_model: value.model_label };
    if (result.status !== "write_unknown") state.blocked.delete("collection");
    const status = byId("collection-status");
    status.hidden = false;
    status.textContent = `${result.status}; requested ${result.counts?.requested || 0}; provider calls ${result.counts?.transport_calls || 0}; ${result.complete ? "complete" : "partial / inconclusive"}. Unknown slots are not resumed.`;
    byId("analyze-collected").disabled = !committedSamples(result).length;
    byId("lookup-operation").disabled = false;
    if (result.analysis) renderAnalysis({
      analysis: result.analysis, bank_revision: result.bank_revision, samples: committedSamples(result),
      protocol: state.collection.protocol, claimed_model: state.collection.claimed_model,
      collection_id: operation_id,
    });
  });
});
bindAction("lookup-operation", async () => {
  const result = await api(`/api/operations/${state.collection.operation_id}`);
  byId("collection-status").textContent = `${result.status}; ${result.counts.transport_calls} provider calls. Read-only lookup.`;
});
bindAction("analyze-collected", async () => {
  const payload = await api("/api/analyze", {
    action_id: identity(), operation_id: state.collection.operation_id,
    samples: committedSamples(state.collection),
  });
  renderAnalysis({ ...payload, protocol: state.collection.protocol,
    claimed_model: state.collection.claimed_model, collection_id: state.collection.operation_id });
});
bindAction("download-evidence", download);
bindAction("submit-evidence", async () => {
  if (state.submitted) return;
  const value = evidence();
  state.submitted = true;
  byId("submit-evidence").disabled = true;
  byId("read-probe").disabled = false;
  byId("export-status").textContent = "Submission pending; never automatically reposted.";
  try {
    const request = { action_id: identity(), evidence: value };
    if (state.numeric.collection_id) request.operation_id = state.numeric.collection_id;
    const result = await api("/api/export", request);
    byId("export-status").textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    byId("export-status").textContent = "Submission rejected or unknown. Keep the same probe ID; use signed readback.";
    throw error;
  }
});
bindAction("read-probe", async () => {
  byId("export-status").textContent = JSON.stringify(await api(`/api/probes/${state.evidence.probe_id}`), null, 2);
});
byId("create-bank-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.blocked.has("publication")) return;
  run(async () => {
    state.blocked.add("publication");
    await api("/api/banks", {
      action_id: identity(), bank_id: byId("new-bank-id").value, label: byId("new-bank-name").value,
      generation: state.bank.generation, bank_revision: state.bank.revision,
    });
    state.blocked.delete("publication");
    await refreshBank();
  });
});
byId("auto-enrollment").addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.busy || state.blocked.has("collection")) {
    byId("enroll-key").value = "";
    return;
  }
  const family_id = byId("enroll-family").value;
  const family = state.bank.families.find((item) => item.id === family_id);
  const value = {
    operation_id: identity(), target: target("enroll"), model_label: byId("enroll-label").value,
    family_id, family_name: family?.label || family?.name || family_id,
    sample_count: Number(byId("sample-count").value),
  };
  run(async () => {
    state.blocked.add("collection");
    byId("publish-enrollment").disabled = true;
    const result = await api("/api/enroll/auto", value);
    state.enrollment = { operation_id: value.operation_id, family_id, result };
    if (result.status !== "write_unknown") state.blocked.delete("collection");
    byId("enrollment-status").textContent = `${result.status}; ${result.rows?.length || 0} numeric rows; ${result.counts.transport_calls} provider calls. Not published.`;
    byId("publish-enrollment").disabled = result.status !== "succeeded";
  });
});
bindAction("publish-enrollment", async () => {
  if (state.blocked.has("publication")) return;
  state.blocked.add("publication");
  byId("publish-enrollment").disabled = true;
  await api(`/api/banks/${state.enrollment.family_id}/enroll`, {
    action_id: identity(), operation_id: state.enrollment.operation_id,
    generation: state.bank.generation, bank_revision: state.bank.revision,
  });
  state.blocked.delete("publication");
  await refreshBank();
  byId("enrollment-status").textContent += " Explicitly published; inactive until four distinct fitting challenges.";
});
bindAction("rebuild", async () => {
  if (state.blocked.has("publication")) return;
  state.blocked.add("publication");
  await api("/api/banks/rebuild", { action_id: identity(), generation: state.bank.generation, bank_revision: state.bank.revision });
  state.blocked.delete("publication");
  await refreshBank();
});
bindAction("reload", async () => {
  await api("/api/banks/reload", { action_id: identity() });
  await refreshBank();
});

run(async () => {
  const session = await api("/api/session");
  state.csrf = session.csrf_token;
  state.bindings = session.bindings;
  byId("binding-select").innerHTML = state.bindings.map((binding, index) =>
    `<option value="${index}">${escapeHtml(binding.claimed_model)} / ${escapeHtml(binding.protocol)} / ${escapeHtml(binding.binding_id)}</option>`).join("");
  await refreshBank();
  await challengePlan();
});
