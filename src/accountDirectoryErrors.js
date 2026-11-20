const directoryErrors = {
  INVALID_USER: '请重新登录后再试。',
  DIRECTORY_UNAVAILABLE: '目录不可用。请确认磁盘已连接，或重新选择目录。',
  LEGACY_DIRECTORY_UNCLAIMED: '此目录与旧共享目录重叠。请先确认旧目录归属，或选择不同的目录。',
  NO_LEGACY_DIRECTORY: '旧目录已处理，请刷新设置后重试。',
  SYNC_DIR_NOT_SET: '请为当前账号设置 Syncthing 同步目录。',
}

export function accountDirectoryError(result, fallback) {
  if (result?.error === 'SYNC_DIRECTORY_IN_USE') {
    return `该同步目录与「${result.accountName}」的目录相同或重叠，请选择独立目录。`
  }
  return directoryErrors[result?.error] || result?.error || fallback
}
