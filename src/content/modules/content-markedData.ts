import 'arrive';

/**
 * 用于获取被标注的图片的 Markdown 文本数组，用于支持导出被标注的图片等内容
 * 
 * click This Chap
 * foreach masks
 *     find Target Imgs
 * click next page if exists and repeat finding process as before
 */
import $ from 'jquery';

import { Code } from '../types/Code';
import { Footnote } from '../types/Footnote';
import { Img } from '../types/Img';
import {
	getCurrentChapTitle,
	simulateClick,
	sleep,
} from './content-utils';

// 检查指定章节的标注内容中是否有 [插图]
function hasImgs(currentChapTitle: string) {
	// 遍历标注、检查是否存在 [插图]
	let sectionListItems = document.getElementsByClassName('sectionListItem');
	let foundChap = false;
	for (let i = 0; i < sectionListItems.length; i++) {
		const element = sectionListItems[i];
		let sectionListItem_title = element.getElementsByClassName('sectionListItem_title')[0]; // 标题
		if(sectionListItem_title && sectionListItem_title.textContent == currentChapTitle){ // 第一次找到本章内容
			foundChap = true;
			if ($(element).text().indexOf('[插图]')>=0) return true;
		}else if(foundChap == true 
			&& sectionListItem_title 
			&& sectionListItem_title.textContent != currentChapTitle){
			break; // 不再属于当前章节，退出循环
		}else if(foundChap == true){ // 本章内的内容
			if ($(element).text().indexOf('[插图]')>=0) return true;
		}
	}
	return false;
}

// TODO：更好的等待翻页结束的方式？
async function initMarkedDateGetter(){
	console.log('initMarkedDateGetter');
	const currentChapTitle = getCurrentChapTitle();
	// 从 DOM 对象获取图片/代码/脚注对象
	function getTargetObj(el: HTMLElement) {
		let imgSrc = el.getAttribute("data-src");
		let footnote = el.getAttribute("data-wr-footernote");
		let height = parseFloat(el.style.height);
		let top = parseFloat(el.style.transform.match(/translate\(\s*(\d*)px,\s*(\d*)px/)![2]);
		let elObj = undefined;
		if(imgSrc){
			//判断是否为行内图片
			const isInlineImg = el.className.indexOf('h-pic') > -1;
			const alt = imgSrc.split("/").pop();
			elObj = {alt: alt, imgSrc: imgSrc, height: height, top: top, isInlineImg: isInlineImg};
		}else if(footnote){
			elObj = {currentChapTitle: currentChapTitle, footnote: footnote, height: height, top: top};
		}else{//代码块
			const code = el.textContent;
			const padding = parseFloat(window.getComputedStyle(el).paddingTop) + 
				parseFloat(window.getComputedStyle(el).paddingBottom);
			height = height + padding;
			elObj = {height: height, top: top, code: code};
		}
		return elObj;
	}

	
	// 获取图片和注释
	async function getMarkedData(addThoughts: boolean, markedData: Array<Img|Footnote|Code> = [], firstPage = true) {
		if (firstPage) { // 点击当前章节，切换到第一页
			$('#routerView')[0].arrive('.readerCatalog', {onceOnly: true, fireOnAttributesModification: true}, function() { // 目录等待
				simulateClick($('.chapterItem.chapterItem_current>.chapterItem_link')[0]);
			});
			simulateClick($('.readerControls_item.catalog')[0]); // 点击目录显示之后才能够正常获取 BoundingClientRect
			await sleep(1000); // 跳转等待
		}
		let masksSelector = '.wr_underline.s0,.wr_underline.s1,.wr_underline.s2'; // 三种标注线
		if(addThoughts) masksSelector = `${masksSelector},.wr_myNote`; // 获取想法时加上想法标注线
		// 遍历标注
		let masks = document.querySelectorAll<HTMLElement>(masksSelector);
		let notesCounter = 1;
		for (const mask of masks) {
			mask.scrollIntoView({block: 'center'}); // 滚动到视图，加载图片
			mask.style.background = '#ffff0085'; // 高亮
			let maskTop = parseFloat(mask.style.top);
			let maskHeight = parseFloat(mask.style.height);
			await sleep(50); // 扫描间隔
			let ImgsSelector = "img.wr_readerImage_opacity,.reader_footer_note.js_readerFooterNote.wr_absolute,pre"; // 图片之类
			// 遍历图片之类，检查是否被当前标注遮盖
			$(ImgsSelector).each((idx, el): false | void => {
				let {imgSrc,alt,isInlineImg,footnote,currentChapTitle,code,height,top} = getTargetObj(el);
				if(!footnote && Math.abs(top + height - maskTop - maskHeight) > 0.2) return; // 继续：不是脚注（图片/代码块），但没被标注
				if(footnote && (top < maskTop || (maskTop + maskHeight) < (top + height))) return; // 继续：是脚注，但没被标注
				if(imgSrc && alt !== undefined && isInlineImg !== undefined){
					markedData.push({alt: alt, imgSrc: imgSrc, isInlineImg: isInlineImg});
				}else if(footnote){
					markedData.push({footnoteName: `${currentChapTitle}-注${notesCounter++}`, footnote: footnote});
				}else if(code){
					markedData.push({code: code});
				}
			});
			mask.style.background = '';
		}
		// 有多页时翻页继续查找
		const readerFooterBtn = $('.readerFooter_button')[0];
		if (readerFooterBtn.title == '下一页') {
			// 点击下一页
			simulateClick(readerFooterBtn, { // 似乎需要这样配置才行
				bubbles: true,
				cancelable: true,
				composed: true,
				detail: 1
			});
			await sleep(1000); // 下一页等待
			markedData = await getMarkedData(addThoughts, markedData, false);
		}
		return markedData;
	};
	// 监听背景页通知
	chrome.runtime.onMessage.addListener((request, sender, sendResponse)=>{
		if(!request.isGetMarkedData) return;
		if (!hasImgs(currentChapTitle)) sendResponse([]); // 没有 [插图] 则不需要尝试获取图片
		else {
			getMarkedData(request.addThoughts).then(markedData=>{
				sendResponse(markedData);
			});
		}
		return true; // 存在异步问题，必须返回 true
	});
}

export { initMarkedDateGetter };