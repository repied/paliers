---
title: Buhlmann Pseudo code
toc: true
--- 

ALGORITHM_SETUP:

    // Define 16 Tissue Compartments (T_k)
    Define HALF_TIMES[16] for N2 (e.g., 4 min to 635 min)
    Define M_VALUES_A[16] and M_VALUES_B[16] (Bühlmann coefficients)

    // Constants
    Define P_SURFACE = 1.0 bar
    Define F_N2_MIX (e.g., 0.79 for Air)
    Define TIME_STEP = 1 minute // Time increment for simulation

INITIALIZE_CALCULATOR:

    // Initialize the nitrogen pressure (P_tiss) in all 16 tissues (T_k)
    For k from 1 to 16:
        P_tiss[k] = P_SURFACE * F_N2_MIX

FUNCTION SIMULATE_STEP (Depth_Start, Depth_End, Duration_min):

    Calculate Pressure_Start = Depth_to_Pressure(Depth_Start)
    Calculate Pressure_End = Depth_to_Pressure(Depth_End)
    
    Calculate Pressure_Change_Rate = (Pressure_End - Pressure_Start) / Duration_min

    For each minute (t) in Duration_min:

        // 1. Determine ambient and inspired pressure at this minute
        Pressure_Ambient = Pressure_Start + (t * Pressure_Change_Rate)
        Pressure_Inspired_N2 = Pressure_Ambient * F_N2_MIX
        
        // 2. Calculate the updated tissue load for all 16 compartments
        For k from 1 to 16:
            
            // Calculate Lambda (rate constant)
            Lambda_k = LN(2) / HALF_TIMES[k]

            // Bühlmann/Haldane formula for tissue loading:
            P_tiss_new[k] = Pressure_Inspired_N2 + 
                            (P_tiss_old[k] - Pressure_Inspired_N2) * E ^ (-Lambda_k * TIME_STEP)
            
            // Update pressure for the next minute
            P_tiss_old[k] = P_tiss_new[k]
        
        Log Dive Data (Time, Depth, Tissue Pressures)
        
    Return Final_Time










FUNCTION CALCULATE_DECOMPRESSION_PLAN (Current_Time):

    // 1. Determine the starting depth for decompression (deepest multiple of PALIER_STEP)
    Current_Stop_Depth = Round_Up_to_Nearest_Multiple(Last_Dive_Depth, PALIER_STEP)
    Deco_Plan = Empty_List
    
    // 2. Loop until the surface stop (3m) is completed
    While Current_Stop_Depth >= PALIER_STEP:
        
        // --- A. Ascent to Current Stop Depth (at max ascent rate) ---
        If Last_Logged_Depth > Current_Stop_Depth:
            Time_to_Ascend = (Last_Logged_Depth - Current_Stop_Depth) / MAX_ASCENT_RATE
            SIMULATE_STEP (Last_Logged_Depth, Current_Stop_Depth, Time_to_Ascend)
        
        // --- B. Calculate Stop Time at Current_Stop_Depth ---
        Stop_Time = 0
        Stop_Needed = TRUE

        While Stop_Needed:
            
            Pressure_Ambient_Stop = Depth_to_Pressure(Current_Stop_Depth)
            
            // Check M-Values for all tissues at this stop depth
            Leading_Tissue_Index = -1
            
            For k from 1 to 16:
                // Calculate the M-Value for tissue k at the current ambient pressure
                M_Value_k = M_VALUES_A[k] + M_VALUES_B[k] * Pressure_Ambient_Stop

                // Check for tissue pressure violation
                If P_tiss[k] > M_Value_k:
                    Leading_Tissue_Index = k
                    Break // Found the tissue requiring the stop

            // If a leading tissue was found, a stop is required for at least one more minute
            If Leading_Tissue_Index != -1:
                SIMULATE_STEP (Current_Stop_Depth, Current_Stop_Depth, TIME_STEP)
                Stop_Time = Stop_Time + TIME_STEP
            Else:
                // All tissues are within their M-Value limits at this depth.
                Stop_Needed = FALSE
        
        // --- C. Record and Prepare for Next Stop ---
        If Stop_Time > 0:
            Add {Depth: Current_Stop_Depth, Duration: Stop_Time} to Deco_Plan
            
        // Move up 3 meters to the next shallower stop
        Current_Stop_Depth = Current_Stop_Depth - PALIER_STEP

    // 3. Final Ascent from the last stop (usually 3m) to the surface (0m)
    SIMULATE_STEP (Last_Logged_Depth, 0, Time_for_Final_Ascent)
    
    Return Deco_Plan
