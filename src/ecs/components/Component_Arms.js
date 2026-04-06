/**
 * Component_Arms — Left/right arm pivot Groups attached to a character mesh.
 *
 * The actual THREE.Group refs (leftArm, rightArm) are populated by EntityFactory
 * AFTER the mesh is created. ArmAnimSystem animates their local rotation in
 * response to 'skill:fired' events.
 *
 * Rest pose: both arms hang straight down (rotation.x = 0).
 * Active pose: ArmAnimSystem interpolates rotation.x over animDuration seconds
 * based on animType ('recoil' | 'swing' | 'mine').
 */
export class Component_Arms {
    constructor() {
        // Populated by EntityFactory after character mesh creation
        this.leftArm  = null;   // THREE.Group (pivot at shoulder)
        this.rightArm = null;   // THREE.Group

        // Active animation state
        this.animType     = null;    // 'recoil' | 'swing' | 'mine' | null
        this.animPhase    = 0;       // 0..1 progress
        this.animDuration = 0.2;     // seconds total
        this.animSide     = 'both';  // 'left' | 'right' | 'both'
    }
}
