import { coreThemeSettings } from './theme-settings-core.js';
import { chatThemeSettings } from './theme-settings-chat.js';
import { mobileThemeSettings } from './theme-settings-mobile.js';

export { MESSAGE_LINE_HEIGHT_NATIVE_VALUE, isNativeMessageLineHeightValue } from './theme-settings-core.js';

/**
 * Define which categories go into which tab
 * Reorganized for better user experience
 */
export const tabMappings = {
    'core-settings': [
        'theme-colors',        // Theme Colors
        'chat-style',         // Global Message Style
        'background-effects',  // Background Effects
        'theme-extras',         // Theme Extras
        'raw-css',              // Raw CSS
    ],
    'chat-interface': [
        'chat-general',        // General Chat Settings
        'visual-novel',         // Visual Novel Mode
        'chat-echo',           // Echo Style Settings
        'chat-whisper',        // Whisper Style Settings
        'chat-ripple'         // Ripple Style Settings
    ],
    'mobile-devices': [
        'mobile-global-settings',    // Mobile Global Settings
        'mobile-detailed-settings'    // Mobile Detailed Settings
    ]
};

export const themeCustomSettings = [
    ...coreThemeSettings,
    ...chatThemeSettings,
    ...mobileThemeSettings,
];
