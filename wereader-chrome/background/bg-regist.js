// 监听消息
chrome.runtime.onMessage.addListener(async (msg, sender)=>{
	let tabId = sender.tab.id
	switch(msg.type){
		case "getShelf":	//content-shelf.js 获取书架数据
			sendMessageToContentScript({tabId: tabId, message: await getShelfData()});
			break;
		case "injectCss":
			chrome.tabs.insertCSS(tabId,{ file: msg.css }, ()=>{
				catchErr("onMessage.addListener", "insertCSS()");
			});
			break;
		case "saveRegexpOptions"://保存直接关闭设置页时onchange未保存的信息
			updateStorageAreainBg(msg.regexpSet);
			break;
		case "deleteBookmarks":
			if(!msg.confirm) return;
			const deleteResp = await deleteBookmarks(msg.isAll);
			const deleteMsg = `删除结束，${deleteResp.succ} 成功，${deleteResp.fail} 失败。请重新加载读书页。`;
			const alertResp = await sendAlertMsg({icon: 'info', text: deleteMsg}, tabId);
			// 弹窗通知失败后使用 alert()
			if(alertResp && !alertResp.succ) alert(deleteMsg);

	}
});

// 右键反馈
chrome.contextMenus.create({
    "type":"normal",
    "title":"反馈",
    "contexts":["browser_action"],
    "onclick": ()=>{
        chrome.tabs.create({url: "https://github.com/Higurashi-kagome/wereader/issues/new/choose"});
    }
})

// 监听 storage 改变并相应更新 Config
chrome.storage.onChanged.addListener(function(changes, namespace) {
	console.log(`new ${namespace} changes：`)
	console.log(changes)
	// 更新 Config
	if(namespace !== 'sync') return;
	for(const key in changes){
		Config[key] = changes[key]['newValue'];
	}
});

// 监听读书页请求，由请求得到 bookId
chrome.webRequest.onBeforeRequest.addListener(details => {
    const {tabId, url} = details;
	if(url.indexOf("bookmarklist?bookId=") < 0) return;
	const bookId = url.replace(/(^.*bookId=|&type=1)/g,"");
	bookIds[tabId] = bookId;
}, {urls: ["*://weread.qq.com/web/book/*"]});

// 监听安装事件
chrome.runtime.onInstalled.addListener(function(details){
	if(details.reason != 'install') return;
	chrome.tabs.create({url: "https://github.com/Higurashi-kagome/wereader/issues/9"});
});