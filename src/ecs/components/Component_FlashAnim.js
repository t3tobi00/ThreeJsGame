/**
 * FlashAnim — Brief color flash on mesh material, triggered by an EventBus event.
 * color: hex string to flash to (e.g. '#ffffff').
 * duration: flash duration in seconds.
 * onEvent: EventBus event name that triggers the flash (e.g. 'entity:damaged').
 */
export class Component_FlashAnim {
    constructor({ color = '#ffffff', duration = 0.1, onEvent = 'entity:damaged' } = {}) {
        this.color = color;
        this.duration = duration;
        this.onEvent = onEvent;
        // Runtime
        this.flashTimer = 0;
        this.isFlashing = false;
    }
}
