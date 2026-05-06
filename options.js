const STORAGE_KEY = "blockedDomains";
const PIN_KEY = "privacyPIN";
const DEFAULT_PIN = "1234";

let allDomains = [];
let sortAsc = true;
let filterQuery = "";
let isLocked = true;

const SVG = {
  link: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  pencil: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  save: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  cancel: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

function normalizeDomain(raw) {
  return raw.trim().toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/.*$/, "");
}

function toast(msg, type = "green") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = (type === "green" ? "✓  " : "✕  ") + msg;
  el.className = `show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ""; }, 2500);
}

function localize() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.innerHTML = msg;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.placeholder = msg;
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.title = msg;
  });
}

function askConfirm(msg, confirmLabel = "Confirmar", showJustAdd = false) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modalOverlay");
    const confirmBtn = document.getElementById("modalConfirm");
    const cancelBtn = document.getElementById("modalCancel");
    const justAddBtn = document.getElementById("modalJustAdd");
    const inputCont = document.getElementById("modalInputContainer");

    document.getElementById("modalTitle").textContent = chrome.i18n.getMessage("confirmBtn");
    document.getElementById("modalMessage").textContent = msg;
    confirmBtn.textContent = confirmLabel;
    inputCont.style.display = "none";
    justAddBtn.style.display = showJustAdd ? "block" : "none";

    overlay.classList.add("show");

    const onConfirm = () => { cleanup(); resolve(true); };
    const onJustAdd = () => { cleanup(); resolve("justAdd"); };
    const onCancel = () => { cleanup(); resolve(false); };

    function cleanup() {
      overlay.classList.remove("show");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      justAddBtn.removeEventListener("click", onJustAdd);
    }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    justAddBtn.addEventListener("click", onJustAdd);
  });
}

function askAlert(msg, title = "Atenção") {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modalOverlay");
    const confirmBtn = document.getElementById("modalConfirm");
    const cancelBtn = document.getElementById("modalCancel");
    const justAddBtn = document.getElementById("modalJustAdd");
    const inputCont = document.getElementById("modalInputContainer");

    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalMessage").textContent = msg;
    confirmBtn.textContent = "OK";
    
    inputCont.style.display = "none";
    justAddBtn.style.display = "none";
    cancelBtn.style.display = "none";

    overlay.classList.add("show");

    const onConfirm = () => {
      overlay.classList.remove("show");
      cancelBtn.style.display = "block";
      confirmBtn.removeEventListener("click", onConfirm);
      resolve();
    };
    confirmBtn.addEventListener("click", onConfirm);
  });
}

function askPIN(msg) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modalOverlay");
    const confirmBtn = document.getElementById("modalConfirm");
    const cancelBtn = document.getElementById("modalCancel");
    const justAddBtn = document.getElementById("modalJustAdd");
    const inputCont = document.getElementById("modalInputContainer");
    const input = document.getElementById("modalInput");

    document.getElementById("modalTitle").textContent = chrome.i18n.getMessage("privacyTitle");
    document.getElementById("modalMessage").textContent = msg;
    confirmBtn.textContent = "Desbloquear";
    inputCont.style.display = "block";
    justAddBtn.style.display = "none";
    input.value = "";
    overlay.classList.add("show");
    setTimeout(() => input.focus(), 50);

    const onConfirm = () => {
      const val = input.value;
      cleanup();
      resolve(val);
    };
    const onCancel = () => { cleanup(); resolve(null); };
    const onKey = (e) => { 
      if (e.key === "Enter") onConfirm(); 
      if (e.key === "Escape") onCancel(); 
    };

    function cleanup() {
      overlay.classList.remove("show");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      input.removeEventListener("keydown", onKey);
    }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    input.addEventListener("keydown", onKey);
  });
}

function applyLockState() {
  const ul = document.getElementById("domainList");
  const btn = document.getElementById("lockBtn");
  if (!ul || !btn) return;

  if (isLocked) {
    ul.classList.add("is-locked");
    btn.classList.add("active");
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  } else {
    ul.classList.remove("is-locked");
    btn.classList.remove("active");
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><path d="M10 11v-4a2 2 0 1 1 4 0v4"/></svg>`;
  }
}

function updateStats(domains, filtered) {
  const countEl = document.getElementById("statCount");
  const filteredEl = document.getElementById("statFiltered");
  if (countEl) countEl.textContent = domains.length;
  if (filteredEl) filteredEl.textContent = filtered;
}

function getFiltered() {
  let list = [...allDomains];
  if (!sortAsc) list.reverse();
  if (filterQuery) list = list.filter(d => d.toLowerCase().includes(filterQuery.toLowerCase()));
  return list;
}

function render() {
  const filtered = getFiltered();
  updateStats(allDomains, filtered.length);
  const ul = document.getElementById("domainList");
  if (!ul) return;
  ul.innerHTML = "";

  if (filtered.length === 0) {
    ul.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="color:#1e2038">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <p data-i18n="emptyListMsg">${filterQuery ? `Nenhum resultado para "${filterQuery}"` : "Nenhuma keyword bloqueada ainda.<br/>Adicione uma acima."}</p>
      </div>`;
    localize();
    return;
  }

  filtered.forEach((domain) => {
    const li = document.createElement("li");
    li.dataset.domain = domain;
    li.innerHTML = `
      <div class="li-icon">${SVG.link}</div>
      <div class="li-text">
        ${domain}
        <small>Bloqueia qualquer URL contendo esta keyword</small>
      </div>
      <div class="li-actions">
        <button class="icon-btn edit" data-action="edit" title="Editar">${SVG.pencil}</button>
        <button class="icon-btn del"  data-action="del"  title="Remover">${SVG.trash}</button>
      </div>`;
    ul.appendChild(li);
  });
}

async function addDomain() {
  const input = document.getElementById("newDomainInput");
  if (!input) return;
  const domain = normalizeDomain(input.value);
  if (!domain) return;
  if (allDomains.includes(domain)) { 
    toast(chrome.i18n.getMessage("alreadyInList", [domain]), "red"); 
    input.value = ""; 
    return; 
  }

  const result = await askConfirm(chrome.i18n.getMessage("purgeConfirmMsg", [domain]), chrome.i18n.getMessage("purgeConfirmBtn"), true);
  if (result === false) return;

  const purge = result === true;
  allDomains = [...allDomains, domain].sort();
  chrome.storage.sync.set({ [STORAGE_KEY]: allDomains }, async () => {
    input.value = "";
    render();
    let deleted = 0;
    if (purge) {
      deleted = await new Promise((resolve) => {
        chrome.history.search({ text: domain, startTime: 0, maxResults: 1000000 }, async (items) => {
          const matching = items.filter(item => item.url && item.url.toLowerCase().includes(domain.toLowerCase()));
          for (const item of matching) {
            await new Promise(r => chrome.history.deleteUrl({ url: item.url }, r));
          }
          resolve(matching.length);
        });
      });
    }
    toast(chrome.i18n.getMessage("successAdded", [domain]) + (deleted > 0 ? ` — ${deleted} entries deleted` : ""));
  });
}

function startEdit(li) {
  const domain = li.dataset.domain;
  li.classList.add("editing");
  const textDiv = li.querySelector(".li-text");
  textDiv.innerHTML = `<input class="li-edit-input" type="text" value="${domain}" />`;
  const input = textDiv.querySelector("input");
  input.focus();
  input.select();

  const actionsDiv = li.querySelector(".li-actions");
  actionsDiv.innerHTML = `
    <button class="icon-btn save"   data-action="save"   title="Salvar">${SVG.save}</button>
    <button class="icon-btn cancel" data-action="cancel" title="Cancelar">${SVG.cancel}</button>`;

  function doSave() {
    const newVal = normalizeDomain(input.value);
    if (!newVal || newVal === domain) { cancelEdit(); return; }
    if (allDomains.includes(newVal)) { toast(chrome.i18n.getMessage("alreadyInList", [newVal]), "red"); return; }
    allDomains = allDomains.map(d => d === domain ? newVal : d).sort();
    chrome.storage.sync.set({ [STORAGE_KEY]: allDomains }, () => { 
      toast(chrome.i18n.getMessage("successAdded", [newVal])); 
      render(); 
    });
  }

  function cancelEdit() { li.classList.remove("editing"); render(); }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSave();
    if (e.key === "Escape") cancelEdit();
  });

  actionsDiv.querySelector("[data-action=save]").addEventListener("click", doSave);
  actionsDiv.querySelector("[data-action=cancel]").addEventListener("click", cancelEdit);
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get({ [STORAGE_KEY]: [], [PIN_KEY]: DEFAULT_PIN }, (data) => {
    allDomains = data[STORAGE_KEY] || [];
    isLocked = true;
    applyLockState();
    render();
    localize();
  });

  document.getElementById("addBtn")?.addEventListener("click", addDomain);
  document.getElementById("newDomainInput")?.addEventListener("keydown", e => { 
    if (e.key === "Enter") addDomain(); 
  });

  document.getElementById("searchInput")?.addEventListener("input", (e) => {
    filterQuery = e.target.value.trim().toLowerCase();
    render();
  });

  document.getElementById("sortBtn")?.addEventListener("click", () => {
    sortAsc = !sortAsc;
    const btn = document.getElementById("sortBtn");
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
      ${sortAsc ? "A→Z" : "Z→A"}`;
    render();
  });

  document.getElementById("domainList")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const li = btn.closest("li");
    const domain = li?.dataset.domain;
    if (btn.dataset.action === "edit") {
      startEdit(li);
    } else if (btn.dataset.action === "del") {
      allDomains = allDomains.filter(d => d !== domain);
      chrome.storage.sync.set({ [STORAGE_KEY]: allDomains }, () => {
        toast(chrome.i18n.getMessage("removedToast", [domain]), "red");
        render();
      });
    }
  });

  document.getElementById("lockBtn")?.addEventListener("click", async () => {
    if (!isLocked) {
      isLocked = true;
      applyLockState();
      return;
    }
    const data = await new Promise(r => chrome.storage.sync.get({ [PIN_KEY]: DEFAULT_PIN }, r));
    const pin = data[PIN_KEY];
    const input = await askPIN(chrome.i18n.getMessage("enterPinMsg"));
    if (input === pin) {
      isLocked = false;
      applyLockState();
    } else if (input !== null) {
      await askAlert(chrome.i18n.getMessage("incorrectPin"), chrome.i18n.getMessage("privacyTitle"));
    }
  });

  document.getElementById("savePinBtn")?.addEventListener("click", () => {
    const current = document.getElementById("currentPinInput").value;
    const next = document.getElementById("newPinInput").value;
    const confirm = document.getElementById("confirmPinInput").value;

    chrome.storage.sync.get({ [PIN_KEY]: DEFAULT_PIN }, (data) => {
      if (current !== data[PIN_KEY]) { toast("PIN atual incorreto", "red"); return; }
      if (!next) { toast("Digite um novo PIN", "red"); return; }
      if (next !== confirm) { toast("Os PINs não coincidem", "red"); return; }

      chrome.storage.sync.set({ [PIN_KEY]: next }, () => {
        toast("PIN alterado com sucesso!");
        document.getElementById("currentPinInput").value = "";
        document.getElementById("newPinInput").value = "";
        document.getElementById("confirmPinInput").value = "";
        isLocked = true;
        applyLockState();
      });
    });
  });

  document.getElementById("removePinBtn")?.addEventListener("click", () => {
    const current = document.getElementById("currentPinInput").value;
    chrome.storage.sync.get({ [PIN_KEY]: DEFAULT_PIN }, async (data) => {
      if (current !== data[PIN_KEY]) { toast("Informe o PIN atual para remover", "red"); return; }
      const ok = await askConfirm("Remover o PIN de privacidade? A lista ficará exposta para qualquer pessoa.", "Remover PIN");
      if (!ok) return;

      chrome.storage.sync.set({ [PIN_KEY]: DEFAULT_PIN }, () => {
        toast("PIN resetado para o padrão", "red");
        document.getElementById("currentPinInput").value = "";
        isLocked = false;
        applyLockState();
      });
    });
  });

  document.getElementById("purgeBtn")?.addEventListener("click", async () => {
    if (allDomains.length === 0) { toast("Nenhuma keyword na lista", "red"); return; }
    const ok = await askConfirm(`Varrer TODO o histórico e apagar URLs que contenham ${allDomains.length} keyword(s)?`, "Varrer agora");
    if (!ok) return;

    const btn = document.getElementById("purgeBtn");
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `Varrer...`;

    let totalDeleted = 0;
    for (const keyword of allDomains) {
      const items = await new Promise(r => chrome.history.search({ text: keyword, startTime: 0, maxResults: 1000000 }, r));
      const matching = items.filter(item => item.url && item.url.toLowerCase().includes(keyword.toLowerCase()));
      for (const item of matching) {
        await new Promise(r => chrome.history.deleteUrl({ url: item.url }, r));
        totalDeleted++;
      }
    }
    btn.disabled = false;
    btn.innerHTML = originalHTML;
    toast(`${totalDeleted} entrada(s) apagadas do histórico`);
  });

  document.getElementById("clearAllBtn")?.addEventListener("click", async () => {
    const ok = await askConfirm(`Remover todas as ${allDomains.length} keywords?`, "Limpar lista");
    if (!ok) return;
    allDomains = [];
    chrome.storage.sync.set({ [STORAGE_KEY]: [] }, () => { 
      toast("Todas as keywords removidas", "red"); 
      render(); 
    });
  });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY]) {
    allDomains = changes[STORAGE_KEY].newValue || [];
    render();
  }
});
