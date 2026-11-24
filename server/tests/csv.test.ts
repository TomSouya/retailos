import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from '../src/exports/csv'

describe('CSV 导出编码', () => {
  it('公式起始字符加单引号，防止 CSV 注入', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(
      `"'=HYPERLINK(""http://evil"")"`,
    )
    expect(csvCell('+1+1')).toBe("'+1+1")
    expect(csvCell('-2+3')).toBe("'-2+3")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('数字与普通文本不前缀单引号', () => {
    expect(csvCell(-12.5)).toBe('-12.5')
    expect(csvCell('张三')).toBe('张三')
    expect(csvCell(null)).toBe('')
  })

  it('引号、逗号与换行按 CSV 规则转义', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('a"b')).toBe('"a""b"')
    expect(csvCell('a\nb')).toBe('"a\nb"')
  })

  it('toCsv 带 BOM 且按 CRLF 分行', () => {
    const result = toCsv([
      ['姓名', '手机号'],
      ['张三', '13800138000'],
    ])
    expect(result.startsWith('\uFEFF')).toBe(true)
    expect(result).toContain('\r\n')
  })
})
