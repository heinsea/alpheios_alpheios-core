import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  DEFAULT_DRAWER_POSITION,
  drawerLayoutClass,
  drawerPositionStyle,
  drawerSizeStyle,
  nextDrawerWidth,
  resizeHandlePosition
} from '../src/surfaces/drawer-resize.js'

const coreUiDefaults = JSON.parse(readFileSync(new URL('../../components/src/settings/ui-options-defaults.json', import.meta.url), 'utf8'))

test('right-positioned drawer grows when its left edge is dragged left', () => {
  assert.equal(nextDrawerWidth({
    position: 'right',
    startWidth: 444,
    startX: 500,
    currentX: 420,
    viewportWidth: 1200
  }), 524)
})

test('left-positioned drawer grows when its right edge is dragged right', () => {
  assert.equal(nextDrawerWidth({
    position: 'left',
    startWidth: 444,
    startX: 500,
    currentX: 580,
    viewportWidth: 1200
  }), 524)
})

test('drawer and resize handle are anchored on opposite sides', () => {
  assert.deepEqual(drawerPositionStyle('left'), { left: '0', right: 'auto' })
  assert.deepEqual(drawerPositionStyle('right'), { left: 'auto', right: '0' })
  assert.equal(resizeHandlePosition('left'), 'right')
  assert.equal(resizeHandlePosition('right'), 'left')
})

test('drawer defaults to the right side', () => {
  assert.equal(DEFAULT_DRAWER_POSITION, 'right')
})

test('settings panelPosition default matches the v3 drawer default', () => {
  assert.equal(coreUiDefaults.items.panelPosition.defaultValue, DEFAULT_DRAWER_POSITION)
})

test('navigation rail stays on the browser outside edge', () => {
  assert.equal(drawerLayoutClass('left'), 'alph-drawer--left')
  assert.equal(drawerLayoutClass('right'), 'alph-drawer--right')
})

test('dynamic drawer sizes are passed through CSS variables', () => {
  assert.deepEqual(drawerSizeStyle(524), {
    '--alph-drawer-width': '524px',
    '--alph-drawer-panel-width': '460px'
  })
})

test('drawer drag width is not capped by the viewport or a fixed maximum', () => {
  assert.equal(nextDrawerWidth({
    position: 'right',
    startWidth: 900,
    startX: 500,
    currentX: -700,
    viewportWidth: 1200
  }), 2100)
})

test('drawer size style preserves widths above the previous maximum', () => {
  assert.deepEqual(drawerSizeStyle(1200), {
    '--alph-drawer-width': '1200px',
    '--alph-drawer-panel-width': '1136px'
  })
})
