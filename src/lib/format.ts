export function pagesPhrase(count: number): string {
  if (count === 1) return 'صفحة واحدة'
  if (count === 2) return 'صفحتان'
  if (count >= 3 && count <= 10) return `${count} صفحات`
  return `${count} صفحة`
}

export function relatedPagesPhrase(count: number): string {
  if (count === 1) return 'صفحة واحدة ذات صلة'
  if (count === 2) return 'صفحتان ذات صلة'
  if (count >= 3 && count <= 10) return `${count} صفحات ذات صلة`
  return `${count} صفحة ذات صلة`
}

export function extractsPhrase(count: number): string {
  if (count === 1) return 'مقتطفًا واحدًا'
  if (count === 2) return 'مقتطفين'
  if (count >= 3 && count <= 10) return `${count} مقتطفات`
  return `${count} مقتطفًا`
}
