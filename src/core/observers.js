import { getSettings as getExtensionSettings } from '../services/settings-service.js';

let activeAvatarUpdater = null;
let activeFormSheldHeightController = null;

function stripOrigin(url) {
    if (!url) return '';
    if (url.startsWith(window.location.origin)) {
        return url.replace(window.location.origin, '');
    }
    return url;
}

function parseAvatarSource(rawSrc) {
    if (!rawSrc) return null;

    const normalized = stripOrigin(rawSrc);
    const trimmed = normalized.startsWith('/') ? normalized.slice(1) : normalized;

    try {
        const parsed = new URL(normalized, window.location.origin);
        if (parsed.pathname.endsWith('thumbnail')) {
            const type = parsed.searchParams.get('type');
            const file = parsed.searchParams.get('file');
            if (type && file) {
                return { type, file: decodeURIComponent(file) };
            }
        }
    } catch (err) {
        // Ignore URL parse errors and fall back to path inspection
    }

    if (trimmed.startsWith('characters/')) {
        return { type: 'avatar', file: trimmed.replace(/^characters\//, '') };
    }

    if (trimmed.startsWith('User Avatars/')) {
        return { type: 'persona', file: trimmed.replace(/^User Avatars\//, '') };
    }

    return { type: null, file: trimmed };
}

function getAvatarSources(rawSrc) {
    const info = parseAvatarSource(rawSrc);
    if (!info) {
        return { thumb: null, original: null };
    }

    const { type, file } = info;
    const ensureAbsolute = (path) => {
        if (!path) return '';
        return path.startsWith('/') ? path : `/${path}`;
    };

    const thumb =
        type === 'avatar' || type === 'persona'
            ? `/thumbnail?type=${type}&file=${encodeURIComponent(file)}`
            : ensureAbsolute(info.file);

    const original =
        type === 'avatar'
            ? ensureAbsolute(`characters/${file}`)
            : type === 'persona'
                ? ensureAbsolute(`User Avatars/${file}`)
                : ensureAbsolute(info.file);

    return {
        thumb: stripOrigin(thumb),
        original: stripOrigin(original),
    };
}

function applyAvatarSources(mes, avatarImg, preferOriginal) {
    const srcCandidate = avatarImg.getAttribute('src') || avatarImg.getAttribute('data-src');
    if (!srcCandidate) return;

    const { thumb, original } = getAvatarSources(srcCandidate);
    if (!thumb && !original) return;

    const thumbUrl = thumb || original;
    const originalUrl = original || thumbUrl;
    const targetUrl = preferOriginal ? originalUrl : thumbUrl;

    mes.dataset.avatarThumb = thumbUrl;
    mes.dataset.avatarOriginal = originalUrl;
    mes.dataset.avatar = targetUrl;

    mes.style.setProperty('--mes-avatar-thumb-url', `url('${thumbUrl}')`);
    mes.style.setProperty('--mes-avatar-original-url', `url('${originalUrl}')`);
    mes.style.setProperty('--mes-avatar-url', `url('${targetUrl}')`);

    const currentSrc = stripOrigin(avatarImg.getAttribute('src') || '');
    const desiredSrc = stripOrigin(targetUrl);
    if (desiredSrc && currentSrc !== desiredSrc) {
        avatarImg.setAttribute('src', targetUrl);
    }
}

/**
 * Initialize avatar injector observer.
 * Injects avatar URLs into message elements so they can be used in CSS.
 * @returns {function} Function to manually trigger avatar updates.
 */
export function initAvatarInjector() {
    activeAvatarUpdater?.destroy?.();

    let observer = null;
    let debounceTimer = null;
    let isDestroyed = false;

    function updateAvatars() {
        if (isDestroyed) return;

        const context = SillyTavern.getContext();
        const settings = getExtensionSettings(context) || {};
        const preferOriginal = settings.useOriginalAvatarImages === true;

        document.querySelectorAll('.mes').forEach((mes) => {
            const avatarImg = mes.querySelector('.avatar img');
            if (!avatarImg) return;

            applyAvatarSources(mes, avatarImg, preferOriginal);
        });
    }

    updateAvatars();

    const observerCallback = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateAvatars, 100);
    };

    const chatContainer = document.getElementById('chat');
    if (chatContainer) {
        observer = new MutationObserver(observerCallback);
        observer.observe(chatContainer, { childList: true, subtree: true });
    }

    updateAvatars.destroy = () => {
        if (isDestroyed) return;

        isDestroyed = true;
        clearTimeout(debounceTimer);
        observer?.disconnect();

        if (activeAvatarUpdater === updateAvatars) {
            activeAvatarUpdater = null;
        }
        if (window.updateAvatars === updateAvatars) {
            delete window.updateAvatars;
        }
    };

    activeAvatarUpdater = updateAvatars;
    window.updateAvatars = updateAvatars;
    return updateAvatars;
}

/**
 * Initialize monitoring of #form_sheld height and expose helper controls.
 * @returns {{update: function, start: function, stop: function, destroy: function}} Control helpers.
 */
export function initFormSheldHeightMonitor() {
    activeFormSheldHeightController?.destroy();

    let isInitialized = false;
    let isStarted = false;
    let isDestroyed = false;
    let observedFormSheld = null;
    let observedTextArea = null;
    let uiSetupTimer = null;
    const pendingTimers = new Set();
    const listenerController = new AbortController();

    function schedule(callback, delay) {
        if (!isStarted || isDestroyed) return null;

        const timer = setTimeout(() => {
            pendingTimers.delete(timer);
            if (isStarted && !isDestroyed) callback();
        }, delay);
        pendingTimers.add(timer);
        return timer;
    }

    function clearPendingTimers() {
        pendingTimers.forEach(clearTimeout);
        pendingTimers.clear();
        uiSetupTimer = null;
    }

    function getAccurateHeight(element) {
        if (!element) return 0;
        const rect = element.getBoundingClientRect();
        return rect.height;
    }

    function updateFormSheldHeight() {
        if (isDestroyed) return;

        const formSheld = document.getElementById('form_sheld');
        if (formSheld) {
            const height = getAccurateHeight(formSheld);
            if (height > 0) {
                document.documentElement.style.setProperty('--formSheldHeight', `${height}px`);
                isInitialized = true;
            }
        }
    }

    const mutationObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;

        for (const mutation of mutations) {
            if (
                mutation.target === observedFormSheld ||
                observedFormSheld?.contains(mutation.target) ||
                mutation.target === observedFormSheld?.parentElement
            ) {
                shouldUpdate = true;
                break;
            }

            if (mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (
                        node.id === 'form_sheld' ||
                        (node.nodeType === 1 && node.querySelector && node.querySelector('#form_sheld'))
                    ) {
                        shouldUpdate = true;
                        break;
                    }
                }
            }
        }

        if (shouldUpdate) {
            schedule(updateFormSheldHeight, 0);
        }
    });

    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.target.id === 'form_sheld') {
                const { height } = entry.contentRect;
                if (height > 0) {
                    document.documentElement.style.setProperty('--formSheldHeight', `${height}px`);
                    isInitialized = true;
                }
            }
        }
    });

    function disconnectFormObservers() {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        observedFormSheld = null;
    }

    function observeFormSheld() {
        disconnectFormObservers();
        isInitialized = false;

        const formSheld = document.getElementById('form_sheld');
        if (formSheld) {
            observedFormSheld = formSheld;
            resizeObserver.observe(formSheld);
            mutationObserver.observe(formSheld, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true,
            });

            const parent = formSheld.parentElement;
            if (parent) {
                mutationObserver.observe(parent, {
                    attributes: true,
                    attributeFilter: ['style', 'class'],
                });
            }

            updateFormSheldHeight();
        }
    }

    const bodyObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (
                        node.id === 'form_sheld' ||
                        (node.nodeType === 1 && node.querySelector && node.querySelector('#form_sheld'))
                    ) {
                        schedule(startObservers, 50);
                        return;
                    }
                }
            }
        }

        const formSheld = document.getElementById('form_sheld');
        if (formSheld && !isInitialized) {
            schedule(startObservers, 50);
        }
    });

    function onTextAreaInput() {
        if (!isStarted) return;

        updateFormSheldHeight();
        schedule(updateFormSheldHeight, 10);
        schedule(updateFormSheldHeight, 100);
    }

    function setupTextAreaListener() {
        const textArea = document.getElementById('send_textarea');
        if (observedTextArea === textArea) return;

        observedTextArea?.removeEventListener('input', onTextAreaInput);
        observedTextArea = textArea;
        observedTextArea?.addEventListener('input', onTextAreaInput);
    }

    function onWindowResize() {
        if (isStarted) updateFormSheldHeight();
    }

    function onOrientationChange() {
        if (!isStarted) return;

        updateFormSheldHeight();
        schedule(updateFormSheldHeight, 100);
        schedule(updateFormSheldHeight, 500);
    }

    function onDomReady() {
        if (!isStarted || isDestroyed) return;

        startObservers();
        updateFormSheldHeight();
        schedule(updateFormSheldHeight, 100);
        schedule(updateFormSheldHeight, 500);
        schedule(updateFormSheldHeight, 1000);
    }

    function onWindowLoad() {
        if (!isStarted || isDestroyed) return;

        startObservers();
        updateFormSheldHeight();
        schedule(updateFormSheldHeight, 500);
    }

    function onUiInteraction() {
        schedule(updateFormSheldHeight, 10);
        schedule(updateFormSheldHeight, 100);
    }

    function setupUIListeners() {
        document.querySelectorAll('#qr--bar .qr--option').forEach((button) => {
            button.addEventListener('click', onUiInteraction, { signal: listenerController.signal });
        });

        const optionsButton = document.getElementById('options_button');
        if (optionsButton) {
            optionsButton.addEventListener('click', onUiInteraction, { signal: listenerController.signal });
        }
    }

    function scheduleUIListenerSetup() {
        if (uiSetupTimer !== null) return;

        uiSetupTimer = schedule(() => {
            uiSetupTimer = null;
            setupUIListeners();
        }, 1000);
    }

    function startObservers() {
        if (isDestroyed) return;

        isStarted = true;
        if (document.body) {
            bodyObserver.observe(document.body, {
                childList: true,
                subtree: true,
            });
        }
        observeFormSheld();
        setupTextAreaListener();
        updateFormSheldHeight();
        scheduleUIListenerSetup();
    }

    function stopObservers() {
        if (isDestroyed) return;

        isStarted = false;
        isInitialized = false;
        disconnectFormObservers();
        bodyObserver.disconnect();
        observedTextArea?.removeEventListener('input', onTextAreaInput);
        observedTextArea = null;
        clearPendingTimers();
    }

    function destroy() {
        if (isDestroyed) return;

        stopObservers();
        isDestroyed = true;
        listenerController.abort();

        if (activeFormSheldHeightController === controller) {
            activeFormSheldHeightController = null;
        }
        if (window.formSheldHeightController === controller) {
            delete window.formSheldHeightController;
        }
    }

    window.addEventListener('resize', onWindowResize, { signal: listenerController.signal });
    window.addEventListener('orientationchange', onOrientationChange, { signal: listenerController.signal });
    document.addEventListener('DOMContentLoaded', onDomReady, { signal: listenerController.signal });
    window.addEventListener('load', onWindowLoad, { signal: listenerController.signal });

    const controller = {
        update: updateFormSheldHeight,
        start: startObservers,
        stop: stopObservers,
        destroy,
    };

    startObservers();
    activeFormSheldHeightController = controller;
    return controller;
}
