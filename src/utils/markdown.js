/**
 * 轻量 Markdown 渲染器：只支持模型常用的安全子集。
 * 先转义 HTML，再生成受控标签，避免 v-html 注入。
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(value) {
  let text = escapeHtml(value)
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  return text
}

function isTableSeparator(line) {
  return /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('-')
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

export function renderMarkdown(source) {
  if (!source) return ''
  const lines = String(source).replace(/\r\n/g, '\n').split('\n')
  const html = []
  let listType = ''
  let paragraph = []
  let inCode = false
  let codeLines = []

  function flushParagraph() {
    if (!paragraph.length) return
    html.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`)
    paragraph = []
  }

  function closeList() {
    if (!listType) return
    html.push(`</${listType}>`)
    listType = ''
  }

  function openList(type) {
    if (listType === type) return
    closeList()
    listType = type
    html.push(`<${type}>`)
  }

  function flushBlocks() {
    flushParagraph()
    closeList()
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (/^```/.test(line.trim())) {
      if (inCode) {
        html.push(
          `<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`,
        )
        codeLines = []
        inCode = false
      } else {
        flushBlocks()
        inCode = true
      }
      continue
    }

    if (inCode) {
      codeLines.push(line)
      continue
    }

    if (!line.trim()) {
      flushBlocks()
      continue
    }

    const header = /^(#{1,4})\s+(.*)$/.exec(line)
    if (header) {
      flushBlocks()
      const level = Math.min(header[1].length + 2, 6)
      html.push(`<h${level}>${renderInline(header[2])}</h${level}>`)
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      flushBlocks()
      html.push(
        `<blockquote>${renderInline(line.replace(/^\s*>\s?/, ''))}</blockquote>`,
      )
      continue
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushBlocks()
      html.push('<hr>')
      continue
    }

    if (line.includes('|') && isTableSeparator(lines[index + 1] || '')) {
      flushBlocks()
      const columns = splitRow(line)
      const rows = []
      index += 2
      while (index < lines.length && lines[index].includes('|')) {
        rows.push(splitRow(lines[index]))
        index += 1
      }
      index -= 1
      html.push('<div class="md-table-wrap"><table><thead><tr>')
      html.push(
        columns.map((cell) => `<th>${renderInline(cell)}</th>`).join(''),
      )
      html.push('</tr></thead><tbody>')
      for (const row of rows) {
        html.push(
          `<tr>${columns
            .map((_, cellIndex) => `<td>${renderInline(row[cellIndex] || '')}</td>`)
            .join('')}</tr>`,
        )
      }
      html.push('</tbody></table></div>')
      continue
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    if (bullet) {
      openList('ul')
      html.push(`<li>${renderInline(bullet[1])}</li>`)
      continue
    }

    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (ordered) {
      openList('ol')
      html.push(`<li>${renderInline(ordered[1])}</li>`)
      continue
    }

    closeList()
    paragraph.push(line)
  }

  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
  }
  flushBlocks()
  return html.join('')
}
