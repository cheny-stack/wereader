import { mySweetAlert } from './content-utils'

const CLIPBOARD_SETTLE_DELAY_MS = 300
const SHORTCUT_EXTENSION_ID = 'abjeailncmljeiiibeockpdolobmonha'

let pendingWorkflow: Promise<boolean> | null = null

function sleep(ms: number) {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise(resolve => setTimeout(resolve, ms))
}

function triggerShortcutExtensionWorkflow(selectedText?: string) {
    const text = selectedText?.trim()
    return new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage(
            SHORTCUT_EXTENSION_ID,
            text
                ? { type: 'TRIGGER_TEXT_WORKFLOW', text }
                : { type: 'TRIGGER_CLIPBOARD_WORKFLOW' },
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

function scheduleShortcutExtensionWorkflow(selectedText?: string) {
    if (pendingWorkflow) return pendingWorkflow

    const text = selectedText?.trim()
    const waitForClipboard = text ? Promise.resolve() : sleep(CLIPBOARD_SETTLE_DELAY_MS)
    pendingWorkflow = waitForClipboard
        .then(() => triggerShortcutExtensionWorkflow(text))
        .then(() => true)
        .catch(error => {
            console.error('Failed to trigger reading shortcut extension:', error)
            mySweetAlert({ alertMsg: { icon: 'warning', title: '朗读扩展触发失败' } })
            return false
        })
        .finally(() => {
            pendingWorkflow = null
        })
    return pendingWorkflow
}

function resetShortcutWorkflowState() {
    pendingWorkflow = null
}

export {
    CLIPBOARD_SETTLE_DELAY_MS,
    SHORTCUT_EXTENSION_ID,
    resetShortcutWorkflowState,
    scheduleShortcutExtensionWorkflow,
    triggerShortcutExtensionWorkflow
}
