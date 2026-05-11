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
 * @param {string} url
 * @param {string[]} blockedDomains
 * @returns {boolean}
 */
function isUrlBlocked(url, blockedDomains) {
  const lower = url.toLowerCase();
  return blockedDomains.some((keyword) => lower.includes(keyword.toLowerCase()));
}

/**
 * Retorna a primeira keyword bloqueada que corresponde à URL, ou null.
 * @param {string} url
 * @param {string[]} blockedDomains
 * @returns {string|null}
 */
function getMatchedKeyword(url, blockedDomains) {
  const lower = url.toLowerCase();
  return blockedDomains.find((kw) => lower.includes(kw.toLowerCase())) ?? null;
}

/**
 * Apaga uma entrada específica do histórico.
 * @param {string} url
 * @returns {Promise<void>}
 */
async function deleteHistoryEntry(url) {
  return new Promise((resolve) => {
    chrome.history.deleteUrl({ url }, resolve);
  });
}

/**
 * Busca e apaga TODAS as entradas do histórico que contenham a keyword.
 * Isso garante que Top Sites e autocomplete baseado em histórico sejam limpos,
 * não apenas a visita atual.
 * @param {string} keyword
 * @returns {Promise<void>}
 */
async function deleteAllMatchingHistory(keyword) {
  return new Promise((resolve) => {
    chrome.history.search(
      { text: keyword, startTime: 0, maxResults: 1000000 },
      async (items) => {
        const lower = keyword.toLowerCase();
        const matching = items.filter(
          (item) => item.url && item.url.toLowerCase().includes(lower)
        );
        await Promise.all(matching.map((item) => deleteHistoryEntry(item.url)));
        resolve();
      }
    );
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
 * Se a URL bater com alguma keyword bloqueada, deleta TODAS as entradas
 * do histórico com aquela keyword (não só a URL atual).
 * Isso garante que Top Sites e autocomplete baseado em histórico sejam limpos.
 * Nota: o Shortcuts DB do Chrome (sugestões da barra) é separado e só pode
 * ser limpo via browsingData — use o botão "Limpar sugestões" nas opções.
 * @param {chrome.history.HistoryItem} historyItem
 */
async function handleHistoryVisit(historyItem) {
  const { url } = historyItem;
  if (!url) return;

  const blockedDomains = await loadBlockedDomains();
  const matchedKeyword = getMatchedKeyword(url, blockedDomains);
  if (!matchedKeyword) return;

  await deleteAllMatchingHistory(matchedKeyword);
}

chrome.history.onVisited.addListener(handleHistoryVisit);
