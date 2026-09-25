// ==UserScript==
// @name         Z.ai Peak Popup Auto-Close + Smart Resend
// @name:zh      Z.ai 高峰弹窗自动关闭 + 智能重发
// @namespace    https://github.com/limbonux/zai-autocloser
// @homepageURL  https://greasyfork.org/en/scripts/597424-z-ai-peak-popup-auto-close-smart-resend
// @supportURL   https://github.com/limbonux/zai-autocloser/issues
// @source       https://github.com/limbonux/zai-autocloser
// @version      1.0.1
// @description  Auto-closes the Z.ai "peak hours" popup and resends your message after a safe, escalating delay (EN/ZH UI)
// @author       limbonux
// @match        https://chat.z.ai/*
// @match        https://*.z.ai/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ========== Configuration ==========
    const CONFIG = {
        // Phrases that identify the peak-hours popup (compared case-insensitively)
        KEYWORDS: [
            // Exact wording of the real popup (English UI)
            'currently in peak', 'peak hours', 'coordination of resources',
            'intensifying the coordination', 'try again later',
            // Other plausible English variants
            'peak period', 'peak time', 'high traffic', 'high demand',
            'resource coordination', 'currently experiencing', 'a lot of traffic',
            // Chinese UI
            '目前处于高峰时段', '正在加强资源协调'
        ],
        // Buttons that must never be clicked (switch/cancel/confirm)
        FORBIDDEN_BUTTONS: [
            '切换', '取消', 'switch', 'cancel', 'turbo', 'glm-5-turbo', 'switch to',
            'confirm', 'ok'
        ],
        // Known-safe dismiss buttons (e.g. "Try again later" on the real popup)
        SAFE_DISMISS_BUTTONS: [
            'try again later', 'got it', 'dismiss', 'close',
            '稍后再试', '知道了'
        ],
        CLOSE_COOLDOWN: 1500,   // debounce between close attempts (ms)
        RESEND_DELAY: 3500,     // wait before resending (avoids an immediate 429)
        MAX_RETRY: 5,           // max automatic retries per message
        RETRY_BACKOFF: 2000,    // extra wait added after each failed retry
        DEBUG: true
    };

    // ========== State ==========
    const state = {
        lastCloseTime: 0,
        retryCount: 0,
        lastMessageText: '',
        pendingResend: false,
        resendTimer: null
    };

    const log = (...args) => {
        if (CONFIG.DEBUG) console.log('%c[Z.ai AutoCloser]', 'color:#00d4ff;font-weight:bold', ...args);
    };

    // ========== Helpers ==========

    // Chat input (textarea or contenteditable)
    function getEditor() {
        return (
            document.querySelector('textarea#chat-input') ||
            document.querySelector('textarea[placeholder]') ||
            document.querySelector('div[contenteditable="true"]') ||
            document.querySelector('textarea')
        );
    }

    function getEditorText() {
        const ed = getEditor();
        if (!ed) return '';
        return ed.tagName === 'TEXTAREA' ? ed.value : ed.innerText;
    }

    function setEditorText(text) {
        const ed = getEditor();
        if (!ed || !text) return false;

        ed.focus();

        if (ed.tagName === 'TEXTAREA') {
            // React-controlled component: native setter + input event
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            setter.call(ed, text);
            ed.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            ed.innerText = text;
            ed.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
        }
        return true;
    }

    function clickSendButton() {
        const candidates = [
            'button[aria-label*="Send" i]',
            'button[aria-label*="发送"]',
            'button[data-testid*="send" i]',
            '#send-message-button'
        ];

        for (const sel of candidates) {
            const btn = document.querySelector(sel);
            if (btn && !btn.disabled) {
                btn.click();
                return true;
            }
        }

        // Fallback: press Enter inside the editor
        const ed = getEditor();
        if (ed) {
            ed.focus();
            ed.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                bubbles: true, cancelable: true
            }));
            return true;
        }
        return false;
    }

    const containsKeyword = (text) => {
        const t = (text || '').toLowerCase();
        return CONFIG.KEYWORDS.some(k => t.includes(k.toLowerCase()));
    };

    const isForbidden = (text) => {
        const t = (text || '').trim().toLowerCase();
        return t.length > 0 && CONFIG.FORBIDDEN_BUTTONS.some(k => t.includes(k.toLowerCase()));
    };

    const isSafeDismiss = (text) => {
        const t = (text || '').trim().toLowerCase();
        return t.length > 0 && t.length <= 30 &&
            !isForbidden(t) &&
            CONFIG.SAFE_DISMISS_BUTTONS.some(k => t.includes(k.toLowerCase()));
    };

    // Precisely identify the peak popup (skip huge containers)
    function findPeakDialog() {
        const dialogs = document.querySelectorAll(
            '[role="dialog"], [role="alertdialog"], .modal, [class*="Modal"], [class*="Dialog"]'
        );

        for (const d of dialogs) {
            const text = (d.textContent || '').trim();
            if (text.length > 500) continue; // too long — not an alert dialog
            if (containsKeyword(text)) return d;
        }

        // Fallback: scan small containers
        const all = document.querySelectorAll('div, section');
        for (const el of all) {
            if (el.children.length > 15) continue;
            const text = (el.textContent || '').trim();
            if (text.length > 500 || text.length < 10) continue;
            if (containsKeyword(text)) return el;
        }
        return null;
    }

    // Find the close button inside the dialog — safest candidates first
    function findCloseButton(dialog) {
        // 1) Explicit aria-label in any language
        let btn = dialog.querySelector(
            'button[aria-label*="close" i], button[aria-label*="Close" i],' +
            'button[aria-label*="关闭"], button[aria-label*="dismiss" i]'
        );
        if (btn) return btn;

        // 2) CSS class containing "close"
        btn = dialog.querySelector('[class*="close" i]:not([class*="disclose"])');
        if (btn && btn.tagName === 'BUTTON' && !isForbidden(btn.textContent)) return btn;

        // 3) Icon-only button (the usual X shape)
        const btns = dialog.querySelectorAll('button');
        for (const b of btns) {
            const txt = (b.textContent || '').trim();
            if (txt.length <= 1 && b.querySelector('svg')) return b;
        }

        // 3.5) Known-safe text button such as "Try again later" (dismisses without switching)
        for (const b of btns) {
            if (isSafeDismiss(b.textContent)) return b;
        }

        // 4) Last resort: a text-less or aria-labeled button — never a forbidden text button
        for (const b of btns) {
            const txt = (b.textContent || '').trim();
            if (!isForbidden(txt) && (txt.length === 0 || b.hasAttribute('aria-label'))) {
                return b;
            }
        }

        // No safe button found — refuse to guess (v1 clicked any button, which was risky)
        return null;
    }

    // ========== Core logic ==========

    function handlePeakDialog() {
        const now = Date.now();
        if (now - state.lastCloseTime < CONFIG.CLOSE_COOLDOWN) return;

        const dialog = findPeakDialog();
        if (!dialog) return;

        const closeBtn = findCloseButton(dialog);
        if (!closeBtn) {
            log('⚠️ Peak dialog found but no safe close button located', dialog);
            return;
        }

        state.lastCloseTime = now;

        // Back up the input text before closing (the site usually clears it)
        const currentText = getEditorText();
        if (currentText && currentText.length > 0) {
            state.lastMessageText = currentText;
            log('💾 Backed up input text:', currentText.slice(0, 30) + '...');
        }

        closeBtn.click();
        log('🗙 Closed peak popup');

        if (state.retryCount >= CONFIG.MAX_RETRY) {
            log(`⛔ Max retries (${CONFIG.MAX_RETRY}) reached — auto-resend stopped, manual action needed`);
            state.retryCount = 0;
            return;
        }

        if (state.resendTimer) clearTimeout(state.resendTimer);

        // Escalating backoff: 3.5s, 5.5s, 7.5s, ...
        const delay = CONFIG.RESEND_DELAY + state.retryCount * CONFIG.RETRY_BACKOFF;
        state.retryCount++;
        state.pendingResend = true;

        log(`⏳ Resending in ${delay}ms (attempt ${state.retryCount})`);

        state.resendTimer = setTimeout(() => {
            attemptResend();
        }, delay);
    }

    function attemptResend() {
        state.pendingResend = false;

        const currentText = getEditorText();
        if (!currentText && state.lastMessageText) {
            log('📝 Editor is empty — restoring backup');
            setEditorText(state.lastMessageText);
            // Give React a moment to process the new state
            setTimeout(() => {
                clickSendButton();
                log('🚀 Resent');
            }, 200);
        } else {
            clickSendButton();
            log('🚀 Resent (using current editor text)');
        }
    }

    // Hook fetch: reset the retry counter when a send actually succeeds,
    // so a message that already went through is never duplicated
    function watchSuccess() {
        const origFetch = window.fetch;
        window.fetch = async function (...args) {
            const resp = await origFetch.apply(this, args);
            try {
                const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
                if (url && /\/api\/.*\/(completions|chat)/.test(url)) {
                    if (resp.ok && state.retryCount > 0) {
                        log('✅ Message send succeeded — resetting retry counter');
                        state.retryCount = 0;
                        state.lastMessageText = '';
                    }
                }
            } catch (e) { /* ignore */ }
            return resp;
        };
    }

    // ========== Startup ==========

    const observer = new MutationObserver(() => {
        handlePeakDialog();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Safety-net polling in case the observer misses an event
    setInterval(handlePeakDialog, 800);

    watchSuccess();

    // Console debug handle
    window.__zaiPeakAutoCloser = {
        state,
        config: CONFIG,
        stop() {
            observer.disconnect();
            log('🛑 Stopped');
        },
        reset() {
            state.retryCount = 0;
            state.lastMessageText = '';
            if (state.resendTimer) clearTimeout(state.resendTimer);
            log('🔄 State reset');
        },
        triggerTest() {
            handlePeakDialog();
        }
    };

    log('🚀 Z.ai Peak AutoCloser v1.0.1 running (EN/ZH)');
    log('💡 Console commands: __zaiPeakAutoCloser.stop() / .reset() / .state');
})();
