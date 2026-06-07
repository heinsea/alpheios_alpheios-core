const MIN_DRAWER_WIDTH = 360
const SIDEBAR_WIDTH = 64
const MIN_PANEL_WIDTH = 296
export const DEFAULT_DRAWER_POSITION = 'right'

export function normalizeDrawerPosition (position) {
  return position === 'left' ? 'left' : DEFAULT_DRAWER_POSITION
}

export function clampDrawerWidth (width) {
  return Math.max(width, MIN_DRAWER_WIDTH)
}

export function nextDrawerWidth ({
  position,
  startWidth,
  startX,
  currentX,
  viewportWidth
}) {
  const p = normalizeDrawerPosition(position)
  const delta = p === 'right'
    ? startX - currentX
    : currentX - startX
  return clampDrawerWidth(startWidth + delta, viewportWidth)
}

export function drawerPositionStyle (position) {
  return normalizeDrawerPosition(position) === 'right'
    ? { left: 'auto', right: '0' }
    : { left: '0', right: 'auto' }
}

export function resizeHandlePosition (position) {
  return normalizeDrawerPosition(position) === 'right' ? 'left' : 'right'
}

export function drawerLayoutClass (position) {
  return `alph-drawer--${normalizeDrawerPosition(position)}`
}

export function drawerSizeStyle (width) {
  const drawerWidth = clampDrawerWidth(width)
  const panelWidth = Math.max(MIN_PANEL_WIDTH, drawerWidth - SIDEBAR_WIDTH)
  return {
    '--alph-drawer-width': `${drawerWidth}px`,
    '--alph-drawer-panel-width': `${panelWidth}px`
  }
}
