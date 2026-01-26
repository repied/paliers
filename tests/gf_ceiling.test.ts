
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
        expect(firstStopDepth).toBe(3); // Expecting stop at 3m as per user report

        // Calculate ceiling WITH firstStopDepth
        const ceilingProfile = calculateGFCeilings(plan.history, defaultParams, firstStopDepth);

        // Check consistency at the time of the stop
        // Find a state in history where we are at the stop
        const stopStateIdx = plan.history.findIndex(s => s.depth === firstStopDepth && s.time > plan.t_descent);
        expect(stopStateIdx).toBeGreaterThan(-1);

        const stopState = plan.history[stopStateIdx];
        const ceilingPressure = ceilingProfile[stopStateIdx];
        const ceilingDepth = (ceilingPressure - defaultParams.surfacePressure) * 10;

        // The ceiling depth should be <= current depth (safe)
        // If ceiling > depth, we are unsafe (breaking ceiling)
        expect(ceilingDepth).toBeLessThanOrEqual(stopState.depth + 0.01); // allow small float error
    });

    test('Ceiling calculation WITHOUT firstStopDepth (simulating bug)', () => {
        const plan = calculatePlan(defaultParams);
        const firstStopDepth = plan.stops[0].depth;

        // Calculate ceiling WITHOUT firstStopDepth (simulate old behavior / bug)
        // We pass undefined/null for firstStopDepth, or we can't really simulate it unless we didn't patch the code.
        // But we patched the code to default to maxDepth if firstStopDepth is not provided.
        // So we can simulate the bug by passing null/undefined (if we assume null defaults to maxDepth in our fix)
        // My fix: const kneeDepth = (firstStopDepth && firstStopDepth > 0) ? firstStopDepth : maxDepth;
        // So passing null will use maxDepth, effectively reproducing the bug.

        const ceilingProfileBuggy = calculateGFCeilings(plan.history, defaultParams, null);

        // Find a state in history where we are at the stop
        const stopStateIdx = plan.history.findIndex(s => s.depth === firstStopDepth && s.time > plan.t_descent);
        const ceilingPressureBuggy = ceilingProfileBuggy[stopStateIdx];
        const ceilingDepthBuggy = (ceilingPressureBuggy - defaultParams.surfacePressure) * 10;

        // With the bug (using maxDepth=50), GF at 3m is ~0.27 (close to High=0.25).
        // Plan uses GF=0.60.
        // GF=0.27 is much more conservative -> deeper ceiling.
        // So ceilingDepthBuggy likely > 3m.

        // We expect the buggy calculation to show violation
        expect(ceilingDepthBuggy).toBeGreaterThan(firstStopDepth);
    });
});
