/**
 * Convert RGBA to HEX.
 * @param {string} rgba - RGBA color string.
 * @returns {string|null} HEX color string or null.
 */
export function rgbaToHex(rgba) {
    return parseColorValue(rgba)?.hex || null;
}

/**
 * Extract alpha from an RGBA string.
 * @param {string} rgba - RGBA color string.
 * @returns {number} Opacity value between 0 and 1.
 */
export function getAlphaFromRgba(rgba) {
    return parseColorValue(rgba)?.alpha ?? 1;
}

/**
 * Convert HEX to RGBA string.
 * @param {string} hex - HEX color string.
 * @param {number} alpha - Alpha value between 0 and 1.
 * @returns {string} RGBA formatted string.
 */
export function hexToRgba(hex, alpha = 1) {
    const normalized = normalizeHex(hex);
    if (!normalized) return 'rgba(0, 0, 0, 1)';

    const numericAlpha = Number(alpha);
    const constrainedAlpha = Number.isFinite(numericAlpha)
        ? Math.min(Math.max(numericAlpha, 0), 1)
        : 1;
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${constrainedAlpha})`;
}

/**
 * Parse color input into hex/rgba components.
 * @param {string} color - Input color string.
 * @returns {Object|null} Parsed color data.
 */
export function parseColorValue(color) {
    if (typeof color !== 'string') return null;

    const trimmed = color.trim();
    const normalizedHex = normalizeHex(trimmed);

    if (normalizedHex) {
        return {
            hex: normalizedHex,
            rgba: hexToRgba(normalizedHex, 1),
            alpha: 1,
        };
    }

    const rgbaMatch = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:e[+-]?\d+)?))?\s*\)$/i);
    if (!rgbaMatch) return null;

    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    const alpha = rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]);

    if ([r, g, b].some((value) => value > 255) || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
        return null;
    }

    return {
        hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
        rgba: `rgba(${r}, ${g}, ${b}, ${alpha})`,
        alpha,
    };
}

/**
 * Extract the RGB segment from an RGBA string.
 * @param {string} rgba - RGBA color string.
 * @returns {string} RGB segment string.
 */
export function getRgbPartFromRgba(rgba) {
    const parsed = parseColorValue(rgba);
    if (!parsed) return '0, 0, 0';

    const match = parsed.rgba.match(/^rgba\((\d+), (\d+), (\d+),/);
    return match ? `${match[1]}, ${match[2]}, ${match[3]}` : '0, 0, 0';
}

function normalizeHex(hex) {
    if (typeof hex !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
        return null;
    }

    const value = hex.slice(1).toLowerCase();
    const expanded = value.length === 3
        ? value.split('').map((character) => character.repeat(2)).join('')
        : value;

    return `#${expanded}`;
}

function toHex(value) {
    return value.toString(16).padStart(2, '0');
}
