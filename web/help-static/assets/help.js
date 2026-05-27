const content = window.AIAPI114_HELP_CONTENT
const navEl = document.querySelector('#help-nav')
const articleEl = document.querySelector('#help-article')
const outlineEl = document.querySelector('#help-outline')
const searchEl = document.querySelector('#help-search')
const prevEl = document.querySelector('#help-prev')
const nextEl = document.querySelector('#help-next')
const menuButton = document.querySelector('[data-menu-button]')
const overlay = document.querySelector('[data-overlay]')

const articleBySlug = new Map(content.articles.map((article) => [article.slug, article]))
let visibleSlugs = content.articles.map((article) => article.slug)

function renderNav(filter = '') {
  const query = filter.trim().toLowerCase()
  const matched = content.articles.filter((article) => {
    const haystack = [article.title, article.summary, article.markdown].join('\n').toLowerCase()
    return !query || haystack.includes(query)
  })
  visibleSlugs = matched.map((article) => article.slug)

  navEl.innerHTML = content.categories
    .map((category) => {
      const articles = matched.filter((article) => article.category === category.key)
      if (articles.length === 0) return ''
      return `
        <section class="help-nav__group">
          <h2 class="help-nav__group-title">${escapeHtml(category.title)}</h2>
          ${articles
            .map(
              (article) => `
                <a class="help-nav__link" href="#${article.slug}" data-slug="${article.slug}">
                  ${escapeHtml(article.title)}
                </a>
              `,
            )
            .join('')}
        </section>
      `
    })
    .join('')

  setActiveNav(getCurrentSlug())
}

function renderArticle(slug) {
  const article = articleBySlug.get(slug) ?? content.articles[0]
  if (!article) return

  const body = markdownToHtml(article.markdown)
  articleEl.innerHTML = `
    <header class="help-article__meta">
      <h2>${escapeHtml(article.title)}</h2>
      <p>${escapeHtml(article.summary)}</p>
      <span class="help-article__source">参考资料：${escapeHtml(article.sourcePath)}</span>
    </header>
    <div class="help-doc">${body}</div>
  `

  renderOutline()
  renderPager(article.slug)
  setActiveNav(article.slug)
  closeMenu()
}

function renderOutline() {
  const headings = [...articleEl.querySelectorAll('.help-doc h2, .help-doc h3')]
  outlineEl.innerHTML = headings
    .map((heading, index) => {
      const id = `section-${index}-${slugify(heading.textContent)}`
      heading.id = id
      return `<a href="#${id}" class="level-${heading.tagName.toLowerCase()}">${escapeHtml(heading.textContent)}</a>`
    })
    .join('')
}

function renderPager(slug) {
  const index = content.articles.findIndex((article) => article.slug === slug)
  const prev = content.articles[index - 1]
  const next = content.articles[index + 1]
  prevEl.href = prev ? `#${prev.slug}` : '#'
  prevEl.textContent = prev ? `上一篇：${prev.title}` : ''
  nextEl.href = next ? `#${next.slug}` : '#'
  nextEl.textContent = next ? `下一篇：${next.title}` : ''
}

function setActiveNav(slug) {
  document.querySelectorAll('.help-nav__link').forEach((link) => {
    link.classList.toggle('is-active', link.dataset.slug === slug)
  })
}

function getCurrentSlug() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''))
  if (articleBySlug.has(hash)) return hash
  return visibleSlugs[0] ?? content.articles[0]?.slug
}

function markdownToHtml(markdown) {
  const lines = markdown.split('\n')
  const html = []
  let list = null
  let code = false
  let quote = []
  let table = []

  const closeList = () => {
    if (!list) return
    html.push(`</${list}>`)
    list = null
  }
  const closeQuote = () => {
    if (quote.length === 0) return
    const text = quote.join('\n').trim()
    const className = text.includes('图片待替换') ? ' class="image-placeholder"' : ''
    html.push(`<blockquote${className}>${inlineMarkdown(text)}</blockquote>`)
    quote = []
  }
  const closeTable = () => {
    if (table.length === 0) return
    const rows = table.filter((row) => !/^\|\s*-+/.test(row))
    html.push(
      `<table>${rows
        .map((row, index) => {
          const cells = row
            .replace(/^\||\|$/g, '')
            .split('|')
            .map((cell) => cell.trim())
          const tag = index === 0 ? 'th' : 'td'
          return `<tr>${cells.map((cell) => `<${tag}>${inlineMarkdown(cell)}</${tag}>`).join('')}</tr>`
        })
        .join('')}</table>`,
    )
    table = []
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      closeList()
      closeQuote()
      closeTable()
      if (code) {
        html.push('</code></pre>')
        code = false
      } else {
        html.push('<pre><code>')
        code = true
      }
      continue
    }

    if (code) {
      html.push(escapeHtml(line) + '\n')
      continue
    }

    if (/^\|.+\|$/.test(line.trim())) {
      closeList()
      closeQuote()
      table.push(line.trim())
      continue
    }
    closeTable()

    if (line.startsWith('>')) {
      closeList()
      quote.push(line.replace(/^>\s?/, ''))
      continue
    }
    closeQuote()

    const trimmed = line.trim()
    if (!trimmed) {
      closeList()
      continue
    }

    if (/^(\*\s*){3}$|^(-\s*){3}$/.test(trimmed)) {
      closeList()
      html.push('<hr />')
      continue
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed)
    if (heading) {
      closeList()
      const level = Math.min(heading[1].length, 3)
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed)
    const unordered = /^[-*]\s+(.+)$/.exec(trimmed)
    if (ordered || unordered) {
      const type = ordered ? 'ol' : 'ul'
      if (list !== type) {
        closeList()
        html.push(`<${type}>`)
        list = type
      }
      html.push(`<li>${inlineMarkdown((ordered || unordered)[1])}</li>`)
      continue
    }

    closeList()
    html.push(`<p>${inlineMarkdown(trimmed)}</p>`)
  }

  closeList()
  closeQuote()
  closeTable()
  if (code) html.push('</code></pre>')
  return html.join('\n')
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
}

function openMenu() {
  document.body.classList.add('is-menu-open')
}

function closeMenu() {
  document.body.classList.remove('is-menu-open')
}

window.addEventListener('hashchange', () => renderArticle(getCurrentSlug()))
searchEl.addEventListener('input', () => {
  renderNav(searchEl.value)
  if (!visibleSlugs.includes(getCurrentSlug())) {
    location.hash = visibleSlugs[0] ?? content.articles[0]?.slug
  }
})
menuButton.addEventListener('click', openMenu)
overlay.addEventListener('click', closeMenu)

renderNav()
if (!location.hash) {
  location.hash = content.articles[0]?.slug ?? ''
} else {
  renderArticle(getCurrentSlug())
}
