import { Tensions, Speed, CompartmentCoefs, Depth, Tension, Minutes, HalfLife, CoefA, CoefB, Pressure, GF, GFLow, GFHigh, Simulation, Plan, PN2, DiveParams, CompIdx, Volume, State, StateHistory } from "./types.js";

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

// --- Dive parameters ---
export const FN2 = 0.79; // Nitrogen Fraction in air
export const TANK_VOLUME: Volume = 12; // 12 liters tank
export const TANK_START_PRESSURE: Pressure = 200;
export const VOLUME_CONSUMPTION_AT_1BAR: Volume = 20; // litres per each minute at sea level surface (from 15 to 25 depending on divers)

function volumeConsumptionAtPressure(pressure: Pressure): Volume {
    const pressureRatio = pressure / 1.0;
    return VOLUME_CONSUMPTION_AT_1BAR * pressureRatio;
}
function updateTankPressure(tankPressure: Pressure, time: Minutes, pressure: Pressure): Pressure {
    const volumeConsumed = volumeConsumptionAtPressure(pressure) * time;
    const pressureConsumed = volumeConsumed / TANK_VOLUME;
    const newTankPressure = tankPressure - pressureConsumed;
    return newTankPressure >= 0 ? newTankPressure : 0;
}

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
function assert(condition: boolean, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

/**
 * Returns a single tension after time t at partial pressure P, if starting from tension T0
 * Tn2 = P + (T0 - P) * exp(-k * t)
 */
export function updateTension(t0: Tension, pn2: PN2, t: Minutes, compartment_t12: HalfLife): Tension {
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
export function getMValue(A: CoefA, B: CoefB, pressure: Pressure): Tension {
    const M_orig: Tension = A + pressure / B;
    assert(M_orig >= pressure, `M Value should be > pressure`);
    return M_orig
}

export function getMValues(pressure: Pressure): Tensions {
    return BUEHLMANN.map(c => getMValue(c.A, c.B, pressure));
}

/**
 * Modified M-Value using gradient factor at current pressure
 * Modified M_value is a lower limit for tension in a compartment
 * pressure is a real pressure, not a partial pressure for N2
*/
export function getModifiedMValue(A: CoefA, B: CoefB, pressure: Pressure, GF: GF): Tension {
    const M_orig = getMValue(A, B, pressure);
    const M_mod = M_orig * GF + pressure * (1 - GF); // same as pressure + (M_orig - pressure) * GF;
    assert(M_mod <= M_orig, `We should have M_mod <= M_orig`);
    assert(M_mod >= pressure, `we should have M_mod >= pressure`);
    return M_mod;
}

export function getModifiedMValues(pressure: Pressure, GF: GF): Tensions {
    return BUEHLMANN.map(c => getModifiedMValue(c.A, c.B, pressure, GF));
}

/**
 * Get the interpolated gradient factor (GF) for a given depth
 * gfLow = GF at max depth
 * gfHigh = GF at surface
 */
export function getInterpolatedGF(depth: Depth, firstStopDepth: Depth | null, gfLow: GFLow, gfHigh: GFHigh): GF {
    if (firstStopDepth === null) { // until first stop do only use gfLow
        return gfLow;
    } else { // regular interpolation between gfLow and gfHigh
        if (depth >= firstStopDepth) { return gfLow; }
        if (depth <= 0) { return gfHigh; }
        const deepRatio = depth / firstStopDepth; // from 0 == at surface to 1 == at deepest point
        const gf: GF = gfLow * deepRatio + gfHigh * (1 - deepRatio);
        return gf;
    }
}

export function isPlanBreachMValues(plan: Plan): boolean {
    const tensions = plan.history.map(state => state.tensions);
    const mValues = plan.history.map(state => state.mValues);
    const isValid = tensions.every((tensionsAtTime, idx) => {
        return tensionsAtTime.every((tension, compIdx) => tension <= mValues[idx][compIdx]);
    });
    return !isValid;
}

export function isPlanBreachModifiedMValues(plan: Plan): boolean {
    const tensions = plan.history.map(state => state.tensions);
    const modMValues = plan.history.map(state => state.modMValues);
    const isValid = tensions.every((tensionsAtTime, idx) => {
        return tensionsAtTime.every((tension, compIdx) => tension <= modMValues[idx][compIdx]);
    });
    return !isValid;
}


/**
 * Checks if all compartments are within their modified M-Values at given depth
 * and, if not, returns the list of sursaturated compartments indexes
 */
export function SimulAtDepth(depth: Depth, tensions: Tensions, firstStopDepth: Depth | null, gfLow: GFLow, gfHigh: GFHigh, surfacePressure: Pressure): Simulation {
    const gf = getInterpolatedGF(depth, firstStopDepth, gfLow, gfHigh);
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
    let firstStopDepth: Depth | null = null; // until first stop do only use gfLow

    let tensions = Array(N_COMPARTMENTS).fill(depthToPN2(0, surfacePressure)); // surface tensions
    let mValues = getMValues(surfacePressure);
    let gf = getInterpolatedGF(SURFACE_DEPTH, firstStopDepth, gfLow, gfHigh);
    let modMValues = getModifiedMValues(surfacePressure, gf);
    let stops = [];
    let t_stops = 0; // only stops time
    let dtr = 0; // ascent + stops time
    let t_dive_total = 0; // descent + ascent + stops time
    let history = []; // will store the N2 tensions for each compartment over time
    let tankPressure = TANK_START_PRESSURE;

    // Initial state at surface
    let state = { time: 0, depth: 0, tensions: [...tensions], tankPressure, pressure: surfacePressure, mValues: [...mValues], modMValues: [...modMValues] };
    history.push(state);

    // 1. Descent phase
    let t_descent = 0;
    let currentDepth = 0;
    let nextDepth = currentDepth + descentRate * timeStep;
    while (nextDepth < maxDepth) { // Make descent during TIME_STEP_MIN to nextDepth
        t_dive_total += timeStep;
        t_descent += timeStep;
        const depthStep = (nextDepth - currentDepth) / 2; // avg depth during the step
        const PN2Step = depthToPN2(depthStep, surfacePressure);
        const pressureStep = depthToPressure(depthStep, surfacePressure);
        tankPressure = updateTankPressure(tankPressure, timeStep, pressureStep);
        tensions = updateAllTensions(tensions, PN2Step, timeStep);
        mValues = getMValues(pressureStep);
        let gf = getInterpolatedGF(pressureStep, firstStopDepth, gfLow, gfHigh);
        let modMValues = getModifiedMValues(pressureStep, gf);
        state = { time: t_dive_total, depth: nextDepth, tensions: [...tensions], tankPressure, pressure: pressureStep, mValues: [...mValues], modMValues: [...modMValues] };
        history.push(state);
        currentDepth = nextDepth;
        nextDepth = currentDepth + descentRate * timeStep;
    }
    // last bit of descent to maxDepth
    let t_last_bit = (maxDepth - currentDepth) / descentRate;
    t_dive_total += t_last_bit;
    t_descent += t_last_bit;
    const depth_last_bit = (currentDepth + maxDepth) / 2;
    const PN2_last_bit = depthToPN2(depth_last_bit, surfacePressure);
    const pressure_last_bit = depthToPressure(depth_last_bit, surfacePressure);
    tankPressure = updateTankPressure(tankPressure, t_last_bit, pressure_last_bit);
    tensions = updateAllTensions(tensions, PN2_last_bit, t_last_bit);
    mValues = getMValues(pressure_last_bit);
    gf = getInterpolatedGF(pressure_last_bit, firstStopDepth, gfLow, gfHigh);
    modMValues = getModifiedMValues(pressure_last_bit, gf);
    state = { time: t_dive_total, depth: maxDepth, tensions: [...tensions], tankPressure, pressure: pressure_last_bit, mValues: [...mValues], modMValues: [...modMValues] };
    history.push(state);

    // 2. Bottom phase (Bottom Time)
    // bottomTime is interpreted as the total time spent at maxDepth, including descent.
    const t_at_bottom = Math.max(0, bottomTime - t_descent);
    const maxPressure = depthToPressure(maxDepth, surfacePressure);
    const maxPN2 = depthToPN2(maxDepth, surfacePressure);
    let t_bottom_curr = timeStep;
    while (t_bottom_curr < t_at_bottom) {
        t_dive_total += timeStep;
        tankPressure = updateTankPressure(tankPressure, timeStep, maxPressure);
        tensions = updateAllTensions(tensions, maxPN2, timeStep);
        mValues = getMValues(maxPressure);
        gf = getInterpolatedGF(maxPressure, firstStopDepth, gfLow, gfHigh);
        modMValues = getModifiedMValues(maxPressure, gf);
        state = { time: t_dive_total, depth: maxDepth, tensions: [...tensions], tankPressure, pressure: maxPressure, mValues: [...mValues], modMValues: [...modMValues] };
        history.push(state);
        t_bottom_curr += timeStep;
    } //t_bottom >= t_at_bottom
    t_bottom_curr -= timeStep; // we overstepped the last bit
    t_last_bit = t_at_bottom - t_bottom_curr;
    t_dive_total += t_last_bit;
    tankPressure = updateTankPressure(tankPressure, t_last_bit, maxPressure);
    tensions = updateAllTensions(tensions, maxPN2, t_last_bit);
    mValues = getMValues(maxPressure);
    gf = getInterpolatedGF(maxPressure, firstStopDepth, gfLow, gfHigh);
    modMValues = getModifiedMValues(maxPressure, gf);
    state = { time: t_dive_total, depth: maxDepth, tensions: [...tensions], tankPressure, pressure: maxPressure, mValues: [...mValues], modMValues: [...modMValues] };
    history.push(state);

    // 3. Ascent and stops phase
    currentDepth = maxDepth;
    // Ascent loop
    while (currentDepth >= lastStopDepth) {
        // Find the next stop depth:
        const remaining_to_laststop = currentDepth - lastStopDepth;
        const n_full_intervals = Math.floor((remaining_to_laststop - 0.00001) / stopInterval);
        let nextDepth = lastStopDepth + stopInterval * n_full_intervals;
        if (currentDepth == lastStopDepth) {
            nextDepth = SURFACE_DEPTH;
        }

        // Simulate ascent to nextDepth at ascentRate
        const t_ascend = (currentDepth - nextDepth) / ascentRate;
        const depth_ascend = (nextDepth + currentDepth) / 2; // avg depth during the climb
        const PN2_ascend = depthToPN2(depth_ascend, surfacePressure);
        const pressure_ascend = depthToPressure(depth_ascend, surfacePressure);

        let tensions_next = updateAllTensions(tensions, PN2_ascend, t_ascend);
        let { isSafe, satsCompIdx } = SimulAtDepth(nextDepth, tensions_next, firstStopDepth, gfLow, gfHigh, surfacePressure);
        if (!isSafe) {
            // Make a stop at currentDepth until it safe to ascend to nextDepth
            if (firstStopDepth === null) {
                firstStopDepth = currentDepth;
            }
            let stopTime = 0;
            let saturatedCompartments: Array<CompIdx> = [...satsCompIdx];
            const PN2_stop = depthToPN2(currentDepth, surfacePressure);
            const pressure_stop = depthToPressure(currentDepth, surfacePressure);
            while (!isSafe) {
                // make a single stop step
                stopTime += timeStep;
                t_stops += timeStep;
                dtr += timeStep;
                t_dive_total += timeStep;
                tankPressure = updateTankPressure(tankPressure, timeStep, pressure_stop);
                tensions = updateAllTensions(tensions, PN2_stop, timeStep);
                mValues = getMValues(pressure_stop);
                gf = getInterpolatedGF(pressure_stop, firstStopDepth, gfLow, gfHigh);
                modMValues = getModifiedMValues(pressure_stop, gf);
                state = { time: t_dive_total, depth: currentDepth, tensions: [...tensions], tankPressure, pressure: pressure_stop, mValues: [...mValues], modMValues: [...modMValues] };
                history.push(state);

                // Check if we can now ascend to nextDepth
                tensions_next = updateAllTensions(tensions, PN2_ascend, t_ascend);
                ({ isSafe, satsCompIdx } = SimulAtDepth(nextDepth, tensions_next, firstStopDepth, gfLow, gfHigh, surfacePressure));
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

        // Perform the ascent to next depth now that it's safe
        currentDepth = nextDepth;
        tankPressure = updateTankPressure(tankPressure, t_ascend, pressure_ascend);
        tensions = updateAllTensions(tensions, PN2_ascend, t_ascend);
        dtr += t_ascend;
        t_dive_total += t_ascend;
        mValues = getMValues(pressure_ascend);
        gf = getInterpolatedGF(pressure_ascend, firstStopDepth, gfLow, gfHigh);
        modMValues = getModifiedMValues(pressure_ascend, gf);
        state = { time: t_dive_total, depth: currentDepth, tensions: [...tensions], tankPressure, pressure: pressure_ascend, mValues: [...mValues], modMValues: [...modMValues] };
        history.push(state);
    }
    // Finish ascent to surface as we have now currentDepth < LAST_STOP_DEPTH
    const t_final_ascent = currentDepth / ascentRate;
    const PN2_final_ascent = depthToPN2((currentDepth + 0) / 2, surfacePressure);
    const pressure__final_ascend = depthToPressure((currentDepth + 0) / 2, surfacePressure);
    tankPressure = updateTankPressure(tankPressure, t_final_ascent, pressure__final_ascend);
    tensions = updateAllTensions(tensions, PN2_final_ascent, t_final_ascent);
    dtr += t_final_ascent;
    t_dive_total += t_final_ascent;
    mValues = getMValues(pressure__final_ascend);
    gf = getInterpolatedGF(pressure__final_ascend, firstStopDepth, gfLow, gfHigh);
    modMValues = getModifiedMValues(pressure__final_ascend, gf);
    state = { time: t_dive_total, depth: SURFACE_DEPTH, tensions: [...tensions], tankPressure, pressure: pressure__final_ascend, mValues: [...mValues], modMValues: [...modMValues] };
    history.push(state);

    // 4 . End of dive at surface waiting 20 minutes
    for (let t = timeStep; t <= SURFACE_WAIT_MIN; t += timeStep) {
        tankPressure = updateTankPressure(tankPressure, timeStep, surfacePressure);
        tensions = updateAllTensions(tensions, depthToPN2(SURFACE_DEPTH, surfacePressure), timeStep);
        mValues = getMValues(surfacePressure);
        gf = getInterpolatedGF(surfacePressure, firstStopDepth, gfLow, gfHigh);
        modMValues = getModifiedMValues(surfacePressure, gf);
        state = { time: t_dive_total, depth: SURFACE_DEPTH, tensions: [...tensions], tankPressure, pressure: surfacePressure, mValues: [...mValues], modMValues: [...modMValues] };
        history.push(state);
    }

    return { dtr, stops, t_descent, t_dive_total, t_stops, history };
}

/**
 * Calculates the ceiling profile from a given Plan.
 * At each time point, the ceiling is the maximum of all compartment ceilings.
 * Ceiling for a compartment is defined as the pressure at which the compartment tension 
 * would be equals the M-Value, ie the maximum tolerated tension in that compartment.
 * Teleporting above the ceiling would be unsafe.
 * 
 * Calculations: M = A + P/B and we set M==T so we have P_ceiling = (T - A) * B
 */
export function calculateCeilings(history: StateHistory, surfacePressure: Pressure): Array<Pressure> {
    function ceiling(tensions: Tensions): Pressure {
        let maxCeilingPressure = surfacePressure;
        tensions.forEach((tension, i) => {
            const A = BUEHLMANN[i].A;
            const B = BUEHLMANN[i].B;
            const ceilingPressure = (tension - A) * B;
            if (ceilingPressure > maxCeilingPressure) {
                maxCeilingPressure = ceilingPressure;
            }
        });
        return maxCeilingPressure;
    }
    return history.map((state: State) => ceiling(state.tensions));
}

/**
 * Calculates the GF based ceiling profile from a given Plan.
 * At each time point, the ceiling is the maximum of all compartment ceilings.
 * GFCeiling for a compartment is defined as the pressure at which the compartment tension 
 * would be equals the modified M-Value, ie the maximum tolerated tension in that compartment.
 * Teleporting above the ceiling would be unsafe.
 * 
 */
export function calculateGFCeilings(history: StateHistory, diveParams: DiveParams): Array<Pressure> {
    const { maxDepth, gfLow, gfHigh, surfacePressure } = diveParams as DiveParams;
    return history.map(entry => {
        let maxCeilingPressure = surfacePressure;
        entry.tensions.forEach((tension, i) => {
            const A = BUEHLMANN[i].A;
            const B = BUEHLMANN[i].B;
            const K = 1 / B - 1;
            const h = gfHigh;
            const md = (gfLow - gfHigh) / maxDepth;

            // Quadratic equation coefficients for Depth D: a*D^2 + b*D + c = 0
            // Derived from T = M_mod(P, GF(D)) where P = Psurf + D/10 and GF(D) = md*D + h
            const a = 0.1 * md * K;
            const b = md * A + 0.1 + K * (surfacePressure * md + 0.1 * h);
            const c = h * A + surfacePressure * (1 + h * K) - tension;

            let D = 0;
            if (Math.abs(a) < 1e-9) {
                // Linear case (GF_low == GF_high)
                if (Math.abs(b) > 1e-9) {
                    D = -c / b;
                } else {
                    D = 0; // Should not happen for realistic parameters
                }
            } else {
                const delta = b * b - 4 * a * c;
                if (delta >= 0) {
                    // We want the root that corresponds to the physical solution.
                    // For md < 0 (usual case), a < 0. The correct root is (-b + sqrt(delta)) / 2a
                    D = (-b + Math.sqrt(delta)) / (2 * a);
                } else {
                    D = 0; // Should not happen
                }
            }

            // If calculated D is deeper than maxDepth, we are in the constant GF_low region
            if (D > maxDepth) {
                // Solve linear equation with constant GF = gfLow
                // T = GF_low * A + P * (1 + GF_low * K)
                // P = (T - GF_low * A) / (1 + GF_low * K)
                const P = (tension - gfLow * A) / (1 + gfLow * K);
                D = (P - surfacePressure) * 10;
            }

            const ceilingPressure = depthToPressure(D, surfacePressure);
            if (ceilingPressure > maxCeilingPressure) {
                maxCeilingPressure = ceilingPressure;
            }
        });
        return maxCeilingPressure;
    });
}
