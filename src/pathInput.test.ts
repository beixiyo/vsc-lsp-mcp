import { describe, expect, it } from 'vitest'
import { hasUriScheme, isFileUri, isNativeAbsolutePath, isWindowsAbsolutePath } from './pathInput'

describe('path input classification', () => {
  it.each(['C:/work/file.ts', 'd:\\work\\file.ts'])(
    'keeps a Windows drive path out of URI scheme detection: %s',
    (value) => {
      expect(isWindowsAbsolutePath(value)).toBe(true)
      expect(isNativeAbsolutePath(value)).toBe(true)
      expect(hasUriScheme(value)).toBe(false)
    },
  )

  it.each(['file:///work/file.ts', 'file:/work/file.ts', 'jdt://contents/String.class', 'untitled:item'])(
    'recognizes a URI scheme: %s',
    value => expect(hasUriScheme(value)).toBe(true),
  )

  it('recognizes file URI forms case-insensitively', () => {
    expect(isFileUri('FILE:/work/file.ts')).toBe(true)
  })
})
