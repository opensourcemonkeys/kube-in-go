/**
 * Cross-window drag overlay (target side).
 *
 * A tab dragged out of one Electron window and over another cannot reach the
 * other window's dockview through normal events: the OS routes all button-held
 * mouse events to the window the drag started in, and the two windows are
 * separate renderers with separate dockview instances. So the electron main
 * process polls the cursor and forwards its position here (see main.cjs), and
 * we *synthesize* the HTML5 drag events dockview's drop targets listen for
 * (`dnd/dnd.js`). That lights up dockview's own split / dock-group overlay, and
 * on release dockview fires `onDidDrop` with the chosen group + position — which
 * DockviewContainer uses to place the panel exactly where the overlay showed.
 *
 * dockview only renders overlays for a *recognised* drag; an external one (no
 * `PanelTransfer` in its process-local store) is offered to
 * `onUnhandledDragOverEvent`, which DockviewContainer accepts while
 * `isCrossWindowDragActive()` is true. Everything here no-ops under Wails or a
 * plain browser, where there is only ever one window.
 */
import { PanelPayload } from './shellWindows';

let active = false;
let lastX = 0;
let lastY = 0;
let lastEl: Element | null = null;
let pendingPanel: PanelPayload | null = null;

function fire(el: Element, type: string, x: number, y: number) {
    el.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }),
    );
}

/** True while a tab from another window is hovering this one. */
export const isCrossWindowDragActive = () => active;

/**
 * The panel a synthetic drop is placing, consumed once. DockviewContainer's
 * `onDidDrop` calls this: a non-null result means the drop is ours to place.
 */
export function takeDroppedPanel(): PanelPayload | null {
    const p = pendingPanel;
    pendingPanel = null;
    return p;
}

/**
 * The cursor moved to (x, y) — client coords in this window — during a
 * cross-window drag. Replays the browser's enter/over sequence so dockview's
 * drop target under the cursor shows and updates its overlay.
 */
export function dragHover(x: number, y: number) {
    active = true;
    lastX = x;
    lastY = y;
    const el = document.elementFromPoint(x, y);
    if (!el) return;
    if (el !== lastEl) {
        if (lastEl) fire(lastEl, 'dragleave', x, y);
        fire(el, 'dragenter', x, y);
        lastEl = el;
    }
    fire(el, 'dragover', x, y);
}

/** The cursor left this window (to another window or back to the source). */
export function dragLeave() {
    if (!active) return;
    if (lastEl) fire(lastEl, 'dragleave', lastX, lastY);
    // dragend releases whichever drop target latched onto the drag.
    document.dispatchEvent(new DragEvent('dragend', { bubbles: true, clientX: lastX, clientY: lastY }));
    active = false;
    lastEl = null;
}

/**
 * The dragged panel was released over this window. Synthesizes the drop at the
 * last hover point so dockview resolves the target group/position and fires
 * `onDidDrop`. Returns true if that drop was consumed (placed) — false means
 * the pointer wasn't over an accepting target and the caller should fall back
 * to default placement.
 */
export function dropPanel(panel: PanelPayload): boolean {
    if (!active) return false;
    active = false;
    pendingPanel = panel;
    const el = document.elementFromPoint(lastX, lastY);
    lastEl = null;
    if (el) fire(el, 'drop', lastX, lastY); // onDidDrop consumes pendingPanel synchronously
    const consumed = pendingPanel === null;
    pendingPanel = null;
    return consumed;
}
