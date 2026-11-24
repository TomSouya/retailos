const FORMULA_PREFIX = /^[=+\-@\t\r]/

/**
 * CSV 单元格编码：处理引号/换行，并对公式起始字符加单引号，
 * 防止 Excel / WPS 打开导出文件时执行 =HYPERLINK 等公式。
 */
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value)
  if (typeof value === 'string' && FORMULA_PREFIX.test(text)) {
    text = `'${text}`
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: unknown[][]) {
  const body = rows
    .map((row) => row.map((cell) => csvCell(cell)).join(','))
    .join('\r\n')
  return `\uFEFF${body}`
}
