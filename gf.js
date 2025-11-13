const BUEHLMANN = [ // half-times in minutes, A and B coefficients
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
]

const N_COMPARTMENTS = BUEHLMANN.length;
const HALF_LIFES = BUEHLMANN.map(c => c.t12)
const MAX_STOP_TIME_BEFORE_INFTY = 60 * 24; // minutes

// --- Simulation constants ---
const SURFACE_PRESSURE_BAR = 1.0; // bar
const FN2 = 0.79; // Nitrogen Fraction in air
const ASCENT_RATE = 10; // (m/min)
const DESCENT_RATE = 20; // (m/min)
const GF_INCREMENT = 5
const STOP_INTERVAL = 3; // Stops every 3m
const LAST_STOP_DEPTH = 3;
const SURFACE_WAIT_MIN = 20;
const TIME_STEP = 1; // time step between 2 updates of tensions


// --- Algorithm functions ---
const GF_N_VALUES = Math.floor(100 / GF_INCREMENT)
function depthToPressure(depth) {
    return SURFACE_PRESSURE_BAR + depth / 10;
}
function depthToPN2(depth) {
    return depthToPressure(depth) * FN2;
}

/**
* Returns a single tension after time t at partial pressure P, if starting from tension T0
 * Tn2 = P + (T0 - P) * exp(-k * t)
 */
function updateTension(T0, PN2, t, compartment_t12) {
    const k = Math.log(2) / compartment_t12;
    const T1 = PN2 + (T0 - PN2) * Math.exp(-k * t);
    return T1;
}

/**
 * Computes new tensions for all compartments after time t at PN2
 */
function updateAllTensions(tensions, PN2, t) {
    return HALF_LIFES.map((t12, i) => updateTension(tensions[i], PN2, t, t12));
}


/**
 * Original M_Value (according to constants A and B)
 * pressure is a real pressure, not a partial pressure for N2
*/
function getMValue(A, B, pressure) {
    return A + pressure / B;
}
/**
 * Modified M-Value using gradient factor at current depth (ambient pressure)
 * P_amb is a real pressure, not a partial pressure for N2
 * M_val = pressure + (M_orig - pressure) * GF
 */
function getModifiedMValue(A, B, pressure, GF) {
    const M_orig = getMValue(A, B, pressure)
    const M_mod = pressure + (M_orig - pressure) * GF;
    return M_mod;
}
/**
 * Get the interpolated gradient factor (GF) for a given depth
 */
function getInterpolatedGF(depth, maxDepth, GF_low, GF_high) {
    if (depth >= maxDepth) return GF_low;
    if (depth <= 0) return GF_high;
    return GF_high + (GF_low - GF_high) * (depth / maxDepth);
}

/**
 * Checks if all compartments are within their modified M-Values at given depth
 */
function isSafeAtDepth(depth, tensions, maxDepth, GF_low, GF_high) {
    const GF = getInterpolatedGF(depth, maxDepth, GF_low, GF_high);
    const P = depthToPressure(depth);
    let isSafe = true;
    let satComp = -1; // index of the first compartment that is not safe
    for (let i = 0; i < N_COMPARTMENTS; i++) {
        const M_mod = getModifiedMValue(BUEHLMANN[i].A, BUEHLMANN[i].B, P, GF);
        if (tensions[i] > M_mod) {
            isSafe = false;
            satComp = i;
            break;
        }
    }
    return { isSafe, satComp };
}

/**
 * Calculates the complete decompression profile
 * Returns { dtr (TTS), stops [], t_descent, t_dive_total, history }
 */
function calculatePlan(bottomTime, maxDepth, GF_low, GF_high) {
    if (bottomTime <= 0 || maxDepth <= 0) { // || GF_low > GF_high
        return { dtr: NaN, stops: [], t_descent: 0, t_dive_total: 0, t_stops: 0, history: [] };
    }

    let tensions = Array(N_COMPARTMENTS).fill(depthToPN2(0)); // surface tensions
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
    let nextDepth = currentDepth + DESCENT_RATE * TIME_STEP;
    while (nextDepth < maxDepth) { // Make descent during TIME_STEP_MIN to nextDepth 
        let PN2_descent = depthToPN2((currentDepth + nextDepth) / 2);
        tensions = updateAllTensions(tensions, PN2_descent, TIME_STEP);
        t_dive_total += TIME_STEP;
        t_descent += TIME_STEP;
        history.push({ time: t_dive_total, depth: nextDepth, tensions: [...tensions] });
        currentDepth = nextDepth;
        nextDepth = currentDepth + DESCENT_RATE * TIME_STEP;
    }
    // last bit of descent to maxDepth
    let t_last_bit = (maxDepth - currentDepth) / DESCENT_RATE
    t_dive_total += t_last_bit;
    t_descent += t_last_bit;
    let PN2_descent = depthToPN2((currentDepth + maxDepth) / 2);
    tensions = updateAllTensions(tensions, PN2_descent, t_last_bit);
    history.push({ time: t_dive_total, depth: maxDepth, tensions: [...tensions] });


    // 2. Bottom phase (Bottom Time)
    // bottomTime is interpreted as the total time spent at maxDepth, including descent.
    const t_at_bottom = Math.max(0, bottomTime - t_descent);
    let t_bottom = TIME_STEP;
    while (t_bottom < t_at_bottom) { // Wait at bottom depth during TIME_STEP_MIN
        tensions = updateAllTensions(tensions, depthToPN2(maxDepth), TIME_STEP);
        t_dive_total += TIME_STEP;
        history.push({ time: t_dive_total, depth: maxDepth, tensions: [...tensions] });
        t_bottom += TIME_STEP;
    } //t_bottom >= t_at_bottom
    t_bottom -= TIME_STEP; // we overstepped the last bit
    t_last_bit = t_at_bottom - t_bottom;
    t_dive_total += t_last_bit;
    tensions = updateAllTensions(tensions, depthToPN2(maxDepth), t_last_bit);
    history.push({ time: t_dive_total, depth: maxDepth, tensions: [...tensions] });

    // 3. Ascent and stops phase
    currentDepth = maxDepth;

    // Ascent loop
    while (currentDepth > LAST_STOP_DEPTH) {
        // Find the next stop depth:
        const remaining_to_laststop = currentDepth - LAST_STOP_DEPTH;
        const n_full_intervals = Math.floor((remaining_to_laststop + 0.00001) / STOP_INTERVAL);
        let nextDepth = LAST_STOP_DEPTH + STOP_INTERVAL * n_full_intervals;
        // Ensure nextDepth is less than currentDepth to avoid infinite loop
        if (nextDepth == currentDepth) {
            nextDepth = currentDepth - STOP_INTERVAL;
        }

        // Simulate ascent to nextDepth
        const t_climb = (currentDepth - nextDepth) / ASCENT_RATE;
        const PN2_climb = depthToPN2((currentDepth + nextDepth) / 2);
        let tensions_next = updateAllTensions(tensions, PN2_climb, t_climb);
        let { isSafe, satComp } = isSafeAtDepth(nextDepth, tensions_next, maxDepth, GF_low, GF_high);
        if (!isSafe) {
            // Make a stop at currentDepth until it safe to ascend to nextDepth
            let stopTime = 0;
            let satCompartments = [satComp];
            const PN2_stop = depthToPN2(currentDepth);
            while (!isSafe) {
                // make a single stop step
                stopTime += TIME_STEP;
                t_stops += TIME_STEP;
                dtr += TIME_STEP;
                t_dive_total += TIME_STEP;
                tensions = updateAllTensions(tensions, PN2_stop, TIME_STEP);
                history.push({ time: t_dive_total, depth: currentDepth, tensions: [...tensions] });
                // Check if we can now ascend to nextDepth
                tensions_next = updateAllTensions(tensions, PN2_climb, t_climb);
                ({ isSafe, satComp } = isSafeAtDepth(nextDepth, tensions_next, maxDepth, GF_low, GF_high));
                if (!isSafe && !satCompartments.includes(satComp)) {
                    satCompartments.push(satComp);
                }
                // Return an "impossible" plan 
                if (stopTime > MAX_STOP_TIME_BEFORE_INFTY) {
                    return { dtr: Infinity, stops: [], t_descent, t_dive_total, t_stops, history };
                }
            }
            stops.push({ depth: currentDepth, time: stopTime, saturatedCompartments: satCompartments });
        }
        // Perform the ascent
        currentDepth = nextDepth;
        tensions = [...tensions_next];
        t_dive_total += t_climb;
        dtr += t_climb;
        history.push({ time: t_dive_total, depth: currentDepth, tensions: [...tensions] });
    }
    // Finish ascent to surface as we have now currentDepth > LAST_STOP_DEPTH
    const t_final_ascent = currentDepth / ASCENT_RATE;
    const PN2_final_ascent = depthToPN2((currentDepth + 0) / 2);
    tensions = updateAllTensions(tensions, PN2_final_ascent, t_final_ascent);
    t_dive_total += t_final_ascent;
    dtr += t_final_ascent;
    history.push({ time: t_dive_total, depth: 0, tensions: [...tensions] });

    // 4 . End of dive at surface waiting 20 minutes
    for (let t = TIME_STEP; t <= SURFACE_WAIT_MIN; t += TIME_STEP) {
        tensions = updateAllTensions(tensions, depthToPN2(0), TIME_STEP);
        history.push({ time: t_dive_total + t, depth: 0, tensions: [...tensions] });
    }
    return { dtr, stops, t_descent, t_dive_total, t_stops, history };
}
