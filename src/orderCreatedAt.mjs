const beijingDateTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  dateStyle: 'short',
  timeStyle: 'medium',
})

export function formatOrderCreatedAt(value) {
  if (typeof value !== 'string') return '—'

  const timestamp = value.trim().replace(' ', 'T')
  // SQLite writes UTC timestamps without a time-zone suffix.
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(timestamp)
    ? `${timestamp}Z`
    : timestamp
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : beijingDateTime.format(date)
}
