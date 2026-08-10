import {
    BackupKey, defaultConfig, DefaultBackupName
} from './worker-vars'

async function initializeSessionStorage() {
    await chrome.storage.session.setAccessLevel({
        accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
    })

    const current = await chrome.storage.session.get(null)
    const updates: {[key: string]: unknown} = {}

    Object.keys(defaultConfig).forEach(key => {
        if (current[key] === undefined) {
            updates[key] = defaultConfig[key as keyof typeof defaultConfig]
        }
    })

    if (current[BackupKey] === undefined) {
        const { backupName, ...defaultProfile } = defaultConfig
        updates[BackupKey] = {
            [DefaultBackupName]: defaultProfile
        }
    }
    if (current.mpTempData === undefined) updates.mpTempData = {}
    if (current.bookIds === undefined) updates.bookIds = {}
    if (current.books === undefined) updates.books = {}

    if (Object.keys(updates).length > 0) {
        await chrome.storage.session.set(updates)
    }
}

initializeSessionStorage().catch(error => {
    console.error('session storage initialization failed', error)
})
