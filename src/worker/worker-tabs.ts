import { isPlainObject } from '../common/is'
import { getBookIds, getChapIdx } from './worker-vars'
import { logger } from '../common/logger'

// 添加标签页关闭事件监听器
chrome.tabs.onRemoved.addListener(tabId => {
    logger.debug('tabs.onRemoved', tabId)
    Promise.all([getBookIds(), getChapIdx()])
        .then(([bookIds, chapIdx]) => {
            const updates: {[key: string]: unknown} = {}
            if (isPlainObject(bookIds)) {
                delete bookIds[tabId]
                updates.bookIds = bookIds
            }
            if (isPlainObject(chapIdx)) {
                delete chapIdx[tabId]
                updates.chapIdx = chapIdx
            }
            return chrome.storage.session.set(updates)
        })
        .catch()
})
