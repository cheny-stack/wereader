/* Ctrl 按下事件：标注的显隐 */
import $ from 'jquery'

import { mouseMoveTarget } from './content-mousemove'
import { noteClassName, noteSelector } from '../../common/constants'
import { mySweetAlert } from './content-utils'

/* 在图片或代码被标注的时候不能够显示复制按钮，
所以下面的代码将会监听 Ctrl 键，Ctrl 键按下时鼠标下的标注元素将被隐藏，
此时复制按钮就能够正常使用 */
// 保存按下按键信息
declare global {
    // eslint-disable-next-line no-unused-vars
    interface Window {
        pressedKeys: Map<number, boolean>
    }
}

window.pressedKeys = new Map<number, boolean>()

const DOUBLE_CTRL_INTERVAL_MS = 400
const DRAG_EDGE_INSET_PX = 4
const DRAG_STEPS = 6
const DRAG_STEP_DELAY_MS = 16
const CLIPBOARD_SETTLE_DELAY_MS = 300
const SHORTCUT_EXTENSION_ID = 'jblmhiojcjldlffgnmhfflcdpofddocn'

type DragBounds = {
    startX: number,
    startY: number,
    endX: number,
    endY: number
}

let ctrlPressed = false
let lastCtrlReleaseAt = 0
let dragInProgress = false

function resetCtrlKeyState() {
    ctrlPressed = false
    lastCtrlReleaseAt = 0
    dragInProgress = false
}

function isCtrlEvent(event: JQuery.KeyDownEvent | JQuery.KeyUpEvent) {
    return event.key === 'Control' || event.keyCode === 17
}

function isEditableElement(element: EventTarget | null) {
    if (!(element instanceof HTMLElement)) return false
    return element.matches('input, textarea, select') || element.isContentEditable
}

function isEditing(event: JQuery.KeyDownEvent | JQuery.KeyUpEvent) {
    return isEditableElement(event.target) || isEditableElement(document.activeElement)
}

function getVisibleDragBounds(): DragBounds | null {
    const viewportRight = window.innerWidth || document.documentElement.clientWidth
    const viewportBottom = window.innerHeight || document.documentElement.clientHeight
    let largestArea = 0
    let result: DragBounds | null = null

    document.querySelectorAll<HTMLElement>('.renderTargetContainer').forEach(element => {
        const style = window.getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden') return

        const rect = element.getBoundingClientRect()
        const left = Math.max(0, rect.left)
        const top = Math.max(0, rect.top)
        const right = Math.min(viewportRight, rect.right)
        const bottom = Math.min(viewportBottom, rect.bottom)
        const width = right - left
        const height = bottom - top
        const area = width * height
        if (width <= DRAG_EDGE_INSET_PX * 2
            || height <= DRAG_EDGE_INSET_PX * 2
            || area <= largestArea) return

        largestArea = area
        result = {
            startX: Math.round(left + DRAG_EDGE_INSET_PX),
            startY: Math.round(top + DRAG_EDGE_INSET_PX),
            endX: Math.round(right - DRAG_EDGE_INSET_PX),
            endY: Math.round(bottom - DRAG_EDGE_INSET_PX)
        }
    })

    return result
}

async function requestDragSelection() {
    if (dragInProgress) return
    const bounds = getVisibleDragBounds()
    if (!bounds) {
        mySweetAlert({ alertMsg: { icon: 'warning', title: '未找到可选择的阅读区域' } })
        return
    }

    dragInProgress = true
    try {
        // eslint-disable-next-line no-use-before-define
        await dispatchDragSelection(bounds)
        // eslint-disable-next-line no-use-before-define
        await sleep(CLIPBOARD_SETTLE_DELAY_MS)
        try {
            // eslint-disable-next-line no-use-before-define
            await triggerShortcutExtensionWorkflow()
        } catch (error) {
            console.error('Failed to trigger reading shortcut extension:', error)
            mySweetAlert({ alertMsg: { icon: 'warning', title: '朗读扩展触发失败' } })
        }
    } catch (error) {
        console.error('Failed to drag-select reader content:', error)
        mySweetAlert({ alertMsg: { icon: 'warning', title: '模拟文字选择失败' } })
    } finally {
        dragInProgress = false
    }
}

function triggerShortcutExtensionWorkflow() {
    return new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage(
            SHORTCUT_EXTENSION_ID,
            { type: 'TRIGGER_CLIPBOARD_WORKFLOW' },
            response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message))
                    return
                }
                if (!response?.ok) {
                    reject(new Error(response?.error || 'Shortcut extension rejected the workflow'))
                    return
                }
                resolve()
            }
        )
    })
}

function sleep(ms: number) {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise(resolve => setTimeout(resolve, ms))
}

function dispatchMouseEvent(type: string, x: number, y: number, buttons: number) {
    const target = document.elementFromPoint(x, y)
    if (!target) throw new Error(`No mouse target at ${x},${y}`)
    target.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0,
        buttons
    }))
}

async function dispatchDragSelection(bounds: DragBounds) {
    const {
        startX,
        startY,
        endX,
        endY
    } = bounds
    dispatchMouseEvent('mousemove', startX, startY, 0)
    dispatchMouseEvent('mousedown', startX, startY, 1)

    for (let step = 1; step <= DRAG_STEPS; step++) {
        const progress = step / DRAG_STEPS
        const x = Math.round(startX + (endX - startX) * progress)
        const y = Math.round(startY + (endY - startY) * progress)
        // eslint-disable-next-line no-await-in-loop
        await sleep(DRAG_STEP_DELAY_MS)
        dispatchMouseEvent('mousemove', x, y, 1)
    }

    dispatchMouseEvent('mouseup', endX, endY, 0)
}

// 按键（Ctrl）按下事件：隐藏底部的标注
function documentCtrlDown(event: JQuery.KeyDownEvent) {
    console.log('documentCtrlDown')
    window.pressedKeys.set(event.keyCode, true)
    if (!isCtrlEvent(event)) {
        lastCtrlReleaseAt = 0
        return
    }
    const keyboardEvent = event.originalEvent as KeyboardEvent | undefined
    if (keyboardEvent?.repeat || isEditing(event)) {
        ctrlPressed = false
        lastCtrlReleaseAt = 0
        return
    }

    ctrlPressed = true
    if (!mouseMoveTarget) return
    if (/wr_(myNote|underline)(?!_wrapper)/.test(mouseMoveTarget.className)) {
        const parent = mouseMoveTarget.parentElement!
        if (parent.className.indexOf(noteClassName) > -1) {
            parent.style.display = 'none'
        }
    }
}

// 按键（Ctrl）抬起事件：显示标注
function documentCtrlUp(event: JQuery.KeyUpEvent) {
    console.log('documentCtrlUp')
    window.pressedKeys.set(event.keyCode, false)
    if (!isCtrlEvent(event)) return

    $(noteSelector).css('display', 'block')
    if (!ctrlPressed || isEditing(event)) {
        ctrlPressed = false
        lastCtrlReleaseAt = 0
        return
    }

    ctrlPressed = false
    const now = Date.now()
    if (lastCtrlReleaseAt && now - lastCtrlReleaseAt <= DOUBLE_CTRL_INTERVAL_MS) {
        lastCtrlReleaseAt = 0
        requestDragSelection()
        return
    }
    lastCtrlReleaseAt = now
}

function initCtrlKey() {
    resetCtrlKeyState()
    $(document).on({
        keydown: documentCtrlDown,
        keyup: documentCtrlUp
    })
}

export {
    DOUBLE_CTRL_INTERVAL_MS,
    SHORTCUT_EXTENSION_ID,
    dispatchDragSelection,
    documentCtrlDown,
    documentCtrlUp,
    getVisibleDragBounds,
    initCtrlKey,
    resetCtrlKeyState,
    triggerShortcutExtensionWorkflow
}
