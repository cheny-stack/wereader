/**
 * @jest-environment jsdom
 */

const jqueryResult = {
    on: jest.fn(),
    css: jest.fn()
}

jest.mock('jquery', () => jest.fn(() => jqueryResult))
jest.mock('sweetalert2', () => ({
    __esModule: true,
    default: {
        mixin: jest.fn(() => ({ fire: jest.fn() })),
        fire: jest.fn(),
        stopTimer: jest.fn(),
        resumeTimer: jest.fn()
    }
}))

import {
    DOUBLE_CTRL_INTERVAL_MS,
    SHORTCUT_EXTENSION_ID,
    documentCtrlDown,
    documentCtrlUp,
    getVisibleDragBounds,
    resetCtrlKeyState
} from '../content-key-ctrl'

function keyboardEvent(key: string, target: EventTarget = document.body) {
    return {
        key,
        keyCode: key === 'Control' ? 17 : 65,
        repeat: false,
        target
    } as JQuery.KeyDownEvent & JQuery.KeyUpEvent
}

function tapCtrl(target: EventTarget = document.body) {
    documentCtrlDown(keyboardEvent('Control', target))
    documentCtrlUp(keyboardEvent('Control', target))
}

function addContainer(rect: Partial<DOMRect>) {
    const container = document.createElement('div')
    container.className = 'renderTargetContainer'
    container.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
        ...rect
    }))
    document.body.appendChild(container)
    return container
}

describe('double Ctrl drag selection', () => {
    let mouseTarget: HTMLElement
    let dispatchedEvents: MouseEvent[]

    beforeEach(() => {
        jest.useFakeTimers()
        jest.clearAllMocks()
        document.body.innerHTML = ''
        resetCtrlKeyState()
        window.pressedKeys.clear()
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
        mouseTarget = addContainer({
            left: 100,
            top: 50,
            right: 1100,
            bottom: 750,
            width: 1000,
            height: 700
        })
        dispatchedEvents = []
        const mouseEventTypes = ['mousedown', 'mousemove', 'mouseup']
        mouseEventTypes.forEach(type => {
            mouseTarget.addEventListener(type, event => dispatchedEvents.push(event as MouseEvent))
        })
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: jest.fn(() => mouseTarget)
        })
        const sendMessage = chrome.runtime.sendMessage as jest.Mock
        sendMessage.mockImplementation((extensionId, message, callback) => {
            callback({ ok: true })
        })
    })

    afterEach(() => {
        jest.restoreAllMocks()
        jest.useRealTimers()
    })

    it('triggers after two complete Ctrl taps inside 400ms', async () => {
        jest.spyOn(Date, 'now')
            .mockReturnValueOnce(1000)
            .mockReturnValueOnce(1000 + DOUBLE_CTRL_INTERVAL_MS)

        tapCtrl()
        tapCtrl()
        await jest.runAllTimersAsync()

        expect(dispatchedEvents.map(event => event.type)).toEqual([
            'mousemove',
            'mousedown',
            'mousemove',
            'mousemove',
            'mousemove',
            'mousemove',
            'mousemove',
            'mousemove',
            'mouseup'
        ])
        expect(dispatchedEvents[1]).toMatchObject({
            clientX: 104,
            clientY: 54,
            button: 0,
            buttons: 1
        })
        expect(dispatchedEvents[8]).toMatchObject({
            clientX: 1096,
            clientY: 746,
            button: 0,
            buttons: 0
        })
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            SHORTCUT_EXTENSION_ID,
            { type: 'TRIGGER_CLIPBOARD_WORKFLOW' },
            expect.any(Function)
        )
    })

    it('does not trigger after the double-tap interval', async () => {
        jest.spyOn(Date, 'now')
            .mockReturnValueOnce(1000)
            .mockReturnValueOnce(1001 + DOUBLE_CTRL_INTERVAL_MS)

        tapCtrl()
        tapCtrl()
        await jest.runAllTimersAsync()

        expect(dispatchedEvents).toHaveLength(0)
    })

    it('resets the sequence when another key is pressed', async () => {
        jest.spyOn(Date, 'now')
            .mockReturnValueOnce(1000)
            .mockReturnValueOnce(1100)

        tapCtrl()
        documentCtrlDown(keyboardEvent('a'))
        tapCtrl()
        await jest.runAllTimersAsync()

        expect(dispatchedEvents).toHaveLength(0)
    })

    it('ignores Ctrl taps while an editable element is focused', async () => {
        const input = document.createElement('input')
        document.body.appendChild(input)
        input.focus()

        tapCtrl(input)
        tapCtrl(input)
        await jest.runAllTimersAsync()

        expect(dispatchedEvents).toHaveLength(0)
    })

    it('selects the visible container with the largest viewport area', () => {
        document.body.innerHTML = ''
        addContainer({
            left: -20,
            top: 20,
            right: 300,
            bottom: 300,
            width: 320,
            height: 280
        })
        addContainer({
            left: 200,
            top: 100,
            right: 1000,
            bottom: 700,
            width: 800,
            height: 600
        })

        expect(getVisibleDragBounds()).toEqual({
            startX: 204,
            startY: 104,
            endX: 996,
            endY: 696
        })
    })
})
