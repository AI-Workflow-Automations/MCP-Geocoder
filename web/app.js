// Demo-Oberfläche: ruft ausschließlich die REST-API dieses Servers.
// Keine eigene Fachlogik - was hier erscheint, hat der Server entschieden.

const $ = (selector) => document.querySelector(selector);

// Dieselben Fälle wie in test/hard-cases.test.ts - dort gegen ein Fixture,
// hier live gegen das amtliche Verzeichnis der eingegebenen PLZ.
const HARD_CASES = [
  { street: "Henrichweg 24", why: "Stem sounds like Heinrichstraße, street type differs" },
  { street: "Heinrich Str. 24", why: "Abbreviation and space before the street type" },
  { street: "Invaliden Str 12a", why: "Detached street type, no period, house number with suffix" },
  { street: "Akker Straße 3", why: "Double consonant instead of ck" },
  { street: "Bernauer 5", why: "Street type missing entirely" },
  { street: "Ernst Reuter Platz", why: "Hyphens missing" },
  { street: "Mühlen Weg", why: "Umlaut plus detached street type" },
  { street: "Muehlenweg", why: "Umlaut dictated as ue" },
  { street: "Chaussee Straße", why: "Two street types" },
  { street: "Zwitscherweg 7", why: "Does not exist - must not be confirmed" },
  { street: "äh also die Torstraße", why: "Filler words in the transcript" },
  { street: "Tor Str", why: "Shortened, no period" },
];

const MCP_TOOL_BY_PATH = {
  "/api/postal-code": "resolve_postal_code",
  "/api/address": "resolve_address",
  "/api/address/select": "select_candidate",
  "/api/escalate": "flag_for_human",
  "/api/keyterms": "generate_keyterms",
  "/openapi.json": "describe_api",
};

async function post(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? response.statusText);
  return payload;
}

// --- Tabs ------------------------------------------------------------------
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    for (const t of document.querySelectorAll(".tab")) t.classList.toggle("is-active", t === tab);
    for (const p of document.querySelectorAll(".panel"))
      p.classList.toggle("is-active", p.id === `tab-${tab.dataset.tab}`);
    if (tab.dataset.tab === "api") loadApiDoc();
  });
});

// --- Health ----------------------------------------------------------------
fetch("/health")
  .then((r) => r.json())
  .then((health) => {
    for (const provider of health.providers ?? []) {
      const dot = document.querySelector(`.dot[data-provider="${provider.name}"]`);
      if (dot) {
        dot.classList.add(provider.ok ? "ok" : "bad");
        dot.title = provider.ok ? `${provider.latencyMs} ms` : (provider.error ?? "unreachable");
      }
    }
  })
  .catch(() => {});

// --- Demo ------------------------------------------------------------------
$("#form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await runResolve();
});

$("#check-plz").addEventListener("click", async () => {
  const spoken = $("#postalCode").value.trim();
  if (!spoken) return;
  await withBusy(async () => {
    const result = await post("/api/postal-code", { spoken });
    renderResult({ ...result, candidates: [], heard: { postalCode: spoken } }, result.localities);
  });
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    $("#postalCode").value = chip.dataset.plz;
    $("#street").value = chip.dataset.street;
    runResolve();
  });
});

async function runResolve() {
  const street = $("#street").value.trim();
  const postalCode = $("#postalCode").value.trim() || undefined;
  if (!street) return;
  await withBusy(async () => {
    const result = await post("/api/address", { street, postalCode });
    renderResult(result);
  });
}

async function withBusy(action) {
  const buttons = document.querySelectorAll("#form button");
  for (const b of buttons) b.disabled = true;
  try {
    await action();
  } catch (error) {
    renderResult({ status: "unresolved", needsHuman: true, speech: "", candidates: [], reason: error.message });
  } finally {
    for (const b of buttons) b.disabled = false;
  }
}

function renderResult(result, localities) {
  $("#result").hidden = false;
  const status = $("#status");
  status.textContent = result.status;
  status.className = `badge ${result.status}`;
  $("#human").hidden = !result.needsHuman;
  $("#speech").textContent = result.speech || "–";
  $("#reason").textContent = result.reason ?? "";
  $("#raw").textContent = JSON.stringify(result, null, 2);

  const list = $("#candidates");
  list.innerHTML = "";
  if (localities) {
    for (const locality of localities) {
      list.insertAdjacentHTML(
        "beforeend",
        `<li class="candidate"><div class="candidate-row"><span class="candidate-name">${esc(locality.locality)}</span>
         <span class="candidate-meta">${esc(locality.postalCode)} · ${esc(locality.district ?? "")} ${esc(locality.federalState ?? "")}</span></div></li>`,
      );
    }
    return;
  }
  (result.candidates ?? []).forEach((candidate, index) => {
    const pct = Math.round(candidate.confidence * 100);
    const tone = candidate.confidence >= 0.85 ? "ok" : candidate.confidence >= 0.7 ? "warn" : "bad";
    const b = candidate.breakdown;
    list.insertAdjacentHTML(
      "beforeend",
      `<li class="candidate ${index === 0 && result.status !== "unresolved" ? "best" : ""}">
        <div class="candidate-row">
          <span><span class="candidate-name">${esc(candidate.street)}</span>
          <span class="candidate-meta"> · ${esc(candidate.postalCode)} ${esc(candidate.locality)} · ${esc(candidate.source)}</span></span>
          <span class="candidate-score">${candidate.confidence.toFixed(3)}</span>
        </div>
        <div class="bar ${tone}"><span style="width:${pct}%"></span></div>
        ${
          b
            ? `<div class="breakdown">
          <span>lex ${b.lexical.toFixed(2)}</span><span>phon ${b.phonetic.toFixed(2)}</span>
          <span>tok ${b.token.toFixed(2)}</span><span>typ ${b.streetType.toFixed(2)}</span></div>`
            : ""
        }
        ${b?.cappedBy ? `<div class="capped">⚠ capped: ${esc(b.cappedBy)}</div>` : ""}
      </li>`,
    );
  });
}

// --- Schwierige Fälle ------------------------------------------------------
$("#run-cases").addEventListener("click", async () => {
  const postalCode = $("#cases-plz").value.trim() || undefined;
  const tbody = $("#cases tbody");
  tbody.innerHTML = "";
  $("#run-cases").disabled = true;
  for (const testCase of HARD_CASES) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${esc(testCase.street)}</td><td class="why">${esc(testCase.why)}</td><td colspan="3">…</td>`;
    tbody.appendChild(row);
    try {
      const result = await post("/api/address", { street: testCase.street, postalCode });
      const best = result.best ?? result.candidates[0];
      row.innerHTML = `<td>${esc(testCase.street)}</td><td class="why">${esc(testCase.why)}</td>
        <td><span class="badge ${result.status}">${result.status}</span>${result.needsHuman ? ' <span class="flag">⚑</span>' : ""}</td>
        <td>${best ? esc(best.street) : "–"}${best?.breakdown?.cappedBy ? ' <span class="capped">⚠</span>' : ""}</td>
        <td class="candidate-score">${best ? best.confidence.toFixed(3) : "–"}</td>`;
    } catch (error) {
      row.innerHTML = `<td>${esc(testCase.street)}</td><td class="why">${esc(testCase.why)}</td><td colspan="3" class="capped">${esc(error.message)}</td>`;
    }
  }
  $("#run-cases").disabled = false;
});

// --- API-Doku aus OpenAPI rendern -----------------------------------------
let apiDocLoaded = false;

/** Operationen nach erstem Tag gruppieren - so wie die OpenAPI sie ordnet. */
function groupOperationsByTag(spec) {
  const byTag = new Map();
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const tag = op.tags?.[0] ?? "Other";
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag).push({ path, method, op });
    }
  }
  return byTag;
}

function endpointHtml({ path, method, op }) {
  const tool = MCP_TOOL_BY_PATH[path];
  const toolHtml = tool ? `<span class="tool">MCP: <code>${esc(tool)}</code></span>` : "";
  const description = op.description ? ` – ${esc(op.description)}` : "";
  return `<div class="endpoint"><span class="method">${method.toUpperCase()}</span><span class="path">${esc(path)}</span>${toolHtml}</div>
    <p class="desc"><b>${esc(op.summary ?? "")}</b>${description}</p>`;
}

function tagHeaderHtml(tagInfo) {
  const description = tagInfo.description ? `<p class="desc">${esc(tagInfo.description)}</p>` : "";
  return `<h3>${esc(tagInfo.name)}</h3>${description}`;
}

async function loadApiDoc() {
  if (apiDocLoaded) return;
  apiDocLoaded = true;
  const container = $("#api-doc");
  try {
    const spec = await (await fetch("/openapi.json")).json();
    const byTag = groupOperationsByTag(spec);
    container.innerHTML = "";
    for (const tagInfo of spec.tags ?? []) {
      container.insertAdjacentHTML("beforeend", tagHeaderHtml(tagInfo));
      for (const operation of byTag.get(tagInfo.name) ?? []) {
        container.insertAdjacentHTML("beforeend", endpointHtml(operation));
      }
    }
  } catch (error) {
    container.textContent = `Could not load OpenAPI: ${error.message}`;
  }
}

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
