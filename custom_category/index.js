// ============================
// logseq-customizer
// Версия: конфиг в графе (страница logseq-customizer), UI через чекбоксы
// ============================

const mainDoc = window.top?.document || window.parent?.document || window.document;

// Дефолтные настройки (используются при создании страницы)
const defaultSettings = {
  tagsLinks: true,
  favorites: true,
  recent: true,
  pageTitle: true
};

let settings = { ...defaultSettings }; // текущие активные настройки (из графа)

// --- Работа с графом: чтение/запись конфига на страницу logseq-customizer ---
async function readConfigFromGraph() {
  try {
    const blocks = await logseq.DB.datascriptQuery(`
      [:find (pull ?b [:block/uuid :block/content])
       :where
       [?b :block/page ?p]
       [?p :block/name "logseq-customizer"]]
    `);
    if (blocks && blocks.length > 0) {
      const content = blocks[0][0].content;
      // Ожидаем, что конфиг записан как JSON в тройных кавычках
      const jsonStr = content.replace(/^```json\s*|\s*```$/g, '');
      const parsed = JSON.parse(jsonStr);
      settings = { ...defaultSettings, ...parsed };
    } else {
      // Если страницы нет, создаём с дефолтными настройками
      await writeConfigToGraph(defaultSettings);
      settings = { ...defaultSettings };
    }
  } catch (e) {
    console.error('[Customizer] Error reading config from graph', e);
    settings = { ...defaultSettings };
  }
  // После обновления settings синхронизируем с UI (logseq.settings)
  await logseq.updateSettings(settings);
  console.log('[Customizer] settings synced to UI', settings);
}

async function writeConfigToGraph(newConfig) {
  try {
    const blocks = await logseq.DB.datascriptQuery(`
      [:find (pull ?b [:block/uuid])
       :where
       [?b :block/page ?p]
       [?p :block/name "logseq-customizer"]]
    `);
    const content = '```json\n' + JSON.stringify(newConfig, null, 2) + '\n```';
    if (blocks && blocks.length > 0) {
      // Обновляем первый блок на странице
      await logseq.Editor.updateBlock(blocks[0][0].uuid, content);
    } else {
      // Создаём страницу и добавляем блок
      const page = await logseq.Editor.createPage('logseq-customizer');
      await logseq.Editor.appendBlockInPage(page.uuid, content);
    }
    console.log('[Customizer] config written to graph', newConfig);
  } catch (e) {
    console.error('[Customizer] Error writing config to graph', e);
  }
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
  console.log('[Customizer] Plugin loaded (graph-stored config)');

  // 1. Регистрируем схему настроек для UI (чекбоксы)
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

  // 2. Читаем конфиг из графа и синхронизируем с UI
  await readConfigFromGraph();

  // 3. Подписываемся на изменения настроек (пользователь меняет чекбоксы)
  logseq.onSettingsChanged(async (newSettings) => {
    // Обновляем локальные settings
    settings = {
      tagsLinks: newSettings?.tagsLinks ?? defaultSettings.tagsLinks,
      favorites: newSettings?.favorites ?? defaultSettings.favorites,
      recent: newSettings?.recent ?? defaultSettings.recent,
      pageTitle: newSettings?.pageTitle ?? defaultSettings.pageTitle,
    };
    console.log('[Customizer] settings changed via UI', settings);
    // Сохраняем в граф
    await writeConfigToGraph(settings);
    // Применяем изменения к текущим страницам
    processPageRefs();
    processPageTitle();
  });

  // 4. Подписываемся на смену графа
  logseq.App.onCurrentGraphChanged(async () => {
    console.log('[Customizer] graph changed, reloading config');
    await readConfigFromGraph();
    // Применяем новые настройки
    processPageRefs();
    processPageTitle();
  });

  // 5. Запускаем наблюдатели
  setupObserver();
  setupTimers();

  // 6. При загрузке страницы тоже применяем настройки
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

  // 7. Добавляем команду для принудительной перезагрузки конфига из графа (полезно, если редактировали вручную)
  logseq.App.registerCommandPalette({
    key: 'customizer-reload-config',
    label: 'Reload customizer config from graph'
  }, async () => {
    await readConfigFromGraph();
    processPageRefs();
    processPageTitle();
    console.log('[Customizer] config reloaded from graph');
  });
}

logseq.ready(main).catch(console.error);
