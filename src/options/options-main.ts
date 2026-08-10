import { initConfigSelect } from './options-config-edit'
import { initCurrentConfig } from './options-config-init'
import { initExpandBtn } from './options-expand'
import { initPrompt } from './options-prompt'
import { initRegexp } from './options-regexp'
import { initUnload } from './options-unload'
import { getRegexpSet } from './options-utils'
import { getSyncStorage } from '../common/utils'

// 初始化
function initialize(setting: { [key: string]: unknown}, settings: { [key: string]: unknown}) {
    initExpandBtn()
    initPrompt()
    initConfigSelect(setting, settings)
    initCurrentConfig(setting)
    initRegexp(setting)
}

// 入口
function main() {
    getSyncStorage().then(setting => {
        console.log('********************************************')
        console.log('session config', setting)
        chrome.storage.session.get(function (settings) {
            console.log('session data', settings)
            console.log('********************************************')
            initialize(setting as {[key: string]: unknown}, settings)
            initUnload()
        })
    })
}

export { main, getRegexpSet }
