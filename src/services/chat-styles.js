import { getSettings as getExtensionSettings, saveSettings as saveExtensionSettings } from './settings-service.js';

export const CHAT_STYLE_STORAGE_KEY = 'moonlitEchoesChatStyle';
const LEGACY_CHAT_STYLE_STORAGE_KEY = 'savedChatStyle';
const SELECT_LISTENER_KEY = '__moonlitEchoesChatStyleListener';
const SELECT_JQUERY_LISTENER_KEY = '__moonlitEchoesChatStyleJqueryListener';

export const CHAT_STYLE_CLASSES = Object.freeze({
    '0': 'flatchat',
    '1': 'bubblechat',
    '2': 'documentstyle',
    '3': 'echostyle',
    '4': 'whisperstyle',
    '5': 'hushstyle',
    '6': 'ripplestyle',
    '7': 'tidestyle',
});

const CHAT_STYLE_LABELS = Object.freeze({
    '0': 'Flat',
    '1': 'Bubbles',
    '2': 'Document',
    '3': 'Echo',
    '4': 'Whisper',
    '5': 'Hush',
    '6': 'Ripple',
    '7': 'Tide',
});

const MOONLIT_STYLE_VALUES = new Set(['3', '4', '5', '6', '7']);
const CORE_STYLE_VALUES = new Set(['0', '1', '2']);
const ALL_CHAT_STYLE_CLASSES = Object.values(CHAT_STYLE_CLASSES);
let lastCoreStyleValue = '0';
let coreStyleListenerInitialized = false;

function getContextSafe() {
    try {
        return globalThis.SillyTavern?.getContext?.() ?? null;
    } catch {
        return null;
    }
}

function getStorageValue(key) {
    try {
        return globalThis.localStorage?.getItem(key) ?? '';
    } catch {
        return '';
    }
}

function setStorageValue(key, value) {
    try {
        globalThis.localStorage?.setItem(key, value);
    } catch {
        // localStorage can be unavailable in private or hardened browser modes.
    }
}

export function normalizeChatStyleValue(value, fallback = '0') {
    const normalized = String(value ?? '').trim();
    return Object.hasOwn(CHAT_STYLE_CLASSES, normalized) ? normalized : fallback;
}

export function isMoonlitChatStyleValue(value) {
    return MOONLIT_STYLE_VALUES.has(normalizeChatStyleValue(value, ''));
}

function isCoreChatStyleValue(value) {
    return CORE_STYLE_VALUES.has(normalizeChatStyleValue(value, ''));
}

export function getChatStyleLabel(value) {
    return CHAT_STYLE_LABELS[normalizeChatStyleValue(value)] ?? CHAT_STYLE_LABELS['0'];
}

function getChatDisplaySelect() {
    return document.getElementById('chat_display');
}

function getSelectedChatStyleValue(select = getChatDisplaySelect()) {
    const selectedOptionValue = select?.selectedOptions?.[0]?.value;
    return normalizeChatStyleValue(selectedOptionValue ?? select?.value, '');
}

function rememberCoreStyleValue(value) {
    const normalized = normalizeChatStyleValue(value, '');
    if (isCoreChatStyleValue(normalized)) {
        lastCoreStyleValue = normalized;
    }
}

function getCoreFallbackStyle(select = getChatDisplaySelect()) {
    rememberCoreStyleValue(select?.dataset?.sbCurrentValue);
    rememberCoreStyleValue(select?.value);
    return lastCoreStyleValue;
}

function getSavedChatStyle(settings, select = getChatDisplaySelect()) {
    const fallback = getCoreFallbackStyle(select);
    const candidates = [
        settings?.chatStyle,
        getStorageValue(CHAT_STYLE_STORAGE_KEY),
        getStorageValue(LEGACY_CHAT_STYLE_STORAGE_KEY),
        select?.value,
    ];

    for (const candidate of candidates) {
        const normalized = normalizeChatStyleValue(candidate, '');
        if (normalized) {
            return normalized;
        }
    }

    return fallback;
}

function persistChatStyle(value, context = getContextSafe()) {
    const normalized = normalizeChatStyleValue(value);
    const settings = context ? getExtensionSettings(context) : null;

    if (settings) {
        settings.chatStyle = normalized;
        saveExtensionSettings(context);
    }

    setStorageValue(CHAT_STYLE_STORAGE_KEY, normalized);
    setStorageValue(LEGACY_CHAT_STYLE_STORAGE_KEY, normalized);
}

function persistCoreChatStyleSelection(value, context = getContextSafe()) {
    const normalized = normalizeChatStyleValue(value, '');
    if (!isCoreChatStyleValue(normalized)) {
        return;
    }

    rememberCoreStyleValue(normalized);
    persistChatStyle(normalized, context);
}

function setSelectValue(select, value) {
    if (!select) {
        return;
    }

    select.value = value;
    select.dataset.moonlitCurrentValue = value;
}

export function ensureChatStyleOptions(t = value => value) {
    void t;
    const select = getChatDisplaySelect();
    if (!select) {
        return;
    }

    const ensureOption = (value, label) => {
        if (select.querySelector(`option[value="${value}"]`)) {
            return;
        }

        const option = document.createElement('option');
        option.value = value;
        option.text = label;
        option.dataset.moonlitChatStyle = 'true';
        select.appendChild(option);
    };

    ensureOption('3', 'Echo');
    ensureOption('4', 'Whisper');
    ensureOption('5', 'Hush');
    ensureOption('6', 'Ripple');
    ensureOption('7', 'Tide');
}

export function applyChatStyle(value, options = {}) {
    const context = options.context || getContextSafe();
    const settings = context ? getExtensionSettings(context) : null;
    const select = getChatDisplaySelect();
    const normalized = normalizeChatStyleValue(value, getSavedChatStyle(settings, select));
    const extensionEnabled = settings?.enabled !== false;
    const styleValue = extensionEnabled || !isMoonlitChatStyleValue(normalized)
        ? normalized
        : getCoreFallbackStyle(select);
    const className = CHAT_STYLE_CLASSES[styleValue] ?? CHAT_STYLE_CLASSES['0'];

    document.body.classList.remove(...ALL_CHAT_STYLE_CLASSES);
    document.body.classList.add(className);
    document.body.dataset.moonlitChatStyle = styleValue;

    if (isCoreChatStyleValue(styleValue)) {
        rememberCoreStyleValue(styleValue);
    }

    if (options.syncSelect !== false) {
        setSelectValue(select, styleValue);
    }

    document.dispatchEvent(new CustomEvent('moonlit:chat-style-updated', {
        detail: {
            value: styleValue,
            className,
            moonlit: isMoonlitChatStyleValue(styleValue),
        },
    }));

    return {
        value: styleValue,
        className,
        label: getChatStyleLabel(styleValue),
    };
}

export function setChatStyle(value, options = {}) {
    const context = options.context || getContextSafe();
    const normalized = normalizeChatStyleValue(value);

    if (isCoreChatStyleValue(normalized)) {
        rememberCoreStyleValue(normalized);
    }

    if (options.save !== false) {
        persistChatStyle(normalized, context);
    }

    return applyChatStyle(normalized, {
        context,
        syncSelect: options.syncSelect,
    });
}

export function syncChatStyleEnabledState(enabled) {
    const context = getContextSafe();
    const settings = context ? getExtensionSettings(context) : null;
    const savedStyle = getSavedChatStyle(settings);

    if (enabled || !isMoonlitChatStyleValue(savedStyle)) {
        applyChatStyle(savedStyle, { context });
        return;
    }

    applyChatStyle(getCoreFallbackStyle(), { context });
}

export function initChatStyleIntegration({ t } = {}) {
    const context = getContextSafe();
    const settings = context ? getExtensionSettings(context) : null;
    const select = getChatDisplaySelect();

    ensureChatStyleOptions(t);

    if (select && !select[SELECT_LISTENER_KEY]) {
        select.addEventListener('change', (event) => {
            const selectedValue = getSelectedChatStyleValue(select);
            if (isCoreChatStyleValue(selectedValue)) {
                persistCoreChatStyleSelection(selectedValue, context);
                return;
            }

            if (!isMoonlitChatStyleValue(selectedValue)) {
                return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();
            setChatStyle(selectedValue);
        }, true);

        select.addEventListener('change', () => {
            const selectedValue = getSelectedChatStyleValue(select);
            if (isCoreChatStyleValue(selectedValue)) {
                persistCoreChatStyleSelection(selectedValue);
            }
        });

        select[SELECT_LISTENER_KEY] = true;
    }

    const jquery = globalThis.jQuery || globalThis.$;
    if (select && !select[SELECT_JQUERY_LISTENER_KEY] && typeof jquery === 'function') {
        jquery(select).on('change.moonlitEchoesChatStyle', () => {
            const selectedValue = getSelectedChatStyleValue(select);
            if (isCoreChatStyleValue(selectedValue)) {
                persistCoreChatStyleSelection(selectedValue);
            }
        });

        select[SELECT_JQUERY_LISTENER_KEY] = true;
    }

    if (!coreStyleListenerInitialized) {
        document.addEventListener('sb:chat-style-updated', (event) => {
            rememberCoreStyleValue(event?.detail?.value);
            setTimeout(() => {
                const latestContext = getContextSafe();
                const latestSettings = latestContext ? getExtensionSettings(latestContext) : null;
                const savedStyle = getSavedChatStyle(latestSettings);

                if (!latestSettings || latestSettings.enabled === false || !isMoonlitChatStyleValue(savedStyle)) {
                    return;
                }

                applyChatStyle(savedStyle, {
                    context: latestContext,
                });
            }, 0);
        });
        coreStyleListenerInitialized = true;
    }

    const initialStyle = getSavedChatStyle(settings, select);
    if (settings && settings.chatStyle !== initialStyle) {
        settings.chatStyle = initialStyle;
        saveExtensionSettings(context);
    }

    applyChatStyle(initialStyle, { context });
}
