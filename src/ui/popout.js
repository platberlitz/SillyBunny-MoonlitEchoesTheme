let popoutVisible = false;
let popoutState = 'closed';
let popoutSession = null;
let transitionVersion = 0;

let settingsKey = '';
let dragElementFn = null;
let loadMovingUIStateFn = null;
let visibilityChangeCallback = null;

/**
 * Configure popout dependencies and callbacks.
 * @param {object} options
 * @param {string} options.settingsKey - Drawer settings key.
 * @param {Function} [options.dragElement] - Drag helper from RossAscends mods.
 * @param {Function} [options.loadMovingUIState] - Loader for persisted positions.
 * @param {Function} [options.onVisibilityChange] - Called with popout visibility state.
 */
export function configurePopout(options = {}) {
    settingsKey = options.settingsKey || settingsKey;
    dragElementFn = options.dragElement || dragElementFn;
    loadMovingUIStateFn = options.loadMovingUIState || loadMovingUIStateFn;
    visibilityChangeCallback = options.onVisibilityChange || visibilityChangeCallback;
}

/**
 * Returns whether the popout is currently visible.
 * @returns {boolean}
 */
export function isPopoutVisible() {
    return popoutVisible;
}

/**
 * Toggle the popout between open and closed states.
 */
export function togglePopout() {
    if (popoutVisible) {
        closePopout();
    } else {
        openPopout();
    }
}

/**
 * Open the settings popout and move the drawer content inside it.
 */
export function openPopout() {
    if (popoutState === 'open' || popoutState === 'opening') return;

    if (popoutState === 'closing' && popoutSession) {
        startOpening(popoutSession);
        return;
    }

    if (!settingsKey) return;

    const drawerElement = document.getElementById(`${settingsKey}-drawer`);
    const $drawer = $(drawerElement);
    const $drawerHeader = $drawer.find('.inline-drawer-header');
    const $drawerContentElement = $drawer.find('.inline-drawer-content');
    const $movingDivs = $('#movingDivs');
    const reservedElements = document.querySelectorAll(
        '#moonlit_echoes_popout, #moonlitEchoesPopoutHeader, #moonlit_echoes_content_container',
    );
    if (
        $drawer.length !== 1 ||
        $drawerHeader.length !== 1 ||
        $drawerContentElement.length !== 1 ||
        $movingDivs.length !== 1 ||
        reservedElements.length > 0
    ) {
        return;
    }

    const setupVersion = ++transitionVersion;
    popoutState = 'opening';

    if (
        popoutState !== 'opening' ||
        transitionVersion !== setupVersion ||
        document.getElementById(`${settingsKey}-drawer`) !== drawerElement ||
        !$drawerHeader[0].isConnected ||
        !$drawerContentElement[0].isConnected ||
        $drawer.find('.inline-drawer-header').length !== 1 ||
        $drawer.find('.inline-drawer-header')[0] !== $drawerHeader[0] ||
        $drawer.find('.inline-drawer-content').length !== 1 ||
        $drawer.find('.inline-drawer-content')[0] !== $drawerContentElement[0] ||
        document.querySelectorAll('#movingDivs').length !== 1 ||
        document.getElementById('movingDivs') !== $movingDivs[0] ||
        document.querySelector(
            '#moonlit_echoes_popout, #moonlitEchoesPopoutHeader, #moonlit_echoes_content_container',
        )
    ) {
        popoutState = 'closed';
        return;
    }

    const $popout = $(`
        <div id="moonlit_echoes_popout" class="draggable" style="display: none;">
            <div class="panelControlBar flex-container" id="moonlitEchoesPopoutHeader">
                <div class="fa-solid fa-moon" style="margin-right: 10px;"></div>
                <div class="title">Moonlit Echoes Theme</div>
                <div class="flex1"></div>
                <div class="fa-solid fa-grip drag-grabber hoverglow"></div>
                <div class="fa-solid fa-circle-xmark hoverglow dragClose"></div>
            </div>
            <div id="moonlit_echoes_content_container"></div>
        </div>
    `);
    const contentParent = $drawerContentElement[0].parentNode;
    const contentAnchor = document.createComment('moonlit-echoes-drawer-content');
    const contentStyle = $drawerContentElement.attr('style');
    const contentHadOpenClass = $drawerContentElement.hasClass('open');
    $drawerContentElement[0].before(contentAnchor);

    $movingDivs.append($popout);

    $drawerContentElement.removeClass('open').detach()
        .appendTo($popout.find('#moonlit_echoes_content_container'));
    $drawerContentElement.addClass('open').show();
    const session = {
        $popout,
        $drawerContent: $drawerContentElement,
        contentParent,
        contentAnchor,
        contentStyle,
        contentHadOpenClass,
    };
    popoutSession = session;

    if (typeof loadMovingUIStateFn === 'function') {
        try {
            loadMovingUIStateFn();
        } catch (error) {
            // Silent error handling to avoid breaking UI.
        }
    }
    if (!isCurrentSetup(session, setupVersion)) {
        cleanUpInterruptedSetup(session, setupVersion);
        return;
    }

    if (typeof dragElementFn === 'function') {
        try {
            dragElementFn($popout);
        } catch (error) {
            // Silent error handling to avoid breaking UI.
        }
    }
    if (!isCurrentSetup(session, setupVersion)) {
        cleanUpInterruptedSetup(session, setupVersion);
        return;
    }

    $popout.find('.dragClose').on('click', () => {
        if (popoutSession === session) {
            closePopout();
        }
    });

    startOpening(session);
}

function isCurrentSetup(session, version) {
    return popoutSession === session &&
        popoutState === 'opening' &&
        transitionVersion === version &&
        session.$popout[0].isConnected &&
        session.$drawerContent[0].isConnected;
}

function cleanUpInterruptedSetup(session, version) {
    if (
        popoutSession !== session ||
        popoutState !== 'opening' ||
        transitionVersion !== version
    ) {
        return;
    }

    restoreDrawerContent(session);
    session.$popout.remove();
    popoutSession = null;
    popoutState = 'closed';
}

/**
 * Close the settings popout and return the drawer content to its original location.
 */
export function closePopout() {
    if (popoutState === 'closed' || popoutState === 'closing' || !popoutSession) return;

    const session = popoutSession;
    const version = ++transitionVersion;
    popoutState = 'closing';

    $(document).off('keydown.moonlit_popout');
    setVisibility(false);
    if (
        popoutSession !== session ||
        popoutState !== 'closing' ||
        transitionVersion !== version
    ) {
        return;
    }

    session.$popout.stop(true, false).fadeOut(250).promise('fx').always(() => {
        if (
            popoutSession !== session ||
            popoutState !== 'closing' ||
            transitionVersion !== version
        ) {
            return;
        }

        restoreDrawerContent(session);
        session.$popout.remove();
        popoutSession = null;
        popoutState = 'closed';
    });
}

function startOpening(session) {
    const version = ++transitionVersion;
    popoutState = 'opening';

    $(document)
        .off('keydown.moonlit_popout')
        .on('keydown.moonlit_popout', (event) => {
            if (event.key === 'Escape') {
                closePopout();
            }
        });
    setVisibility(true);
    if (
        popoutSession !== session ||
        popoutState !== 'opening' ||
        transitionVersion !== version
    ) {
        return;
    }

    session.$popout.stop(true, false).fadeIn(250).promise('fx').always(() => {
        if (
            popoutSession === session &&
            popoutState === 'opening' &&
            transitionVersion === version
        ) {
            session.$popout.css('opacity', '').show();
            popoutState = 'open';
        }
    });
}

function restoreDrawerContent(session) {
    const contentElement = session.$drawerContent[0];
    const anchorParent = session.contentAnchor.parentNode;
    session.$drawerContent.detach();

    if (anchorParent) {
        anchorParent.insertBefore(contentElement, session.contentAnchor);
        session.contentAnchor.remove();
    } else {
        session.contentParent.append(contentElement);
    }

    session.$drawerContent.toggleClass('open', session.contentHadOpenClass);
    if (session.contentStyle === undefined) {
        session.$drawerContent.removeAttr('style');
    } else {
        session.$drawerContent.attr('style', session.contentStyle);
    }
}

function setVisibility(visible) {
    if (popoutVisible === visible) return;
    popoutVisible = visible;

    if (typeof visibilityChangeCallback === 'function') {
        try {
            visibilityChangeCallback(visible);
        } catch (error) {
            // Silent error handling to avoid interrupting UI flow.
        }
    }
}
