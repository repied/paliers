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

// --- Simulation constants ---
const GF_INCREMENT = 5
const GF_N_INCR = Math.floor(100 / GF_INCREMENT)
const SURFACE_PRESSURE_BAR = 1.0; // bar
const FN2 = 0.79; // Nitrogen Fraction in air
const ASCENT_RATE = 10; // (m/min)
const DESCENT_RATE = 20; //  (m/min)
const STOP_INTERVAL = 3; // Stops every 3m



// --- Algorithm functions ---
function depthToPressure(depth) {
    return SURFACE_PRESSURE_BAR + depth / 10;
}
function depthToPN2(depth) {
    return depthToPressure(depth) * FN2;
}

/**
 * Saturation/desaturation equation
 * returns Tn2 after time t at partial pressure P, if starting from tension T0
 * Tn2 = P + (T0 - P) * exp(-k * t)
 */
function updateTension(T0, PN2, t, compartment_t12) {
    const k = Math.log(2) / compartment_t12;
    const T1 = PN2 + (T0 - PN2) * Math.exp(-k * t);
    return T1;
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
    // if (maxDepth === 0) return GF_high; // TODO should not be useful
    if (depth >= maxDepth) return GF_low;
    if (depth <= 0) return GF_high;
    // Linear interpolation
    return GF_high + (GF_low - GF_high) * (depth / maxDepth);
}

/**
 * Calculates the complete decompression profile
 * Returns { dtr (TTS), stops [], t_descent, totalDiveTime, history }
 */
function calculatePlan(bottomTime, maxDepth, GF_low, GF_high) {
    if (bottomTime <= 0 || maxDepth <= 0) { // || GF_low > GF_high
        return { dtr: NaN, stops: [], t_descent: 0, totalDiveTime: 0, history: [] };
    }

    let Tn2 = Array(N_COMPARTMENTS).fill(depthToPN2(0)); // Initial tension (surface)
    let dtr = 0;
    let stops = [];
    let totalDiveTime = 0;
    let history = []; // will store the tn2 for each compartment over time
    const halfTimes = BUEHLMANN.map(c => c.t12);

    // Initial state at surface
    history.push({ time: 0, depth: 0, Tn2: [...Tn2] });

    // 1. Descent phase
    const t_descent = maxDepth / DESCENT_RATE;
    totalDiveTime += t_descent;
    let PN2_descent = depthToPN2(maxDepth / 2); // Average P_N2 TODO sample all minutes
    for (let i = 0; i < N_COMPARTMENTS; i++) {
        Tn2[i] = updateTension(Tn2[i], PN2_descent, t_descent, halfTimes[i]);
    }
    history.push({ time: totalDiveTime, depth: maxDepth, Tn2: [...Tn2] });


    // 2. Bottom phase (Bottom Time) TODO sample all minutes
    // bottomTime is interpreted as the total time spent at maxDepth, including descent.
    const durationAtBottom = Math.max(0, bottomTime - t_descent);
    totalDiveTime += durationAtBottom;
    const PN2_bottom = depthToPN2(maxDepth);
    for (let i = 0; i < N_COMPARTMENTS; i++) {
        Tn2[i] = updateTension(Tn2[i], PN2_bottom, durationAtBottom, halfTimes[i]);
    }
    history.push({ time: totalDiveTime, depth: maxDepth, Tn2: [...Tn2] });


    // 3. Ascent and stops phase
    let currentDepth = maxDepth;
    let firstStopDepth = 0; // Depth of the first stop (for GF interpolation)

    // Ascent loop, stop by stop (every 3m)
    while (currentDepth > 0) {
        const nextDepth = Math.max(0, currentDepth - STOP_INTERVAL);
        const P_next = depthToPressure(nextDepth);

        // Ascent time (without stop) to the next stop
        const t_climb = (currentDepth - nextDepth) / ASCENT_RATE;

        // Desaturation during ascent (segment)
        // Approximation: average P over the segment
        const PN2_climb = depthToPN2((currentDepth + nextDepth) / 2);
        let Tn2_at_next_stop = [];
        for (let i = 0; i < N_COMPARTMENTS; i++) {
            Tn2_at_next_stop[i] = updateTension(Tn2[i], PN2_climb, t_climb, halfTimes[i]);
        }

        // Update totalDiveTime and dtr for the ascent segment
        totalDiveTime += t_climb;
        dtr += t_climb;
        history.push({ time: totalDiveTime, depth: nextDepth, Tn2: [...Tn2_at_next_stop] });


        // Check if a stop is needed at 'nextDepth'
        let stopTime = 0;
        let isSafeToAscend = false;

        // Stay at the stop (nextDepth) until it is safe
        while (!isSafeToAscend) {
            // If at the surface (nextDepth = 0), no stop
            if (nextDepth === 0) break;

            // Calculate interpolated GF at 'nextDepth'
            // Note: firstStopDepth is 0 until the first stop is found
            const GF_inter = getInterpolatedGF(nextDepth, maxDepth, GF_low, GF_high);

            // Check if ALL compartments are below their M-Value
            isSafeToAscend = true;
            for (let i = 0; i < N_COMPARTMENTS; i++) {
                const M_mod = getModifiedMValue(BUEHLMANN[i].A, BUEHLMANN[i].B, P_next, GF_inter);
                if (Tn2_at_next_stop[i] > M_mod) {
                    isSafeToAscend = false;
                    break;
                }
            }

            if (!isSafeToAscend) {
                // Stop required
                if (firstStopDepth === 0) {
                    firstStopDepth = nextDepth; // Just found the first stop
                }

                stopTime += 1; // Stay 1 minute
                dtr += 1;
                totalDiveTime += 1;

                // Desaturation during 1 min at stop 'nextDepth'
                const P_stop = P_next * FN2;
                for (let i = 0; i < N_COMPARTMENTS; i++) {
                    Tn2_at_next_stop[i] = updateTension(Tn2_at_next_stop[i], P_stop, 1, halfTimes[i]);
                }
                history.push({ time: totalDiveTime, depth: nextDepth, Tn2: [...Tn2_at_next_stop] });


                // Infinite loop safety (impossible profile)
                if (stopTime > 300) {
                    // Return an "impossible" plan
                    return { dtr: Infinity, stops: [], t_descent, totalDiveTime, history };
                }
            }
        } // End of stop loop (while !isSafeToAscend)

        // Record the stop (if there was one)
        if (stopTime > 0) {
            stops.push({ depth: nextDepth, time: stopTime });
        }

        // Tn2 is already updated in Tn2_at_next_stop
        Tn2 = [...Tn2_at_next_stop]; // Update tensions for the next segment
        currentDepth = nextDepth;

    } // End of ascent loop (while currentDepth > 0)

    // Stops are already in order (deepest -> surface)
    plan = { dtr, stops, t_descent, totalDiveTime, history };
    return plan;
}
