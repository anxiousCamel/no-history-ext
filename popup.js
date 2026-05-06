const STORAGE_KEY = "blockedDomains";
const PIN_KEY = "privacyPIN";
const DEFAULT_PIN = "1234";
let isLocked = true;

function normalizeDomain(raw) {
  return raw.trim().toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/.*$/, "");
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

function updateBadge(count) {
  const el = document.getElementById("badgeCount");
  if (el) el.textContent = count;
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

function purgeKeyword(keyword) {
  return new Promise((resolve) => {
    chrome.history.search({ text: keyword, startTime: 0, maxResults: 1000000 }, async (items) => {
      const matching = items.filter(item => item.url && item.url.toLowerCase().includes(keyword.toLowerCase()));
      for (const item of matching) {
        await new Promise(r => chrome.history.deleteUrl({ url: item.url }, r));
      }
      resolve(matching.length);
    });
  });
}

function applyLockState() {
  const ul = document.getElementById("domainList");
  const btn = document.getElementById("lockBtn");
  const overlay = document.getElementById("lockOverlay");
  if (!ul || !btn || !overlay) return;

  if (isLocked) {
    ul.classList.add("is-locked");
    btn.classList.add("active");
    overlay.classList.add("show");
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  } else {
    ul.classList.remove("is-locked");
    btn.classList.remove("active");
    overlay.classList.remove("show");
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><path d="M10 11v-4a2 2 0 1 1 4 0v4"/></svg>`;
  }
}

function renderDomainList(domains) {
  const list = document.getElementById("domainList");
  if (!list) return;
  list.innerHTML = "";
  updateBadge(domains.length);

  if (domains.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <p data-i18n="emptyListMsg">Nenhum site bloqueado ainda.<br/>Adicione um domínio ou keyword acima.</p>
      </div>`;
    localize();
    return;
  }

  domains.forEach((domain) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="li-left">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span>${domain}</span>
      </div>
      <button class="remove-btn" data-domain="${domain}" title="Remover">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>`;
    list.appendChild(li);
  });
}

function loadAndRender() {
  chrome.storage.sync.get({ [STORAGE_KEY]: [], [PIN_KEY]: DEFAULT_PIN }, (data) => {
    const blockedDomains = data[STORAGE_KEY] || [];
    isLocked = true;
    renderDomainList(blockedDomains);
    applyLockState();
  });
}

async function addDomain() {
  const input = document.getElementById("domainInput");
  const domain = normalizeDomain(input.value);
  if (!domain) return;

  chrome.storage.sync.get({ [STORAGE_KEY]: [] }, async (data) => {
    const blockedDomains = data[STORAGE_KEY] || [];
    if (blockedDomains.includes(domain)) {
      await askAlert(chrome.i18n.getMessage("alreadyInList", [domain]));
      input.value = "";
      return;
    }

    const result = await askConfirm(chrome.i18n.getMessage("purgeConfirmMsg", [domain]), chrome.i18n.getMessage("purgeConfirmBtn"), true);
    if (result === false) return;

    const purge = result === true;
    const updated = [...blockedDomains, domain].sort();
    chrome.storage.sync.set({ [STORAGE_KEY]: updated }, async () => {
      input.value = "";
      renderDomainList(updated);
      if (purge) await purgeKeyword(domain);
    });
  });
}

function removeDomain(domain) {
  chrome.storage.sync.get({ [STORAGE_KEY]: [] }, (data) => {
    const blockedDomains = data[STORAGE_KEY] || [];
    const updated = blockedDomains.filter((d) => d !== domain);
    chrome.storage.sync.set({ [STORAGE_KEY]: updated }, () => renderDomainList(updated));
  });
}

const handleUnlock = () => {
  chrome.storage.sync.get({ [PIN_KEY]: DEFAULT_PIN }, async (data) => {
    const pin = data[PIN_KEY];
    const input = await askPIN(chrome.i18n.getMessage("enterPinMsg"));
    if (input === pin) {
      isLocked = false;
      applyLockState();
    } else if (input !== null) {
      await askAlert(chrome.i18n.getMessage("incorrectPin"), chrome.i18n.getMessage("privacyTitle"));
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  loadAndRender();
  localize();

  document.getElementById("addBtn")?.addEventListener("click", addDomain);
  document.getElementById("domainInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDomain();
  });

  document.getElementById("domainList")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-btn");
    if (btn) removeDomain(btn.dataset.domain);
  });

  document.getElementById("manageBtn")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById("addCurrentBtn")?.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const url = tabs[0]?.url;
      if (!url) return;
      const domain = normalizeDomain(url);
      if (!domain) return;
      const btn = document.getElementById("addCurrentBtn");
      const label = document.getElementById("currentBtnLabel");

      chrome.storage.sync.get({ [STORAGE_KEY]: [] }, async (data) => {
        const blockedDomains = data[STORAGE_KEY] || [];
        if (blockedDomains.includes(domain)) {
          label.textContent = chrome.i18n.getMessage("alreadyInList", [domain]);
          btn.classList.add("success");
          setTimeout(() => { 
            label.textContent = chrome.i18n.getMessage("addCurrentBtnLabel"); 
            btn.classList.remove("success"); 
          }, 2000);
          return;
        }
        const result = await askConfirm(chrome.i18n.getMessage("purgeConfirmMsg", [domain]), chrome.i18n.getMessage("purgeConfirmBtn"), true);
        if (result === false) return;

        const purge = result === true;
        const updated = [...blockedDomains, domain].sort();
        chrome.storage.sync.set({ [STORAGE_KEY]: updated }, async () => {
          renderDomainList(updated);
          if (purge) await purgeKeyword(domain);
          btn.classList.add("success");
          btn.querySelector("svg").innerHTML = `<polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
          label.textContent = chrome.i18n.getMessage("successAdded", [domain]);
          setTimeout(() => {
            btn.classList.remove("success");
            btn.querySelector("svg").innerHTML = `
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`;
            label.textContent = chrome.i18n.getMessage("addCurrentBtnLabel");
          }, 2500);
        });
      });
    });
  });

  document.getElementById("lockBtn")?.addEventListener("click", () => {
    if (!isLocked) {
      isLocked = true;
      applyLockState();
      return;
    }
    handleUnlock();
  });

  document.getElementById("unlockBtnMain")?.addEventListener("click", handleUnlock);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY]) renderDomainList(changes[STORAGE_KEY].newValue || []);
});
