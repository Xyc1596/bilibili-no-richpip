// ==UserScript==
// @name         B站禁用RichPip画中画
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  拦截 npd 脚本，将 isRichPipSupported 返回值改为 false
// @author       Xyc1596
// @license      MIT
// @match        https://www.bilibili.com/video/BV*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_URL = 'https://s1.hdslb.com/bfs/static/player/main/widgets/npd.732.54d3d1ea.js';

    let modifiedContent = null;      // 修改后的脚本内容
    let fetching = false;            // 是否正在获取
    let pendingScripts = [];         // 等待内容就绪的 script 元素

    // 获取原始脚本并替换目标方法
    function fetchAndModify() {
        if (modifiedContent !== null) {
            return Promise.resolve(modifiedContent);
        }
        if (fetching) {
            return new Promise((resolve) => {
                const timer = setInterval(() => {
                    if (modifiedContent !== null) {
                        clearInterval(timer);
                        resolve(modifiedContent);
                    }
                }, 30);
            });
        }

        fetching = true;
        return fetch(TARGET_URL)
            .then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.text();
            })
            .then(text => {
                // 精确替换方法定义（兼容压缩和换行）
                const regex = /e\.prototype\.isRichPipSupported\s*=\s*function\s*\(\)\s*\{\s*return\s+this\.expStore\.newPipEnabled\s*&&\s*y\.a\.supported\s*\(\s*\)\s*\}/g;
                let modified = text.replace(regex, 'e.prototype.isRichPipSupported=function(){return false}');

                // 若精确匹配失败，使用更宽松的方式
                if (modified === text) {
                    const fallbackRegex = /(e\.prototype\.isRichPipSupported\s*=\s*function\s*\(\)\s*\{)[^}]*\}/g;
                    modified = text.replace(fallbackRegex, '$1 return false }');
                }

                modifiedContent = modified;
                return modified;
            })
            .catch(err => {
                console.error('[TM] 获取目标脚本失败:', err);
                modifiedContent = null;   // 标记失败，后续不再重试
                return null;
            })
            .finally(() => {
                fetching = false;
            });
    }

    // 页面启动时立即发起预获取
    fetchAndModify();

    // 拦截 HTMLScriptElement.prototype.src 的设置
    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (srcDescriptor && srcDescriptor.set) {
        Object.defineProperty(HTMLScriptElement.prototype, 'src', {
            set: function(value) {
                // 若匹配目标 URL 且尚未处理过该元素
                if (typeof value === 'string' && value.includes('npd.732.54d3d1ea.js') && !this._tmBlocked) {
                    this._tmBlocked = true;   // 防止重复处理

                    if (modifiedContent !== null) {
                        // 内容已就绪，直接作为内联脚本注入
                        this.textContent = modifiedContent;
                        // 不调用原始 setter，阻止网络请求
                        return;
                    } else {
                        // 内容未就绪，加入队列等待
                        pendingScripts.push(this);

                        // 若尚未开始获取，触发获取
                        if (!fetching) {
                            fetchAndModify().then(content => {
                                if (content === null) {
                                    // 若获取失败，释放队列并回退到原始加载（跳过拦截）
                                    pendingScripts.forEach(el => {
                                        el._tmBlocked = false; // 清除标记，允许加载原始资源
                                        // 重新设置 src 触发加载
                                        const originalSrc = el._tmOriginalSrc || value;
                                        srcDescriptor.set.call(el, originalSrc);
                                    });
                                    pendingScripts = [];
                                    return;
                                }

                                // 内容成功，处理队列中所有等待的元素
                                pendingScripts.forEach(el => {
                                    if (el.parentNode) {
                                        // 元素已被添加到 DOM，需要替换
                                        const parent = el.parentNode;
                                        const next = el.nextSibling;
                                        parent.removeChild(el);
                                        const newScript = document.createElement('script');
                                        newScript.textContent = content;
                                        parent.insertBefore(newScript, next);
                                    } else {
                                        // 尚未添加，直接设置文本
                                        el.textContent = content;
                                    }
                                });
                                pendingScripts = [];
                            });
                        }
                        return; // 不调用原始 setter
                    }
                }

                // 其他情况调用原始 setter
                srcDescriptor.set.call(this, value);
            },
            get: function() {
                return srcDescriptor.get.call(this);
            },
            configurable: true
        });
    } else {
        // 备选方案：使用 MutationObserver 监听动态添加的 script
        const observer = new MutationObserver(mutations => {
            for (const mut of mutations) {
                for (const node of mut.addedNodes) {
                    if (node.tagName === 'SCRIPT' && node.src && node.src.includes('npd.732.54d3d1ea.js')) {
                        // 移除原始元素
                        const parent = node.parentNode;
                        const next = node.nextSibling;
                        parent.removeChild(node);

                        // 注入修改后的内容（若已就绪）
                        if (modifiedContent !== null) {
                            const newScript = document.createElement('script');
                            newScript.textContent = modifiedContent;
                            parent.insertBefore(newScript, next);
                        } else {
                            // 若未就绪，尝试获取并注入
                            fetchAndModify().then(content => {
                                if (content !== null) {
                                    const newScript = document.createElement('script');
                                    newScript.textContent = content;
                                    parent.insertBefore(newScript, next);
                                } else {
                                    // 获取失败，重新添加原始元素（放弃拦截）
                                    parent.insertBefore(node, next);
                                }
                            });
                        }
                    }
                }
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
})();