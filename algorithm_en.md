---
title: Algorithm
---

This document describes the decompression algorithm implemented in this [tool](./index.html), which is based on the **Bühlmann ZHL-16C model** with Gradient Factors (GF). The algorithm simulates the absorption and release of inert gas (Nitrogen) in 16 theoretical tissue compartments during a dive and calculates a safe decompression profile.

# Concepts

*   **Bühlmann ZHL-16C Model**: This model uses 16 tissue compartments (tissue types), each characterized by a half-time (t½), and 'A' and 'B' coefficients. These parameters define how quickly a compartment absorbs and releases inert gas, and its maximum allowable inert gas tension (M-value) at a given ambient pressure.
*   **Partial Pressure of Nitrogen (PN2)**: The amount of nitrogen in the breathing gas (air, 79% N2) at a given depth. 
*   **Tissue Tension**: The partial pressure of nitrogen within a tissue compartment.
*   **M-Values**: The maximum allowable inert gas tension in a tissue compartment at a given ambient pressure. 
*   **Gradient Factors (GF)**: A safety factor applied to the M-values. `GF_low` is applied at maximum depth, and `GF_high` at the surface. We can linearly interpolate the GF between these two values based on the current depth.
*   **Modified M-Values**: The M-values adjusted by the Gradient Factors, effectively creating a "corridor"  within which the tissue tension must remain.

#  Dive Profile Calculation 

## a. Initialization

All 16 compartments start with tensions equal to the surface PN2 (0.79 bar). `bottomTime`, `maxDepth`, `GF_low`, and `GF_high` are taken as input.

## b. Descent Phase

*   The diver descends from the surface to `maxDepth` at a constant `DESCENT_RATE`.
*   During descent, compartment tensions are continuously updated every minute (`TIME_STEP`).

## c. Bottom Phase

*   After reaching `maxDepth`, the diver remains at this depth for the `bottomTime` (minus the descent time).
*   Compartment tensions continue to load (increase) based on the PN2 at `maxDepth`.

<div style="text-align: center;">
  <a href="./index.html">
    <img src="./media/simple_profile.png" alt="Simple profile" width="500" />
  </a>
</div>
On this plot we see the tensions of 3 compartments (the fastest, the slowest and an intermediate one) raising during descent and bottom time, the decreasing after the ascent to the surface.

## d. Ascent and Stops Phase

This is the most critical part of the algorithm, where decompression stops are determined. The diver ascends iteratively from `maxDepth` towards the surface (`LAST_STOP_DEPTH`, typically 3m).

1.  **Determine Next Target Depth**: The algorithm calculates the next potential stop depth, typically in `STOP_INTERVAL` (e.g., 3m) increments.
2.  **Simulate Ascent to Next Depth**: It first simulates an ascent to this `nextDepth` at the `ASCENT_RATE` and calculates the resulting tensions (`tensions_next`).
3.  **Check for Safety**: `isSafeAtDepth` is called to check if all compartments would be within their `modified M-Values` at this `nextDepth`.
    *   The `GF` used for the modified M-value is interpolated based on the `currentDepth` and `maxDepth`.
    *   If any compartment's tension exceeds its modified M-value, it's considered unsafe to ascend directly.
4.  **Decompression Stop (if unsafe)**:
    *   If unsafe, a stop is initiated at the `currentDepth`.
    *   The diver remains at `currentDepth`, and tensions are updated in `TIME_STEP` increments.
    *   The algorithm continuously re-checks if it's safe to ascend to `nextDepth` after each `TIME_STEP`.
    *   Once it's safe, the stop ends, and the stop details are added to the `stops` array.
5.  **Perform Ascent**: The diver then ascends to the `nextDepth`. `
6.  **Repeat**: Steps 1-5 are repeated until `currentDepth` is less than or equal to `LAST_STOP_DEPTH`.
7.  Finish the ascent

## e. Final Ascent to Surface

*   Once the diver reaches `LAST_STOP_DEPTH`, a final ascent to the surface (0m) is performed.
*   Tensions are updated, and `t_dive_total` and `dtr` are incremented.

## f. Surface Wait

*   After reaching the surface, the simulation continues for `SURFACE_WAIT_MIN` (e.g., 20 minutes).


## g. Visualisation
<div style="text-align: center;">
  <a href="./index.html">
    <img src="./media/corridor.png" alt="Safe corridor" width="500" />
  </a>
</div>
We can see the dive plan in the `(p_N2, tension)` space. The dive starts in the lower left, goes to the lower right during descent. During bottom time, the tension raises (vertical as the depth is constant). Then we can ascend until we reach the modified M-value (blue dashed lines), so we see a horizontal leftward move. Before hitting the modified M-value we make a stop to decrease tension, and the resume the ascent to reach a second stop in this example.
