const pendingStatuses = ['暂未购买', '未购买', '已购买-未优化', '未完成']
const completeStatuses = ['已购买', '已购买-已优化', '已完成', '已优化']

export function designStatusClass(status) {
  const label = String(status ?? '').trim()
  if (pendingStatuses.includes(label)) return 'design-status--pending'
  if (completeStatuses.includes(label)) return 'design-status--complete'
  return 'design-status--neutral'
}
