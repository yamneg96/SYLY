// WCAG contrast of a colour against white. The same rule as api/services/sites.py and the module's own check.
export const HEX = /^#[0-9a-fA-F]{6}$/

export function isHex(value: string): boolean {
  return HEX.test(value.trim())
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex.trim()) + 0.05)
}

export const MIN_CONTRAST = 4.5
