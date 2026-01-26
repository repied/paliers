import { calculatePlan, calculateGFCeilings, depthToPressure, N_COMPARTMENTS } from '../src/gf';
import { DiveParams, Plan } from '../src/types';

describe('Ceiling Calculation Consistency', () => {
    const defaultParams: DiveParams = {
        bottomTime: 5,
        maxDepth: 50,
        gfLow: 0.60,
        gfHigh: 0.25, // Reverse profile as per user report
        ascentRate: 10,
        descentRate: 20,
        surfacePressure: 1.0,
        stopInterval: 3,
        lastStopDepth: 3,
        timeStep: 1
    };

    test('Plan and Ceiling should be consistent at the stop depth', () => {
        const plan = calculatePlan(defaultParams);

        // Ensure we have stops
        expect(plan.stops.length).toBeGreaterThan(0);
        const firstStopDepth = plan.stops[0].depth;

        // Calculate ceiling WITH firstStopDepth
        const ceilingProfile = calculateGFCeilings(plan.history, defaultParams, firstStopDepth);

        // Check consistency at the time of the stop
        // Iterate over all history points where we are at the stop
        const stopStates = plan.history.map((s, i) => ({ s, i })).filter(({ s }) => s.depth === firstStopDepth && s.time > plan.t_descent);

        let maxViolation = -Infinity;

        stopStates.forEach(({ s, i }) => {
            const ceilingPressure = ceilingProfile[i];
            const ceilingDepth = (ceilingPressure - defaultParams.surfacePressure) * 10;
            const violation = ceilingDepth - s.depth;
            if (violation > maxViolation) {
                maxViolation = violation;
            }
        });

        // The ceiling depth should be <= current depth (safe)
        // If ceiling > depth, we are unsafe (breaking ceiling)
        expect(maxViolation).toBeLessThanOrEqual(0.01);
    });
});
