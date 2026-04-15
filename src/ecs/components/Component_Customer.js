/**
 * Customer — Road-walking shopper that detours to stocked stalls, buys one
 * item, then returns to the road and despawns at the path end.
 *
 * state:           'walking' | 'approaching' | 'buying' | 'leaving'
 * targetStallId:   ECS id of the stall being visited (null while 'walking')
 * pauseTimer:      Seconds remaining in the 'buying' pause
 * budget:          Max coins this customer is willing to spend
 * reentryT:        Spline parameter saved when detouring, so 'leaving' returns
 *                  to the same spot on the road
 */
export class Component_Customer {
    constructor({
        state         = 'walking',
        targetStallId = null,
        pauseTimer    = 0,
        budget        = 10,
        reentryT      = 0
    } = {}) {
        this.state         = state;
        this.targetStallId = targetStallId;
        this.pauseTimer    = pauseTimer;
        this.budget        = budget;
        this.reentryT      = reentryT;
    }
}
