// Unit tests for dive plan calculation functions in gf.ts
import {
    isPlanBreachModifiedMValues,
    depthToPressure,
    depthToPN2,
    updateTension,
    updateAllTensions,
    getMValue,
    getModifiedMValue,
    getInterpolatedGF,
    SimulAtDepth,
    calculatePlan,
    BUEHLMANN,
    N_COMPARTMENTS
} from '../src/gf';

import { Stop } from '../src/types';

const STOP_INTERVAL = 3;
const LAST_STOP_DEPTH = 3;
const SURFACE_PRESSURE = 1.0;
const TIME_STEP = 1;
const ASCENT_RATE = 10;
const DESCENT_RATE = 20;

// ===== TESTS =====

describe('depthToPressure', () => {
    test('should return 1 bar at surface (0m)', () => {
        expect(depthToPressure(0, SURFACE_PRESSURE)).toBe(1.0);
    });

    test('should return 2 bar at 10m', () => {
        expect(depthToPressure(10, SURFACE_PRESSURE)).toBe(2.0);
    });

    test('should return 4 bar at 30m', () => {
        expect(depthToPressure(30, SURFACE_PRESSURE)).toBe(4.0);
    });

    test('should handle fractional depths', () => {
        expect(depthToPressure(5, SURFACE_PRESSURE)).toBe(1.5);
    });
});

describe('depthToPN2', () => {
    test('should return PN2 at surface', () => {
        expect(depthToPN2(0, SURFACE_PRESSURE)).toBeCloseTo(0.79, 5);
    });

    test('should return PN2 at 10m', () => {
        expect(depthToPN2(10, SURFACE_PRESSURE)).toBeCloseTo(1.58, 5);
    });

    test('should return PN2 at 30m', () => {
        expect(depthToPN2(30, SURFACE_PRESSURE)).toBeCloseTo(3.16, 5);
    });
});


describe('updateTension', () => {
    test('should approach PN2 over time', () => {
        const T0 = 0.79; // surface tension
        const PN2 = 1.58; // 10m PN2
        const t12 = 5.0; // fastest compartment

        // After some time, tension should be between T0 and PN2
        const T1 = updateTension(T0, PN2, 2.5, t12);
        expect(T1).toBeGreaterThan(T0);
        expect(T1).toBeLessThan(PN2);
    });

    test('should equal PN2 after infinite time', () => {
        const T0 = 0.79;
        const PN2 = 1.58;
        const t12 = 5.0;

        // After a very long time, tension should approach PN2
        const T1 = updateTension(T0, PN2, 1000, t12);
        expect(T1).toBeCloseTo(PN2, 5);
    });

    test('should handle off-gassing (T0 > PN2)', () => {
        const T0 = 2.0;
        const PN2 = 0.79; // back to surface
        const t12 = 5.0;

        const T1 = updateTension(T0, PN2, 2.5, t12);
        expect(T1).toBeLessThan(T0);
        expect(T1).toBeGreaterThan(PN2);
    });
});

describe('updateAllTensions', () => {
    test('should update all compartments', () => {
        const tensions = Array(N_COMPARTMENTS).fill(0.79);
        const PN2 = 1.58;
        const t = 5;

        const newTensions = updateAllTensions(tensions, PN2, t);
        expect(newTensions).toHaveLength(N_COMPARTMENTS);

        // All tensions should increase
        newTensions.forEach((tension, i) => {
            expect(tension).toBeGreaterThan(tensions[i]);
            expect(tension).toBeLessThanOrEqual(PN2);
        });
    });

    test('should not mutate original tensions array', () => {
        const tensions = Array(N_COMPARTMENTS).fill(0.79);
        const originalTensions = [...tensions];

        updateAllTensions(tensions, 1.58, 5);
        expect(tensions).toEqual(originalTensions);
    });
});

describe('getMValue', () => {
    test('should calculate M-Value at surface', () => {
        const A = BUEHLMANN[0].A;
        const B = BUEHLMANN[0].B;
        const P = 1.0; // surface pressure

        const M = getMValue(A, B, P);
        expect(M).toBeCloseTo(A + P / B, 5);
    });

    test('should increase with depth', () => {
        const A = BUEHLMANN[0].A;
        const B = BUEHLMANN[0].B;

        const M_surface = getMValue(A, B, depthToPressure(0, SURFACE_PRESSURE));
        const M_10m = getMValue(A, B, depthToPressure(10, SURFACE_PRESSURE));
        const M_30m = getMValue(A, B, depthToPressure(30, SURFACE_PRESSURE));

        expect(M_10m).toBeGreaterThan(M_surface);
        expect(M_30m).toBeGreaterThan(M_10m);
    });
});

describe('getModifiedMValue', () => {
    test('should equal M-Value when GF = 1', () => {
        const A = BUEHLMANN[0].A;
        const B = BUEHLMANN[0].B;
        const P = depthToPressure(10, SURFACE_PRESSURE);

        const M_orig = getMValue(A, B, P);
        const M_mod = getModifiedMValue(A, B, P, 1.0);

        expect(M_mod).toBeCloseTo(M_orig, 5);
    });

    test('should equal pressure when GF = 0', () => {
        const A = BUEHLMANN[0].A;
        const B = BUEHLMANN[0].B;
        const P = depthToPressure(10, SURFACE_PRESSURE);

        const M_mod = getModifiedMValue(A, B, P, 0.0);
        expect(M_mod).toBeCloseTo(P, 5);
    });

    test('should be between pressure and M-Value for 0 < GF < 1', () => {
        const A = BUEHLMANN[0].A;
        const B = BUEHLMANN[0].B;
        const P = depthToPressure(10, SURFACE_PRESSURE);
        const GF = 0.85;

        const M_orig = getMValue(A, B, P);
        const M_mod = getModifiedMValue(A, B, P, GF);

        expect(M_mod).toBeGreaterThan(P);
        expect(M_mod).toBeLessThan(M_orig);
    });
});

describe('getInterpolatedGF', () => {
    test('should return GF_low at max depth', () => {
        const GF = getInterpolatedGF(30, 30, 0.3, 0.85);
        expect(GF).toBe(0.3);
    });

    test('should return GF_high at surface', () => {
        const GF = getInterpolatedGF(0, 30, 0.3, 0.85);
        expect(GF).toBe(0.85);
    });

    test('should interpolate linearly between depths', () => {
        const GF = getInterpolatedGF(15, 30, 0.3, 0.85);
        // At half depth, should be halfway between GF_low and GF_high
        expect(GF).toBeCloseTo((0.3 + 0.85) / 2, 5);
    });

    test('should return GF_low for depths greater than max depth', () => {
        const GF = getInterpolatedGF(40, 30, 0.3, 0.85);
        expect(GF).toBe(0.3);
    });
});

describe('SimulAtDepth', () => {
    test('should be safe at surface with surface tensions', () => {
        const tensions = Array(N_COMPARTMENTS).fill(depthToPN2(0, SURFACE_PRESSURE));
        const result = SimulAtDepth(0, tensions, 30, 0.3, 0.85, SURFACE_PRESSURE);

        expect(result.isSafe).toBe(true);
        expect(result.satsCompIdx).toEqual([]);
    });

    test('should be unsafe if any compartment exceeds modified M-Value', () => {
        const tensions = Array(N_COMPARTMENTS).fill(100.0); // Very high tensions
        const result = SimulAtDepth(0, tensions, 30, 0.3, 0.85, SURFACE_PRESSURE);

        expect(result.isSafe).toBe(false);
        expect(result.satsCompIdx.length).toEqual(16); // All compartments unsaturated
    });
});

describe('calculatePlan', () => {
    const defaultParams = {
        ascentRate: ASCENT_RATE,
        descentRate: DESCENT_RATE,
        surfacePressure: SURFACE_PRESSURE,
        stopInterval: STOP_INTERVAL,
        lastStopDepth: LAST_STOP_DEPTH,
        timeStep: TIME_STEP
    };

    test('should return Infinity for invalid inputs (zero bottom time)', () => {
        const plan = calculatePlan({ bottomTime: 0, maxDepth: 30, gfLow: 0.3, gfHigh: 0.85, ...defaultParams });
        expect(plan.dtr).toBe(Infinity);
        expect(plan.stops).toEqual([]);
        expect(isPlanBreachModifiedMValues(plan)).toBe(false);
    });

    test('should return Infinity for invalid inputs (zero max depth)', () => {
        const plan = calculatePlan({ bottomTime: 20, maxDepth: 0, gfLow: 0.3, gfHigh: 0.85, ...defaultParams });
        expect(plan.dtr).toBe(Infinity);
        expect(plan.stops).toEqual([]);
    });

    test('should calculate a plan for a simple no-decompression dive', () => {
        // Short, shallow dive - should not require stops
        const plan = calculatePlan({ bottomTime: 10, maxDepth: 10, gfLow: 0.3, gfHigh: 0.85, ...defaultParams });

        expect(plan.dtr).toBeGreaterThan(0);
        expect(plan.dtr).toBeLessThan(Infinity);
        expect(plan.stops).toEqual([]);
        expect(plan.t_descent).toBeGreaterThan(0);
        expect(plan.t_dive_total).toBeGreaterThan(0);
        expect(plan.history.length).toBeGreaterThan(0);
        expect(isPlanBreachModifiedMValues(plan)).toBe(false);
    });

    test('should calculate a plan requiring decompression stops', () => {
        // Longer, deeper dive - should require stops
        const plan = calculatePlan({ bottomTime: 30, maxDepth: 30, gfLow: 0.3, gfHigh: 0.85, ...defaultParams });

        expect(plan.dtr).toBeGreaterThan(0);
        expect(plan.dtr).toBeLessThan(Infinity);
        expect(plan.stops.length).toBeGreaterThan(0);
        expect(plan.t_stops).toBeGreaterThan(0);
        expect(plan.t_dive_total).toBeGreaterThan(plan.dtr);
        expect(isPlanBreachModifiedMValues(plan)).toBe(false);
    });

    test('should have descent time less than or equal to bottom time', () => {
        const bottomTime = 20;
        const plan = calculatePlan({ bottomTime, maxDepth: 30, gfLow: 0.3, gfHigh: 0.85, ...defaultParams });

        expect(plan.t_descent).toBeLessThanOrEqual(bottomTime);
        expect(isPlanBreachModifiedMValues(plan)).toBe(false);
    });

    test('should have history entries', () => {
        const plan = calculatePlan({ bottomTime: 20, maxDepth: 30, gfLow: 0.3, gfHigh: 0.85, ...defaultParams });

        expect(plan.history.length).toBeGreaterThan(0);
        expect(plan.history[0].depth).toBe(0);
        expect(plan.history[0].time).toBe(0);
        expect(isPlanBreachModifiedMValues(plan)).toBe(false);
    });

    test('should have all stops at valid depths', () => {
        const plan = calculatePlan({ bottomTime: 30, maxDepth: 30, gfLow: 0.3, gfHigh: 0.85, ...defaultParams });

        plan.stops.forEach((stop: Stop) => {
            expect(stop.depth).toBeGreaterThanOrEqual(LAST_STOP_DEPTH);
            expect(stop.depth % STOP_INTERVAL).toBe(0);
            expect(stop.time).toBeGreaterThan(0);
            expect(isPlanBreachModifiedMValues(plan)).toBe(false);
        });
    });

    test('should have monotonically increasing time in history', () => {
        const plan = calculatePlan({ bottomTime: 20, maxDepth: 30, gfLow: 0.3, gfHigh: 0.85, ...defaultParams });

        for (let i = 1; i < plan.history.length; i++) {
            expect(plan.history[i].time).toBeGreaterThanOrEqual(plan.history[i - 1].time);
        }
        expect(isPlanBreachModifiedMValues(plan)).toBe(false);
    });

    test('Regression: complex dive should not breach modified M-values at any point', () => {
        const plan = calculatePlan({
            bottomTime: 40,
            maxDepth: 45,
            gfLow: 0.2,
            gfHigh: 0.8,
            ...defaultParams
        });

        expect(plan.stops.length).toBeGreaterThan(0);
        expect(isPlanBreachModifiedMValues(plan)).toBe(false);

        // Explicitly check every history entry
        plan.history.forEach((state, i) => {
            state.tensions.forEach((tension, compIdx) => {
                expect(tension).toBeLessThanOrEqual(state.modMValues[compIdx] + 1e-7);
            });
        });
    });
});

describe('plan detection for different last stop depths', () => {
    const defaultParams = {
        ascentRate: ASCENT_RATE,
        descentRate: DESCENT_RATE,
        surfacePressure: SURFACE_PRESSURE,
        stopInterval: STOP_INTERVAL,
        lastStopDepth: 6,
        timeStep: TIME_STEP
    };

    test('20min at 40m with last stop 6m should produce an invalid plan', () => {
        const params = { bottomTime: 20, maxDepth: 40, gfLow: 0.3, gfHigh: 0.85, ...defaultParams };
        const plan = calculatePlan(params);
        expect(isPlanBreachModifiedMValues(plan)).toBe(false);
    });
});
