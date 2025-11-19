// Unit tests for dive plan calculation functions in gf.ts
import {
    depthToPressure,
    depthToPN2,
    updateTension,
    updateAllTensions,
    getMValue,
    getModifiedMValue,
    getInterpolatedGF,
    isSafeAtDepth,
    calculatePlan
} from '../src/gf';

import { Stop } from '../src/types';


// Constants from gf.ts (re-declared for test readability)
const BUEHLMANN_TEST = [
    { t12: 5.0, A: 1.1696, B: 0.5578 },
    { t12: 8.0, A: 1.0, B: 0.6514 },
    { t12: 12.5, A: 0.8618, B: 0.7222 },
    { t12: 18.5, A: 0.7562, B: 0.7825 },
    { t12: 27.0, A: 0.62, B: 0.8126 },
    { t12: 38.3, A: 0.5043, B: 0.8434 },
    { t12: 54.3, A: 0.441, B: 0.8693 },
    { t12: 77.0, A: 0.4, B: 0.891 },
    { t12: 109.0, A: 0.375, B: 0.9092 },
    { t12: 146.0, A: 0.35, B: 0.9222 },
    { t12: 187.0, A: 0.3295, B: 0.9319 },
    { t12: 239.0, A: 0.3065, B: 0.9403 },
    { t12: 305.0, A: 0.2835, B: 0.9477 },
    { t12: 390.0, A: 0.261, B: 0.9544 },
    { t12: 498.0, A: 0.248, B: 0.9602 },
    { t12: 635.0, A: 0.2327, B: 0.9653 },
];

const N_COMPARTMENTS_TEST = BUEHLMANN_TEST.length;
const LAST_STOP_DEPTH_TEST = 3;
const STOP_INTERVAL_TEST = 3;

// ===== TESTS =====

describe('depthToPressure', () => {
    test('should return 1 bar at surface (0m)', () => {
        expect(depthToPressure(0)).toBe(1.0);
    });

    test('should return 2 bar at 10m', () => {
        expect(depthToPressure(10)).toBe(2.0);
    });

    test('should return 4 bar at 30m', () => {
        expect(depthToPressure(30)).toBe(4.0);
    });

    test('should handle fractional depths', () => {
        expect(depthToPressure(5)).toBe(1.5);
    });
});

describe('depthToPN2', () => {
    test('should return PN2 at surface', () => {
        expect(depthToPN2(0)).toBeCloseTo(0.79, 5);
    });

    test('should return PN2 at 10m', () => {
        expect(depthToPN2(10)).toBeCloseTo(1.58, 5);
    });

    test('should return PN2 at 30m', () => {
        expect(depthToPN2(30)).toBeCloseTo(3.16, 5);
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
        const tensions = Array(N_COMPARTMENTS_TEST).fill(0.79);
        const PN2 = 1.58;
        const t = 5;

        const newTensions = updateAllTensions(tensions, PN2, t);
        expect(newTensions).toHaveLength(N_COMPARTMENTS_TEST);

        // All tensions should increase
        newTensions.forEach((tension, i) => {
            expect(tension).toBeGreaterThan(tensions[i]);
            expect(tension).toBeLessThanOrEqual(PN2);
        });
    });

    test('should not mutate original tensions array', () => {
        const tensions = Array(N_COMPARTMENTS_TEST).fill(0.79);
        const originalTensions = [...tensions];

        updateAllTensions(tensions, 1.58, 5);
        expect(tensions).toEqual(originalTensions);
    });
});

describe('getMValue', () => {
    test('should calculate M-Value at surface', () => {
        const A = BUEHLMANN_TEST[0].A;
        const B = BUEHLMANN_TEST[0].B;
        const P = 1.0; // surface pressure

        const M = getMValue(A, B, P);
        expect(M).toBeCloseTo(A + P / B, 5);
    });

    test('should increase with depth', () => {
        const A = BUEHLMANN_TEST[0].A;
        const B = BUEHLMANN_TEST[0].B;

        const M_surface = getMValue(A, B, depthToPressure(0));
        const M_10m = getMValue(A, B, depthToPressure(10));
        const M_30m = getMValue(A, B, depthToPressure(30));

        expect(M_10m).toBeGreaterThan(M_surface);
        expect(M_30m).toBeGreaterThan(M_10m);
    });
});

describe('getModifiedMValue', () => {
    test('should equal M-Value when GF = 1', () => {
        const A = BUEHLMANN_TEST[0].A;
        const B = BUEHLMANN_TEST[0].B;
        const P = depthToPressure(10);

        const M_orig = getMValue(A, B, P);
        const M_mod = getModifiedMValue(A, B, P, 1.0);

        expect(M_mod).toBeCloseTo(M_orig, 5);
    });

    test('should equal pressure when GF = 0', () => {
        const A = BUEHLMANN_TEST[0].A;
        const B = BUEHLMANN_TEST[0].B;
        const P = depthToPressure(10);

        const M_mod = getModifiedMValue(A, B, P, 0.0);
        expect(M_mod).toBeCloseTo(P, 5);
    });

    test('should be between pressure and M-Value for 0 < GF < 1', () => {
        const A = BUEHLMANN_TEST[0].A;
        const B = BUEHLMANN_TEST[0].B;
        const P = depthToPressure(10);
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

describe('isSafeAtDepth', () => {
    test('should be safe at surface with surface tensions', () => {
        const tensions = Array(N_COMPARTMENTS_TEST).fill(depthToPN2(0));
        const result = isSafeAtDepth(0, tensions, 30, 0.3, 0.85);

        expect(result.isSafe).toBe(true);
        expect(result.satComp).toBe(-1);
    });

    test('should be unsafe if any compartment exceeds modified M-Value', () => {
        const tensions = Array(N_COMPARTMENTS_TEST).fill(10.0); // Very high tensions
        const result = isSafeAtDepth(0, tensions, 30, 0.3, 0.85);

        expect(result.isSafe).toBe(false);
        expect(result.satComp).toBeGreaterThanOrEqual(0);
    });
});

describe('calculatePlan', () => {
    test('should return NaN for invalid inputs (zero bottom time)', () => {
        const plan = calculatePlan(0, 30, 0.3, 0.85);
        expect(plan.dtr).toBeNaN();
        expect(plan.stops).toEqual([]);
    });

    test('should return NaN for invalid inputs (zero max depth)', () => {
        const plan = calculatePlan(20, 0, 0.3, 0.85);
        expect(plan.dtr).toBeNaN();
        expect(plan.stops).toEqual([]);
    });

    test('should calculate a plan for a simple no-decompression dive', () => {
        // Short, shallow dive - should not require stops
        const plan = calculatePlan(10, 10, 0.3, 0.85);

        expect(plan.dtr).toBeGreaterThan(0);
        expect(plan.dtr).toBeLessThan(Infinity);
        expect(plan.stops).toEqual([]);
        expect(plan.t_descent).toBeGreaterThan(0);
        expect(plan.t_dive_total).toBeGreaterThan(0);
        expect(plan.history.length).toBeGreaterThan(0);
    });

    test('should calculate a plan requiring decompression stops', () => {
        // Longer, deeper dive - should require stops
        const plan = calculatePlan(30, 30, 0.3, 0.85);

        expect(plan.dtr).toBeGreaterThan(0);
        expect(plan.dtr).toBeLessThan(Infinity);
        expect(plan.stops.length).toBeGreaterThan(0);
        expect(plan.t_stops).toBeGreaterThan(0);
        expect(plan.t_dive_total).toBeGreaterThan(plan.dtr);
    });

    test('should have descent time less than or equal to bottom time', () => {
        const bottomTime = 20;
        const plan = calculatePlan(bottomTime, 30, 0.3, 0.85);

        expect(plan.t_descent).toBeLessThanOrEqual(bottomTime);
    });

    test('should have history entries', () => {
        const plan = calculatePlan(20, 30, 0.3, 0.85);

        expect(plan.history.length).toBeGreaterThan(0);
        expect(plan.history[0].depth).toBe(0);
        expect(plan.history[0].time).toBe(0);
    });

    test('should have all stops at valid depths', () => {
        const plan = calculatePlan(30, 30, 0.3, 0.85);

        plan.stops.forEach((stop: Stop) => {
            expect(stop.depth).toBeGreaterThanOrEqual(LAST_STOP_DEPTH_TEST);
            expect(stop.depth % STOP_INTERVAL_TEST).toBe(0);
            expect(stop.time).toBeGreaterThan(0);
        });
    });

    test('should have monotonically increasing time in history', () => {
        const plan = calculatePlan(20, 30, 0.3, 0.85);

        for (let i = 1; i < plan.history.length; i++) {
            expect(plan.history[i].time).toBeGreaterThanOrEqual(plan.history[i - 1].time);
        }
    });
});
