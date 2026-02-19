// ============================
// logseq-hide-all-prefixes
// Скрывает всё до последнего слеша включительно (оставляет только последний сегмент).
// Левая панель обрабатывается, явные алиасы игнорируются.
// Также скрывает префикс в заголовке текущей страницы (работает с внутренним span.title).
// ============================

const mainDoc = window.top?.document || window.parent?.document || window.document

function isExplicitAlias(el) {
  return el.closest('a') && el.closest('a') !== el
}

/**
 * Длина префикса до последнего слеша включительно.
 */
function getPrefixLength(fullName) {
  const lastSlashIndex = fullName.lastIndexOf('/')
  return lastSlashIndex === -1 ? 0 : lastSlashIndex + 1
}

/**
 * Безопасно заменяет текст в элементе, сохраняя все дочерние узлы.
 * Если внутри есть contenteditable-элемент, меняет текст в нём.
 * Иначе ищет первый текстовый узел.
 */
function setElementTextSafe(el, newText) {
  // Ищем редактируемый дочерний элемент (contenteditable)
  const editable = el.querySelector('[contenteditable="true"]')
  if (editable) {
    if (editable.innerText !== newText) {
      console.log(`[hide-prefix] Меняем текст в contenteditable: "${editable.innerText}" → "${newText}"`)
      editable.innerText = newText
    }
    return
  }

  // Если нет contenteditable, ищем первый текстовый узел
  for (let node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue !== newText) {
        node.nodeValue = newText
      }
      return
    }
  }
  // Если текстовых узлов нет, добавляем новый в начало (крайний случай)
  el.prepend(new Text(newText))
}

/**
 * Обрабатывает элемент: если его видимый текст начинается с префикса (из fullName),
 * удаляет этот префикс.
 */
function hidePrefixInElement(el, fullName) {
  if (!fullName) return

  const prefixLen = getPrefixLength(fullName)
  if (prefixLen === 0) return

  const prefix = fullName.substring(0, prefixLen) // включая последний '/'

  let displayText = el.innerText
  const isTag = el.classList.contains('tag')
  let textToProcess = displayText

  // Убираем '#' для тегов
  if (isTag && displayText.startsWith('#')) {
    textToProcess = displayText.substring(1)
  }

  // 🔥 КЛЮЧЕВАЯ ПРОВЕРКА: текст действительно начинается с префикса?
  if (textToProcess.toLowerCase().startsWith(prefix.toLowerCase())) {
    let newText = textToProcess.substring(prefixLen)

    // Для тегов возвращаем '#'
    if (isTag) {
      newText = '#' + newText
    }

    if (el.innerText !== newText) {
      console.log(`[hide-prefix] Меняем: "${el.innerText}" → "${newText}"`)
      setElementTextSafe(el, newText)
    }
  }

  el.setAttribute('data-hide-prefix', 'true')
}

// --- Левая боковая панель ---
function processSidebar() {
  const sidebar = mainDoc.querySelector('#left-sidebar')
  if (!sidebar) return

  sidebar.querySelectorAll('.page-title').forEach(el => {
    if (el.hasAttribute('data-hide-prefix')) return

    // Получаем полное имя страницы (data-ref)
    let fullName = el.getAttribute('data-ref')
    if (!fullName) {
      const parentWithRef = el.closest('[data-ref]')
      if (parentWithRef) {
        fullName = parentWithRef.getAttribute('data-ref')
      }
    }

    if (fullName) {
      hidePrefixInElement(el, fullName)
    }
  })
}

// --- Заголовок текущей страницы (в правой части) ---
async function processPageTitle() {
  // Получаем информацию о текущей странице
  const currentPage = await logseq.App.getCurrentPage()
  if (!currentPage) return

  // Берём оригинальное имя (содержит слеши) или обычное имя
  const fullName = currentPage['original-name'] || currentPage.name
  if (!fullName) return

  // Ищем внутренний span с классом title и атрибутом data-ref внутри основного контента
  const titleSpan = mainDoc.querySelector('.cp__sidebar-main-content .title[data-ref]')
  if (!titleSpan) {
    console.log('[hide-prefix] Заголовочный span не найден')
    return
  }
  if (titleSpan.hasAttribute('data-hide-prefix')) return

  // Не обрабатываем, если элемент в режиме редактирования
  if (titleSpan.classList.contains('editing') || titleSpan.hasAttribute('contenteditable')) {
    console.log('[hide-prefix] Заголовок в режиме редактирования, пропускаем')
    return
  }

  // Используем data-ref из самого спана (он должен совпадать с fullName)
  const refName = titleSpan.getAttribute('data-ref')
  if (refName && refName === fullName) {
    hidePrefixInElement(titleSpan, fullName)
  } else {
    // На всякий случай, если data-ref не совпадает, пробуем с fullName
    hidePrefixInElement(titleSpan, fullName)
  }
}

// --- Основные .page-ref и .tag ---
function processPageRefs() {
  mainDoc.querySelectorAll('.page-ref[data-ref], .tag[data-ref]').forEach(el => {
    if (el.hasAttribute('data-hide-prefix')) return

    const pageName = el.getAttribute('data-ref')
    if (!pageName) return
    if (isExplicitAlias(el)) return

    hidePrefixInElement(el, pageName)
  })

  // Обязательно обрабатываем левую панель
  processSidebar()
}

// --- Наблюдатель ---
function setupObserver() {
  const observer = new MutationObserver(() => {
    if (observer.timer) clearTimeout(observer.timer)
    observer.timer = setTimeout(() => {
      processPageRefs()
      processPageTitle()
    }, 50)
  })
  observer.observe(mainDoc.body, { childList: true, subtree: true })
}

// --- Таймеры ---
function setupTimers() {
  setTimeout(() => {
    processPageRefs()
    processPageTitle()
  }, 300)
  for (let i = 1; i <= 7; i++) {
    setTimeout(() => {
      processPageRefs()
      processPageTitle()
    }, i * 700)
  }
}

// --- Инициализация ---
async function main() {
  console.log('[hide-prefix] Плагин загружен (режим: оставлять только последний сегмент)')
  setupObserver()
  setupTimers()

  logseq.App.onPageLoaded(() => {
    setTimeout(() => {
      processPageRefs()
      processPageTitle()
    }, 200)
    setTimeout(() => {
      processPageRefs()
      processPageTitle()
    }, 600)
  })
}

logseq.ready(main).catch(console.error)
