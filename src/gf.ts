import { assert, Tensions, SpeedMmin, CompartmentCoefs, Depth, TensionBar, Minutes, HalfLife, CoefA, CoefB, Pressure, GF, GFLow, GFHigh, Simulation, Plan, PN2, DiveParams, CompIdx } from "./types.js";

// Values from subsurface codebase are the same as mine
// static const double buehlmann_N2_a[] = {
//     1.1696, 1.0, 0.8618, 0.7562,
//     0.62, 0.5043, 0.441, 0.4,
//     0.375, 0.35, 0.3295, 0.3065,
//     0.2835, 0.261, 0.248, 0.2327 };

// static const double buehlmann_N2_b[] = {
//     0.5578, 0.6514, 0.7222, 0.7825,
//     0.8126, 0.8434, 0.8693, 0.8910,
//     0.9092, 0.9222, 0.9319, 0.9403,
//     0.9477, 0.9544, 0.9602, 0.9653 };

// const double buehlmann_N2_t_halflife[] = {
//     5.0, 8.0, 12.5, 18.5,
//     27.0, 38.3, 54.3, 77.0,
//     109.0, 146.0, 187.0, 239.0,
//     305.0, 390.0, 498.0, 635.0 };


export const BUEHLMANN: ReadonlyArray<CompartmentCoefs> = [
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

// Assert all BUEHLMANN values are positive
for (const c of BUEHLMANN) {
    assert(c.t12 > 0, 'Half-life (t12) must be positive');
    assert(c.A >= 0, 'Coef A must be non-negative');
    assert(c.B > 0, 'Coef B must be positive');
}

export const N_COMPARTMENTS = BUEHLMANN.length;
export const HALF_LIFES: ReadonlyArray<HalfLife> = BUEHLMANN.map(c => c.t12);
export const MAX_STOP_TIME_BEFORE_INFTY: Minutes = 60 * 12; // minutes

// --- Dive ---
export const FN2 = 0.79; // Nitrogen Fraction in air

// --- Simulation constants ---
export const GF_INCREMENT: GF = 5;
export const SURFACE_WAIT_MIN: Minutes = 20; // after the dive to see how tension move at surface

// --- Algorithm functions ---
export const SURFACE_DEPTH: Depth = 0;
export const GFS_GRID_SIZE = Math.floor(100 / GF_INCREMENT);
export function depthToPressure(depth: Depth, surfacePressure: Pressure): Pressure {
    return surfacePressure + depth / 10;
}
export function depthToPN2(depth: Depth, surfacePressure: Pressure): PN2 {
    return depthToPressure(depth, surfacePressure) * FN2;
}

/**
 * Returns a single tension after time t at partial pressure P, if starting from tension T0
 * Tn2 = P + (T0 - P) * exp(-k * t)
 */
export function updateTension(t0: TensionBar, pn2: PN2, t: Minutes, compartment_t12: HalfLife): TensionBar {
    const k = Math.log(2) / compartment_t12;
    const T1 = pn2 + (t0 - pn2) * Math.exp(-k * t);
    return T1;
}

/**
 * Computes new tensions for all compartments after time t at PN2
 */
export function updateAllTensions(tensions: Tensions, PN2: PN2, t: Minutes): Tensions {
    return HALF_LIFES.map((t12, i) => updateTension(tensions[i], PN2, t, t12));
}

/**
 * Original M_Value (according to constants A and B)
 * M_Value is the maximum tolerated tension in a compartment at given ambient pressure
 * pressure is a real pressure, not a partial pressure for N2
 */
export function getMValue(A: CoefA, B: CoefB, pressure: Pressure): TensionBar {
    const M_orig: TensionBar = A + pressure / B;
    assert(M_orig >= pressure, `M Value should be > pressure`);
    return M_orig
}
/**
 * Modified M-Value using gradient factor at current pressure
 * Modified M_value is a lower limit for tension in a compartment
 * pressure is a real pressure, not a partial pressure for N2
*/
export function getModifiedMValue(A: CoefA, B: CoefB, pressure: Pressure, GF: GF): TensionBar {
    const M_orig = getMValue(A, B, pressure);
    const M_mod = M_orig * GF + pressure * (1 - GF); // same as pressure + (M_orig - pressure) * GF;
    assert(M_mod <= M_orig, `We should have M_mod <= M_orig`);
    assert(M_mod >= pressure, `we should have M_mod >= pressure`);
    return M_mod;
}
/**
 * Get the interpolated gradient factor (GF) for a given depth
 * gfLow = GF at max depth
 * gfHigh = GF at surface
 */
export function getInterpolatedGF(depth: Depth, maxDepth: Depth, gfLow: GFLow, gfHigh: GFHigh): GF {
    if (depth >= maxDepth) { return gfLow; }
    if (depth <= 0) { return gfHigh; }
    const deepRatio = depth / maxDepth; // from 0 == at surface to 1 == at deepest point
    const gf: GF = gfLow * deepRatio + gfHigh * (1 - deepRatio);
    return gf;

}

/**
 * Checks if all compartments are within their modified M-Values at given depth
 * and, if not, returns the list of sursaturated compartments indexes
 */
export function SimulAtDepth(depth: Depth, tensions: Tensions, maxDepth: Depth, GF_low: GFLow, GF_high: GFHigh, surfacePressure: Pressure): Simulation {
    const gf = getInterpolatedGF(depth, maxDepth, GF_low, GF_high);
    const p = depthToPressure(depth, surfacePressure);
    let isSafe = true;
    let satsCompIdx = []; // index of all compartments that are not safe
    for (let i = 0; i < N_COMPARTMENTS; i++) {
        const M_mod = getModifiedMValue(BUEHLMANN[i].A, BUEHLMANN[i].B, p, gf);
        if (tensions[i] > M_mod) {
            isSafe = false;
            satsCompIdx.push(i);
        }
    }
    return { isSafe, satsCompIdx };
}

/**
 * Calculates the complete decompression profile
 * Returns { dtr (TTS), stops [], t_descent, t_dive_total, history }
 */
export function calculatePlan(diveParams: DiveParams): Plan {
    const { bottomTime, maxDepth, gfLow, gfHigh, ascentRate, descentRate, surfacePressure, stopInterval, lastStopDepth, timeStep } = diveParams;
    if (bottomTime <= 0 || maxDepth <= 0) {
        return { dtr: Infinity, stops: [], t_descent: 0, t_dive_total: 0, t_stops: 0, history: [] };
    }

    let tensions = Array(N_COMPARTMENTS).fill(depthToPN2(0, surfacePressure)); // surface tensions
    let stops = [];
    let t_stops = 0; // only stops time
    let dtr = 0; // ascent + stops time
    let t_dive_total = 0; // descent + ascent + stops time
    let history = []; // will store the N2 tensions for each compartment over time

    // Initial state at surface
    history.push({ time: 0, depth: 0, tensions: [...tensions] });

    // 1. Descent phase
    let t_descent = 0;
    let currentDepth = 0;
    let nextDepth = currentDepth + descentRate * timeStep;
    while (nextDepth < maxDepth) { // Make descent during TIME_STEP_MIN to nextDepth
        let PN2_descent = depthToPN2((currentDepth + nextDepth) / 2, surfacePressure);
        tensions = updateAllTensions(tensions, PN2_descent, timeStep);
        t_dive_total += timeStep;
        t_descent += timeStep;
        history.push({ time: t_dive_total, depth: nextDepth, tensions: [...tensions] });
        currentDepth = nextDepth;
        nextDepth = currentDepth + descentRate * timeStep;
    }
    // last bit of descent to maxDepth
    let t_last_bit = (maxDepth - currentDepth) / descentRate;
    t_dive_total += t_last_bit;
    t_descent += t_last_bit;
    let PN2_descent = depthToPN2((currentDepth + maxDepth) / 2, surfacePressure);
    tensions = updateAllTensions(tensions, PN2_descent, t_last_bit);
    history.push({ time: t_dive_total, depth: maxDepth, tensions: [...tensions] });


    // 2. Bottom phase (Bottom Time)
    // bottomTime is interpreted as the total time spent at maxDepth, including descent.
    const t_at_bottom = Math.max(0, bottomTime - t_descent);
    let t_bottom = timeStep;
    while (t_bottom < t_at_bottom) { // Wait at bottom depth during TIME_STEP_MIN
        tensions = updateAllTensions(tensions, depthToPN2(maxDepth, surfacePressure), timeStep);
        t_dive_total += timeStep;
        history.push({ time: t_dive_total, depth: maxDepth, tensions: [...tensions] });
        t_bottom += timeStep;
    } //t_bottom >= t_at_bottom
    t_bottom -= timeStep; // we overstepped the last bit
    t_last_bit = t_at_bottom - t_bottom;
    t_dive_total += t_last_bit;
    tensions = updateAllTensions(tensions, depthToPN2(maxDepth, surfacePressure), t_last_bit);
    history.push({ time: t_dive_total, depth: maxDepth, tensions: [...tensions] });

    // 3. Ascent and stops phase
    currentDepth = maxDepth;

    // Ascent loop
    while (currentDepth >= lastStopDepth) {
        // Find the next stop depth:
        const remaining_to_laststop = currentDepth - lastStopDepth;
        const n_full_intervals = Math.floor((remaining_to_laststop + 0.00001) / stopInterval);
        let nextDepth = lastStopDepth + stopInterval * n_full_intervals;
        // Ensure nextDepth is less than currentDepth to avoid infinite loop
        if (nextDepth == currentDepth) {
            nextDepth = currentDepth - stopInterval;
        }

        // Simulate ascent to nextDepth
        const t_climb = (currentDepth - nextDepth) / ascentRate;
        const PN2_climb = depthToPN2((currentDepth + nextDepth) / 2, surfacePressure);
        let tensions_next = updateAllTensions(tensions, PN2_climb, t_climb);
        let { isSafe, satsCompIdx } = SimulAtDepth(nextDepth, tensions_next, maxDepth, gfLow, gfHigh, surfacePressure);
        if (!isSafe) {
            // Make a stop at currentDepth until it safe to ascend to nextDepth
            let stopTime = 0;
            let saturatedCompartments: Array<CompIdx> = [...satsCompIdx];
            const PN2_stop = depthToPN2(currentDepth, surfacePressure);
            while (!isSafe) {
                // make a single stop step
                stopTime += timeStep;
                t_stops += timeStep;
                dtr += timeStep;
                t_dive_total += timeStep;
                tensions = updateAllTensions(tensions, PN2_stop, timeStep);
                history.push({ time: t_dive_total, depth: currentDepth, tensions: [...tensions] });
                // Check if we can now ascend to nextDepth
                tensions_next = updateAllTensions(tensions, PN2_climb, t_climb);
                ({ isSafe, satsCompIdx } = SimulAtDepth(nextDepth, tensions_next, maxDepth, gfLow, gfHigh, surfacePressure));
                if (!isSafe) {
                    for (const cidx of satsCompIdx) {
                        if (!saturatedCompartments.includes(cidx)) {
                            saturatedCompartments.push(cidx);
                        }
                    }
                }
                // Return an "impossible" plan
                if (stopTime > MAX_STOP_TIME_BEFORE_INFTY) {
                    return { dtr: Infinity, stops: [], t_descent, t_dive_total, t_stops, history };
                }
            }
            stops.push({ depth: currentDepth, time: stopTime, saturatedCompartments });
        }
        // Perform the ascent
        currentDepth = nextDepth;
        tensions = [...tensions_next];
        t_dive_total += t_climb;
        dtr += t_climb;
        history.push({ time: t_dive_total, depth: currentDepth, tensions: [...tensions] });
    }
    // Finish ascent to surface as we have now currentDepth < LAST_STOP_DEPTH
    const t_final_ascent = currentDepth / ascentRate;
    const PN2_final_ascent = depthToPN2((currentDepth + 0) / 2, surfacePressure);
    tensions = updateAllTensions(tensions, PN2_final_ascent, t_final_ascent);
    t_dive_total += t_final_ascent;
    dtr += t_final_ascent;
    history.push({ time: t_dive_total, depth: 0, tensions: [...tensions] });

    // 4 . End of dive at surface waiting 20 minutes
    for (let t = timeStep; t <= SURFACE_WAIT_MIN; t += timeStep) {
        tensions = updateAllTensions(tensions, depthToPN2(0, surfacePressure), timeStep);
        history.push({ time: t_dive_total + t, depth: 0, tensions: [...tensions] });
    }

    return { dtr, stops, t_descent, t_dive_total, t_stops, history };
}
