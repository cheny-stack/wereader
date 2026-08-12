/**
 * @jest-environment jsdom
 */

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
    SHORTCUT_EXTENSION_ID,
    resetShortcutWorkflowState,
    scheduleShortcutExtensionWorkflow
} from '../content-shortcut-workflow'

describe('shortcut extension workflow scheduler', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.clearAllMocks()
        resetShortcutWorkflowState()
        const sendMessage = chrome.runtime.sendMessage as jest.Mock
        sendMessage.mockImplementation((...args) => {
            const callback = args[2]
            callback({ ok: true })
        })
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('deduplicates simultaneous workflow requests', async () => {
        const firstRequest = scheduleShortcutExtensionWorkflow()
        const secondRequest = scheduleShortcutExtensionWorkflow()

        expect(secondRequest).toBe(firstRequest)
        await jest.runAllTimersAsync()
        await expect(firstRequest).resolves.toBe(true)

        expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1)
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            SHORTCUT_EXTENSION_ID,
            { type: 'TRIGGER_CLIPBOARD_WORKFLOW' },
            expect.any(Function)
        )
    })

    it('sends selected text immediately without waiting for clipboard copy', async () => {
        const request = scheduleShortcutExtensionWorkflow(' selected reader text ')

        await Promise.resolve()
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            SHORTCUT_EXTENSION_ID,
            { type: 'TRIGGER_TEXT_WORKFLOW', text: 'selected reader text' },
            expect.any(Function)
        )
        await expect(request).resolves.toBe(true)
    })
})
