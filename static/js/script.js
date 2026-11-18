(() => {
  "use strict";

  const API_URL = "/api/schedule";

  const LIMITS = { processes: 20, max: 1000 };

  const FIRST_ID = 1;

  const COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
                  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

  const EXAMPLE = { quantum: 2, processes: [[0, 8], [1, 4], [2, 9], [3, 5]] };

  const $ = (id) => document.getElementById(id);
  const form = $("form"), rowsEl = $("rows"), quantumEl = $("quantum");
  const addBtn = $("add"), submitBtn = $("submit"), formNotice = $("form-notice");
  const sheet = $("sheet"), errorEl = $("error"), avgEl = $("avg");
  const waitsEl = $("waits"), chartEl = $("chart"), downloadEl = $("download");
  const numberFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

  function intOrNull(raw) {
    const s = String(raw).trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isInteger(n) ? n : null;
  }
  const field = (li, name) => li.querySelector(`[data-field="${name}"]`);

  function createRow(arrival, burst) {
    const li = document.createElement("li");
    li.className = "row row-grid";
    li.innerHTML = `
      <span class="pid"><span class="dot"></span><span class="pid-label"></span></span>
      <input type="number" inputmode="numeric" min="0" max="${LIMITS.max}" step="1" data-field="arrival">
      <input type="number" inputmode="numeric" min="1" max="${LIMITS.max}" step="1" data-field="burst">
      <button type="button" class="icon-btn" data-remove>×</button>
      <div class="strip" aria-hidden="true"><i></i></div>`;
    field(li, "arrival").value = arrival;
    field(li, "burst").value = burst;
    return li;
  }

  function renumber() {
    const items = [...rowsEl.children];
    items.forEach((li, i) => {
      li.style.setProperty("--c", COLORS[i % COLORS.length]);
      const name = "P" + (FIRST_ID + i);
      li.querySelector(".pid-label").textContent = name;
      field(li, "arrival").setAttribute("aria-label", `${name}: время прихода`);
      field(li, "burst").setAttribute("aria-label", `${name}: длительность`);
      li.querySelector("[data-remove]").setAttribute("aria-label", `Удалить ${name}`);
      li.querySelector("[data-remove]").disabled = items.length === 1;
    });
    addBtn.disabled = items.length >= LIMITS.processes;
    updateStrips();
  }

  function setRows(list) {
    rowsEl.replaceChildren(...list.map(([a, b]) => createRow(a, b)));
    renumber();
  }

  function updateStrips() {
    const q = intOrNull(quantumEl.value);
    const items = [...rowsEl.children].map((li) => ({
      li, a: intOrNull(field(li, "arrival").value), b: intOrNull(field(li, "burst").value),
    }));
    const valid = (x) => x.a !== null && x.b !== null && x.a >= 0 && x.b > 0;
    const span = Math.max(1, ...items.filter(valid).map((x) => x.a + x.b));

    for (const x of items) {
      const strip = x.li.querySelector(".strip");
      const bar = strip.firstElementChild;
      bar.hidden = !valid(x);
      if (!valid(x)) continue;
      bar.style.left = (x.a / span) * 100 + "%";
      bar.style.width = (x.b / span) * 100 + "%";
      const slicePx = q > 0 ? (q / span) * strip.clientWidth : 0;
      const sliced = q > 0 && q < x.b && slicePx >= 5;
      bar.classList.toggle("sliced", sliced);
      if (sliced) bar.style.setProperty("--slice", (q / x.b) * 100 + "%");
    }
  }

  function readForm() {
    const invalid = [];
    const check = (input, min) => {
      const n = intOrNull(input.value);
      const ok = n !== null && n >= min && n <= LIMITS.max;
      input.setAttribute("aria-invalid", String(!ok));
      if (!ok) invalid.push(input);
      return n;
    };

    const quantum = check(quantumEl, 1);
    const processes = [...rowsEl.children].map((li) => ({
      arrival: check(field(li, "arrival"), 0),
      burst: check(field(li, "burst"), 1),
    }));

    if (invalid.length) {
      formNotice.textContent =
        `Invalid data: arrival - integer from 0 to ${LIMITS.max}, ` +
        `burst and quantum - from 1 to ${LIMITS.max}.`;
      formNotice.hidden = false;
      invalid[0].focus();
      return null;
    }
    formNotice.hidden = true;
    return { quantum, processes };
  }

  async function calculate(payload) {
    let resp;
    try {
      resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error("Can not connect to the API");
    }

    let data = null;
    try { data = await resp.json(); } catch { /* ответ не JSON */ }

    if (!resp.ok) {
      throw new Error((data && data.error) || `Error ${resp.status}.`);
    }
    if (!data || typeof data.svg !== "string" || !data.svg.includes("<svg")) {
      throw new Error("Server's answer is invalid");
    }
    return data;
  }

  let chartUrl = null;
  function showResult(data) {
    const avg = Number(data.avg_waiting);
    avgEl.textContent = Number.isFinite(avg) ? numberFmt.format(avg) : "—";

    waitsEl.replaceChildren();
    const hasWaits = Array.isArray(data.waiting);
    waitsEl.hidden = !hasWaits;
    if (hasWaits) {
      data.waiting.forEach((w, i) => {
        const item = document.createElement("div");
        item.className = "wait";
        item.style.setProperty("--c", COLORS[i % COLORS.length]);
        const dot = Object.assign(document.createElement("span"), { className: "dot" });
        const dt = Object.assign(document.createElement("dt"), { textContent: "P" + (FIRST_ID + i) });
        const dd = Object.assign(document.createElement("dd"), { textContent: numberFmt.format(w) });
        item.append(dot, dt, dd);
        waitsEl.append(item);
      });
    }

    if (chartUrl) URL.revokeObjectURL(chartUrl);
    chartUrl = URL.createObjectURL(new Blob([data.svg], { type: "image/svg+xml;charset=utf-8" }));
    chartEl.src = chartUrl;
    downloadEl.href = chartUrl;
    setState("result");
  }

  function setState(state) { sheet.dataset.state = state; }
    
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;
    const payload = readForm();
    if (!payload) return;

    submitBtn.disabled = true;
    submitBtn.textContent = " Wait…";
    setState("loading");
    scrollToResultOnNarrow();
    try {
      showResult(await calculate(payload));
    } catch (err) {
      errorEl.textContent = err.message;
      setState("error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });

  function scrollToResultOnNarrow() {
    if (!window.matchMedia("(max-width: 880px)").matches) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sheet.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  }

  form.addEventListener("input", (e) => {
    if (e.target.matches("input")) e.target.setAttribute("aria-invalid", "false");
    updateStrips();
  });

  rowsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn || rowsEl.children.length === 1) return;
    const li = btn.closest("li");
    const index = [...rowsEl.children].indexOf(li);
    li.remove();
    renumber();
    const next = rowsEl.children[Math.min(index, rowsEl.children.length - 1)];
    field(next, "arrival").focus();
  });

  addBtn.addEventListener("click", () => {
    if (rowsEl.children.length >= LIMITS.processes) return;
    const li = createRow("", "");
    rowsEl.append(li);
    renumber();
    field(li, "arrival").focus();
  });

  function loadExample() {
    quantumEl.value = EXAMPLE.quantum;
    quantumEl.setAttribute("aria-invalid", "false");
    formNotice.hidden = true;
    setRows(EXAMPLE.processes);
  }
  $("example").addEventListener("click", loadExample);
  $("clear").addEventListener("click", () => {
    formNotice.hidden = true;
    setRows([["", ""]]);
    field(rowsEl.firstElementChild, "arrival").focus();
  });

  new ResizeObserver(updateStrips).observe(rowsEl);

  loadExample();
})();