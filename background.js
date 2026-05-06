/**
 * @module background
 * @description Service worker da extensão No History.
 * Escuta chrome.history.onVisited e apaga imediatamente
 * qualquer URL cujo domínio esteja na lista bloqueada.
 */

/** @type {string} Chave usada no chrome.storage.sync */
const STORAGE_KEY = "blockedDomains";

/**
 * Extrai o hostname de uma URL.
 * Retorna null se a URL for inválida.
 * @param {string} url
 * @returns {string|null}
 */
function extractHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Verifica se a URL contém alguma keyword bloqueada (substring, case-insensitive).
 * Pega pesquisas Google também: "example" bloqueia google.com/search?q=example
 * @param {string} url
 * @param {string[]} blockedDomains
 * @returns {boolean}
 */
function isUrlBlocked(url, blockedDomains) {
  const lower = url.toLowerCase();
  return blockedDomains.some((keyword) => lower.includes(keyword.toLowerCase()));
}

/**
 * Apaga todas as entradas de histórico de uma URL específica.
 * @param {string} url
 * @returns {Promise<void>}
 */
async function deleteHistoryEntry(url) {
  return new Promise((resolve) => {
    chrome.history.deleteUrl({ url }, resolve);
  });
}

/**
 * Carrega a lista de domínios bloqueados do storage.
 * @returns {Promise<string[]>}
 */
async function loadBlockedDomains() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEY]: [] }, (result) => {
      resolve(result[STORAGE_KEY]);
    });
  });
}

/**
 * Handler principal: disparado toda vez que o browser visita uma URL.
 * Se o domínio estiver na lista, apaga imediatamente.
 * @param {chrome.history.HistoryItem} historyItem
 */
async function handleHistoryVisit(historyItem) {
  const { url } = historyItem;
  if (!url) return;

  const blockedDomains = await loadBlockedDomains();
  if (isUrlBlocked(url, blockedDomains)) {
    await deleteHistoryEntry(url);
  }
}

chrome.history.onVisited.addListener(handleHistoryVisit);
