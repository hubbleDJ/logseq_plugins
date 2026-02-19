// ============================
// logseq-customizer
// ФИНАЛЬНАЯ ВЕРСИЯ: UI чекбоксы в настройках плагина
// ============================

const mainDoc = window.top?.document || window.parent?.document || window.document;

// --- Настройки по умолчанию ---
const defaultSettings = {
  tagsLinks: true,
  favorites: true,
  recent: true,
  pageTitle: true
};

let settings = { ...defaultSettings };

// --- Функция обновления настроек из logseq.settings ---
function updateSettings() {
  // logseq.settings содержит текущие значения, установленные пользователем
  settings = {
    tagsLinks: logseq.settings?.tagsLinks ?? defaultSettings.tagsLinks,
    favorites: logseq.settings?.favorites ?? defaultSettings.favorites,
    recent: logseq.settings?.recent ?? defaultSettings.recent,
    pageTitle: logseq.settings?.pageTitle ?? defaultSettings.pageTitle,
  };
  console.log('[Customizer] settings updated', settings);
}

// --- Скрытие префиксов (логика из исходного плагина) ---
function isExplicitAlias(el) {
  return el.closest('a') && el.closest('a') !== el;
}

function getPrefixLength(fullName) {
  const lastSlashIndex = fullName.lastIndexOf('/');
  return lastSlashIndex === -1 ? 0 : lastSlashIndex + 1;
}

function setElementTextSafe(el, newText) {
  const editable = el.querySelector('[contenteditable="true"]');
  if (editable) {
    if (editable.innerText !== newText) {
      editable.innerText = newText;
    }
    return;
  }
  for (let node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue !== newText) {
        node.nodeValue = newText;
      }
      return;
    }
  }
  el.prepend(new Text(newText));
}

function hidePrefixInElement(el, fullName) {
  if (!fullName) return;
  const prefixLen = getPrefixLength(fullName);
  if (prefixLen === 0) return;
  const prefix = fullName.substring(0, prefixLen);
  let displayText = el.innerText;
  const isTag = el.classList.contains('tag');
  let textToProcess = displayText;
  if (isTag && displayText.startsWith('#')) {
    textToProcess = displayText.substring(1);
  }
  if (textToProcess.toLowerCase().startsWith(prefix.toLowerCase())) {
    let newText = textToProcess.substring(prefixLen);
    if (isTag) {
      newText = '#' + newText;
    }
    if (el.innerText !== newText) {
      setElementTextSafe(el, newText);
    }
  }
  el.setAttribute('data-hide-prefix', 'true');
}

function processSidebar() {
  if (!settings.favorites && !settings.recent) return;
  const sidebar = mainDoc.querySelector('#left-sidebar');
  if (!sidebar) return;
  sidebar.querySelectorAll('.page-title').forEach(el => {
    if (el.hasAttribute('data-hide-prefix')) return;
    let fullName = el.getAttribute('data-ref');
    if (!fullName) {
      const parentWithRef = el.closest('[data-ref]');
      if (parentWithRef) {
        fullName = parentWithRef.getAttribute('data-ref');
      }
    }
    if (fullName) {
      const parent = el.closest('.favorite-item, .recent-item, .nav-content-item');
      if (parent) {
        if (parent.classList.contains('favorite-item') && !settings.favorites) return;
        if (parent.classList.contains('recent-item') && !settings.recent) return;
      }
      hidePrefixInElement(el, fullName);
    }
  });
}

async function processPageTitle() {
  if (!settings.pageTitle) return;
  const currentPage = await logseq.App.getCurrentPage();
  if (!currentPage) return;
  const fullName = currentPage['original-name'] || currentPage.name;
  if (!fullName) return;
  const titleSpan = mainDoc.querySelector('.cp__sidebar-main-content .title[data-ref]');
  if (!titleSpan) return;
  if (titleSpan.hasAttribute('data-hide-prefix')) return;
  if (titleSpan.classList.contains('editing') || titleSpan.hasAttribute('contenteditable')) return;
  hidePrefixInElement(titleSpan, fullName);
}

function processPageRefs() {
  if (!settings.tagsLinks) return;
  mainDoc.querySelectorAll('.page-ref[data-ref], .tag[data-ref]').forEach(el => {
    if (el.hasAttribute('data-hide-prefix')) return;
    const pageName = el.getAttribute('data-ref');
    if (!pageName) return;
    if (isExplicitAlias(el)) return;
    hidePrefixInElement(el, pageName);
  });
  processSidebar();
}

function setupObserver() {
  const observer = new MutationObserver(() => {
    if (observer.timer) clearTimeout(observer.timer);
    observer.timer = setTimeout(() => {
      processPageRefs();
      processPageTitle();
    }, 50);
  });
  observer.observe(mainDoc.body, { childList: true, subtree: true });
}

function setupTimers() {
  setTimeout(() => {
    processPageRefs();
    processPageTitle();
  }, 300);
  for (let i = 1; i <= 7; i++) {
    setTimeout(() => {
      processPageRefs();
      processPageTitle();
    }, i * 700);
  }
}

// --- Главная функция ---
async function main() {
  console.log('[Customizer] Plugin loaded (UI settings)');

  // Регистрируем схему настроек (обязательно до чтения настроек)
  logseq.useSettingsSchema([
    {
      key: "tagsLinks",
      type: "boolean",
      default: true,
      title: "Hide category on tags/links",
      description: "Hide the category prefix (everything before the last slash) on page references and tags."
    },
    {
      key: "favorites",
      type: "boolean",
      default: true,
      title: "Hide category in favorites",
      description: "Hide the category prefix in the left sidebar favorites."
    },
    {
      key: "recent",
      type: "boolean",
      default: true,
      title: "Hide category in recent",
      description: "Hide the category prefix in the left sidebar recent items."
    },
    {
      key: "pageTitle",
      type: "boolean",
      default: true,
      title: "Hide category in page title",
      description: "Hide the category prefix in the current page title."
    }
  ]);

  // Читаем текущие настройки (теперь logseq.settings содержит значения)
  updateSettings();

  // Подписываемся на изменения настроек (когда пользователь меняет чекбоксы)
  logseq.onSettingsChanged(() => {
    updateSettings();
    processPageRefs();
    processPageTitle();
  });

  setupObserver();
  setupTimers();

  logseq.App.onPageLoaded(() => {
    setTimeout(() => {
      processPageRefs();
      processPageTitle();
    }, 200);
    setTimeout(() => {
      processPageRefs();
      processPageTitle();
    }, 600);
  });
}

logseq.ready(main).catch(console.error);
