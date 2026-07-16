import { defaultSettings, ensureSettingsStructure } from '../config/default-settings.js';
import { settingsKey, getSettings as getExtensionSettings, saveSettings as saveExtensionSettings } from '../services/settings-service.js';

/**
 * Initialize the Moonlit Echoes extension context and schedule UI setup.
 * Handles settings bootstrapping, CSS toggling, and defers UI initialization
 * until the DOM is ready.
 * @param {object} dependencies - Runtime callbacks provided by the entry point.
 * @param {Function} dependencies.initExtensionUI - Initialize extension UI.
 * @param {Function} dependencies.toggleCss - Apply the enabled CSS state.
 * @param {Function} dependencies.registerDomReadyHandler - Schedule DOM-ready work.
 */
export function initExtension({ initExtensionUI, toggleCss, registerDomReadyHandler }) {
    const context = SillyTavern.getContext();

    let extensionSettings = getExtensionSettings(context);
    if (!extensionSettings) {
        context.extensionSettings[settingsKey] = structuredClone(defaultSettings);
        extensionSettings = getExtensionSettings(context);
    }

    ensureSettingsStructure(extensionSettings);

    for (const key of Object.keys(defaultSettings)) {
        if (key !== 'presets' && key !== 'activePreset' && extensionSettings[key] === undefined) {
            extensionSettings[key] = defaultSettings[key];
        }
    }

    saveExtensionSettings(context);

    toggleCss(extensionSettings.enabled);

    registerDomReadyHandler(initExtensionUI);
}
