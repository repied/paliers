const BUEHLMANN_CONSTANTS = [
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

// --- Simulation constants ---
const GF_INCREMENT = 5
const GF_N_INCR = Math.floor(100 / GF_INCREMENT)
const AMBIENT_PRESSURE_BAR = 1.0; // bar
const FN2 = 0.79; // Nitrogen Fraction in air
const ASCENT_RATE = 10; // (m/min)
const DESCENT_RATE = 20; //  (m/min)
const STOP_INTERVAL = 3; // Stops every 3m



// --- Algorithm functions ---
function depthToPressure(depth) {
    return AMBIENT_PRESSURE_BAR + depth / 10;
}

/**
 * Saturation/desaturation equation
 * Tn2 = P_alv + (T0 - P_alv) * exp(-k * t)
 */
function schreinerEquation(T0, P_alv, t, t_half) {
    const k = Math.log(2) / t_half;
    return P_alv + (T0 - P_alv) * Math.exp(-k * t);
}

/**
 * Modified M-Value 
 * M_val = P_amb + (M_orig - P_amb) * GF
 */
function getModifiedMValue(A, B, P_amb, GF) {
    // Original M_Value (according to constants A and B)
    const M_orig = A + P_amb / B;
    // M_Value modified by Gradient Factor
    return P_amb + (M_orig - P_amb) * GF;
}

function getInterpolatedGF(d, d_start, GF_low, GF_high) {
    if (d_start === 0) return GF_high; // Case without stop
    if (d >= d_start) return GF_low;
    if (d <= 0) return GF_high;
    // Linear interpolation
    return GF_high + (GF_low - GF_high) * (d / d_start);
}

/**
 * Calculates the complete decompression profile
 * Returns { dtr (TTS), stops [], t_descent, totalDiveTime }
 */
function calculatePlan(bottomTime, maxDepth, GF_low, GF_high) {
    if (bottomTime <= 0 || maxDepth <= 0 || GF_low > GF_high) {
        return { dtr: NaN, stops: [], t_descent: 0, totalDiveTime: 0 };
    }

    let Tn2 = Array(16).fill(AMBIENT_PRESSURE_BAR * FN2); // Initial tension (surface)
    let dtr = 0;
    let stops = [];
    let totalDiveTime = 0;

    // 1. Descent phase
    const t_descent = maxDepth / DESCENT_RATE;
    totalDiveTime += t_descent;
    let P_alv_descent = depthToPressure(maxDepth / 2) * FN2; // Average P_N2
    for (let i = 0; i < 16; i++) {
        Tn2[i] = schreinerEquation(Tn2[i], P_alv_descent, t_descent, BUEHLMANN_CONSTANTS[i].t12);
    }

    // 2. Bottom phase (Bottom Time)
    totalDiveTime += bottomTime;
    const P_alv_bottom = depthToPressure(maxDepth) * FN2;
    for (let i = 0; i < 16; i++) {
        Tn2[i] = schreinerEquation(Tn2[i], P_alv_bottom, bottomTime, BUEHLMANN_CONSTANTS[i].t12);
    }

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
        // Approximation: average P_alv over the segment
        const P_alv_climb = depthToPressure((currentDepth + nextDepth) / 2) * FN2;
        let Tn2_at_next_stop = [];
        for (let i = 0; i < 16; i++) {
            Tn2_at_next_stop[i] = schreinerEquation(Tn2[i], P_alv_climb, t_climb, BUEHLMANN_CONSTANTS[i].t12);
        }

        // Check if a stop is needed at 'nextDepth'
        let stopTime = 0;
        let isSafeToAscend = false;

        // Stay at the stop (nextDepth) until it is safe
        while (!isSafeToAscend) {
            // If at the surface (nextDepth = 0), no stop
            if (nextDepth === 0) break;

            // Calculate interpolated GF at 'nextDepth'
            // Note: firstStopDepth is 0 until the first stop is found
            const GF_inter = getInterpolatedGF(nextDepth, firstStopDepth, GF_low, GF_high);

            // Check if ALL compartments are below their M-Value
            isSafeToAscend = true;
            for (let i = 0; i < 16; i++) {
                const M_mod = getModifiedMValue(BUEHLMANN_CONSTANTS[i].A, BUEHLMANN_CONSTANTS[i].B, P_next, GF_inter);
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
                const P_alv_stop = P_next * FN2;
                for (let i = 0; i < 16; i++) {
                    Tn2_at_next_stop[i] = schreinerEquation(Tn2_at_next_stop[i], P_alv_stop, 1, BUEHLMANN_CONSTANTS[i].t12);
                }

                // Infinite loop safety (impossible profile)
                if (stopTime > 300) {
                    plan = { dtr: Infinity, stops: [], t_descent, totalDiveTime };
                    return plan;
                }
            }
        } // End of stop loop (while !isSafeToAscend)

        // Record the stop (if there was one)
        if (stopTime > 0) {
            stops.push({ depth: nextDepth, time: stopTime });
        }

        // Ascent to next stop
        dtr += t_climb;
        totalDiveTime += t_climb;
        Tn2 = [...Tn2_at_next_stop]; // Update tensions
        currentDepth = nextDepth;

    } // End of ascent loop (while currentDepth > 0)

    // Stops are already in order (deepest -> surface)
    plan = { dtr, stops, t_descent, totalDiveTime };
    return plan;
}
