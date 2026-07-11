/** 判断输入是否是 Windows 盘符绝对路径 */
export function isWindowsAbsolutePath(value: string): boolean {
  return /^[a-z]:[\\/]/i.test(value)
}

/** 判断输入是否带 URI scheme，并排除 Windows 盘符路径 */
export function hasUriScheme(value: string): boolean {
  return !isWindowsAbsolutePath(value) && /^[a-z][a-z\d+.-]*:/i.test(value)
}

/** 判断输入是否是本机绝对路径 */
export function isNativeAbsolutePath(value: string): boolean {
  return value.startsWith('/') || isWindowsAbsolutePath(value)
}

/** 判断输入是否是 file URI */
export function isFileUri(value: string): boolean {
  return /^file:/i.test(value)
}
