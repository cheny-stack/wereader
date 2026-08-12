/**
 * @jest-environment jsdom
 */

const toolbarButton = {
    length: 1,
    trigger: jest.fn()
}
const emptyResult = {
    length: 0,
    css: jest.fn(),
    remove: jest.fn()
}
const jqueryMock = jest.fn((selector: unknown) => {
    if (typeof selector === 'string' && selector.startsWith('.toolbarItem.')) return toolbarButton
    return emptyResult
})
const scheduleShortcutExtensionWorkflow = jest.fn()

jest.mock('jquery', () => jqueryMock)
jest.mock('../content-shortcut-workflow', () => ({
    scheduleShortcutExtensionWorkflow
}))

import {
    clickTarget,
    selectActionIncludesCopy
} from '../content-select-action'

describe('content select action', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        window.pressedKeys = new Map<number, boolean>()
        jest.spyOn(window, 'getSelection').mockReturnValue({
            toString: () => 'selected reader text'
        } as Selection)
    })

    it.each([
        'wr_copy',
        'underlineBg,.toolbarItem.wr_copy',
        'underlineStraight,.toolbarItem.wr_copy',
        'underlineHandWrite,.toolbarItem.wr_copy'
    ])('detects copy action %s', selectAction => {
        expect(selectActionIncludesCopy(selectAction)).toBe(true)
    })

    it('schedules the external workflow after triggering the copy action', () => {
        const storageGet = chrome.storage.session.get as jest.Mock
        storageGet.mockImplementation((keys, callback) => callback({ selectAction: 'wr_copy' }))

        clickTarget()

        expect(toolbarButton.trigger).toHaveBeenCalledWith('click')
        expect(scheduleShortcutExtensionWorkflow).toHaveBeenCalledWith('selected reader text')
    })

    it('does not schedule the external workflow for a non-copy action', () => {
        const storageGet = chrome.storage.session.get as jest.Mock
        storageGet.mockImplementation((keys, callback) => callback({ selectAction: 'underlineBg' }))

        clickTarget()

        expect(toolbarButton.trigger).toHaveBeenCalledWith('click')
        expect(scheduleShortcutExtensionWorkflow).not.toHaveBeenCalled()
    })
})
