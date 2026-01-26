import { Plan, GFLow, GFHigh, CompIdx, Color, Tension, Trace, Layout, PlotConfig, PlotDivElement, EventData, DiveParams, Annotation, Pressure } from "./types.js";
import { t, MOBILE_WIDTH_THRESHOLD } from "./script.js";
import { calculateGFCeilings, calculateCeilings, depthToPN2, depthToPressure, getMValue, getModifiedMValue, N_COMPARTMENTS, BUEHLMANN, SURFACE_DEPTH, isPlanBreachModifiedMValues } from "./gf.js";

// Maintain trace visibility state across re-plots
let traceVisibility: boolean[] = Array(N_COMPARTMENTS).fill(false);
let traceVisibilityBackup: boolean[] = Array(N_COMPARTMENTS).fill(false);
traceVisibility[0] = true; // start with C0 visible
localStorage.setItem('upsideDown', 'true');
localStorage.setItem('showAllSatComps', 'false');


export function formatGFstrings(gfLow: GFLow, gfHigh: GFHigh): string {
    return `${t('GF')} ${Math.round(100 * gfLow)} / ${Math.round(100 * gfHigh)}`;
}


function formatCellDataShort(plan: Plan): string {
    const { diveParams } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = diveParams as DiveParams;
    return `${bottomTime}min @ ${maxDepth}m with ${formatGFstrings(gfLow, gfHigh)}`;
}


// export async function analysePlan(plan: Plan): Promise<void> {
export function analysePlan(plan: Plan): void {
    const rightH2 = document.getElementById('right-container-h2') as HTMLHeadingElement;
    rightH2.textContent = `${t('profileLabelPrefix')} ${formatCellDataShort(plan)}`;
    plotPlan(plan);
    if (isPlanBreachModifiedMValues(plan)) {
        console.log('Breach modified M-values detected in plan:', plan.diveParams);
    }

}

function getCompartmentColor(i: CompIdx): Color {
    const colorPalette: Array<Color> = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5', '#c49c94'];
    return colorPalette[i % colorPalette.length];
}

function plotPlan(plan: Plan): void {
    const { dtr, history, diveParams } = plan as Plan;
    const { bottomTime,
        maxDepth,
        gfLow,
        gfHigh,
        ascentRate,
        descentRate,
        surfacePressure,
        stopInterval,
        lastStopDepth,
        timeStep,
    } = diveParams as DiveParams;

    if (dtr === Infinity) {
        // Render an empty plot instead of leaving the previous plot visible
        const isDarkMode = document.body.classList.contains('dark-mode');
        const emptyLayout: Layout = {
            paper_bgcolor: isDarkMode ? '#3a3a3a' : '#ffffff',
            plot_bgcolor: isDarkMode ? '#212529' : '#f8f9fa',
            xaxis: { visible: false, showgrid: false },
            yaxis: { visible: false, showgrid: false }
        };
        Plotly.newPlot('plotly-plot', [], emptyLayout);
        return;
    }

    const timePoints = history.map(entry => entry.time);
    const depthPoints = history.map(entry => entry.depth);
    const PN2_Points = depthPoints.map(depth => depthToPN2(depth, surfacePressure));
    const P_Points = depthPoints.map(depth => depthToPressure(depth, surfacePressure));

    const ceiling = calculateCeilings(history, surfacePressure);
    const firstStopDepth = plan.stops.length > 0 ? plan.stops[0].depth : null;
    const ceilingGF = calculateGFCeilings(history, diveParams as DiveParams, firstStopDepth);

    // transpose to get a time series for each compartment
    const compsTensions: Array<Array<Tension>> = Array(N_COMPARTMENTS).fill(null).map(() => []);
    history.forEach(entry => {
        entry.tensions.forEach((tension, i) => {
            compsTensions[i].push(tension);
        });
    });

    const data_ply: Array<Trace> = [];

    // Make all saturated compartments visible if requested
    if (localStorage.getItem('showAllSatComps') === 'true') {
        const satComps = new Set(plan.stops.map(({ saturatedCompartments: cs }) => cs).flat());
        traceVisibility.fill(false);
        satComps.forEach((idx) => { traceVisibility[idx] = true; });
    }

    // --- First Subplot: Time vs Depth/Tensions (Top Plot) ---
    const tracePressure: Trace = {
        x: timePoints,
        y: P_Points,
        mode: 'lines',
        name: t('ambiantPressureLabel'),
        line: { color: 'black', width: 2 },
        yaxis: 'y1',
        xaxis: 'x1',
        legendgroup: `P_ambiant`,
        hoverinfo: 'none'
    };
    data_ply.push(tracePressure);

    const tankPressurePoints: Array<Pressure> = history.map(entry => entry.tankPressure);
    const traceTankPressure: Trace = {
        x: timePoints,
        y: tankPressurePoints,
        mode: 'lines',
        name: t('tankPressureLabel'),
        line: { color: 'green', width: 1 },
        yaxis: 'y12',
        xaxis: 'x1',
        legendgroup: `TankPressure`,
        hovertemplate:
            `${t('timeLabel')}: %{x:.2f} min<br>` +
            `${t('tankPressureLabel')}: %{y:.2f} bar`
    };
    data_ply.push(traceTankPressure);

    const traceCeiling: Trace = {
        x: timePoints,
        y: ceiling,
        mode: 'lines',
        name: t('ceilingLabel'),
        line: { color: 'brown', width: 1, dash: 'dot' },
        yaxis: 'y1',
        xaxis: 'x1',
        legendgroup: `Ceiling`,
        hovertemplate:
            `${t('timeLabel')}: %{x:.2f} min<br>` +
            `${t('ceilingLabel')}: %{y:.2f} bar`
    };
    data_ply.push(traceCeiling);

    const traceGFCeilingFill: Trace = {
        x: [...timePoints, timePoints[timePoints.length - 1], timePoints[0]],
        y: [...ceilingGF, surfacePressure, surfacePressure],
        name: t('gfCeilingLabel'),
        fill: 'toself',
        fillcolor: 'rgba(255,165,0,0.3)',
        line: { color: 'transparent' },
        hoverinfo: 'none',
        yaxis: 'y1',
        xaxis: 'x1',
        legendgroup: `GFCeiling`,
    };
    data_ply.push(traceGFCeilingFill);

    for (let i = 0; i < N_COMPARTMENTS; i++) {
        const traceComp: Trace = {
            x: timePoints,
            y: compsTensions[i],
            mode: 'lines',
            name: `${t('compartmentLabel')}${i} (${BUEHLMANN.map(c => c.t12)[i]} min)`,
            line: { width: 1, color: getCompartmentColor(i) },
            yaxis: 'y1',
            xaxis: 'x1',
            legendgroup: `compartment${i}`,
            hovertemplate:
                `${t('timeLabel')}: %{x:.2f} min<br>` +
                `${t('tensionLabel')}: %{y:.2f} bar<br>`
        };
        applyTraceVisibility(traceComp, i);
        data_ply.push(traceComp);
    }

    // --- Second Subplot: Heatmap (Middle Plot) ss---
    // Prepare zData for heatmap: Calculate relative saturation 
    // 0 = at ambient pressure
    // 100 = at maximum pressure M value
    // -100 for a zero tension
    // more than 100 = overpressure DANGER
    // negative = on gasizing
    // positive = off gazing
    const zData: number[][] = [];
    for (let i = 0; i < N_COMPARTMENTS; i++) {
        const row = history.map(h => {
            const P = depthToPressure(h.depth, surfacePressure);
            const Mvalue = getMValue(BUEHLMANN[i].A, BUEHLMANN[i].B, P);
            if (h.tensions[i] >= P) {
                return 100 * ((h.tensions[i] - P) / (Mvalue - P)); // this is called GF99
            } else {
                return -100 * ((P - h.tensions[i]) / P);
            }
        });
        zData.push(row);
    }

    const traceHeatmap: Trace = {
        x: timePoints,
        y: Array.from({ length: N_COMPARTMENTS }, (_, i) => `C${i}`),
        z: zData,
        name: "",
        type: 'heatmap',
        colorscale: 'Picnic', // diverging
        // colorscale: 'Jet',
        zmid: 0,
        xaxis: 'x2',
        yaxis: 'y2',
        showlegend: false,
        showscale: false,
        hovertemplate:
            `%{y}<br>` +
            `${t('timeLabel')}: %{x:.2f} min<br>` +
            `${t('relativeTensionLabel')}: %{z:.0f}%<br>`
    };
    data_ply.push(traceHeatmap);

    // --- Third Subplot: Ambient Pressure vs Tensions (Bottom Plot) ---
    const traceMainDiagonalP: Trace = {
        x: [depthToPressure(SURFACE_DEPTH, surfacePressure), depthToPressure(maxDepth, surfacePressure)],
        y: [depthToPressure(SURFACE_DEPTH, surfacePressure), depthToPressure(maxDepth, surfacePressure)],
        mode: 'lines',
        name: t('ambiantPressureLabel'),
        line: { color: 'black', width: 2 },
        yaxis: 'y3',
        xaxis: 'x3',
        legendgroup: `P_ambiant`,
        showlegend: false,
        hoverinfo: 'none'
    };
    data_ply.push(traceMainDiagonalP);
    let gfLowDepth = maxDepth; // old behavior
    let needStop = plan.stops.length > 0;
    if (needStop) {
        gfLowDepth = plan.stops[0].depth
    }
    for (let i = 0; i < N_COMPARTMENTS; i++) {
        // plot the tension
        const traceTensionsVsPN2: Trace = {
            x: P_Points,
            y: compsTensions[i],
            mode: 'lines+markers',
            name: `${t('compartmentLabel')}${i} (${BUEHLMANN.map(c => c.t12)[i]} min)`,
            line: { width: 1, color: getCompartmentColor(i) },
            yaxis: 'y3',
            xaxis: 'x3',
            showlegend: false,
            legendgroup: `compartment${i}`,
            customdata: timePoints.map((t, idx) => [t, depthPoints[idx]]),
            hovertemplate:
                `${t('timeLabel')}: %{customdata[0]:.2f} min<br>` +
                `${t('depthLabel')}: %{customdata[1]:.0f} m<br>` +
                `${t('pn2ambiantLabel')}: %{x:.2f} bar<br>` +
                `${t('tensionLabel')}: %{y:.2f} bar`
        };
        applyTraceVisibility(traceTensionsVsPN2, i);
        data_ply.push(traceTensionsVsPN2);

        // plot the M-Value line for this compartment
        const A = BUEHLMANN[i].A;
        const B = BUEHLMANN[i].B;
        const traceMValues: Trace = {
            x: [depthToPressure(SURFACE_DEPTH, surfacePressure), depthToPressure(maxDepth, surfacePressure)],
            y: [getMValue(A, B, surfacePressure), getMValue(A, B, depthToPressure(maxDepth, surfacePressure))],
            name: `${t('mValueLabel')}`,
            line: { width: 1, color: getCompartmentColor(i), dash: 'dot' },
            mode: 'lines',
            yaxis: 'y3',
            xaxis: 'x3', legendgroup: `compartment${i}`,
            hoverinfo: 'none'
        };
        if (i > 0) { traceMValues.showlegend = false; }
        applyTraceVisibility(traceMValues, i);
        data_ply.push(traceMValues);

        // plot the modified M-Value line for this compartment
        if (needStop) {
            const traceModifiedMValues: Trace = {
                x: [depthToPressure(SURFACE_DEPTH, surfacePressure), depthToPressure(gfLowDepth, surfacePressure)],
                y: [getModifiedMValue(A, B, surfacePressure, gfHigh), getModifiedMValue(A, B, depthToPressure(gfLowDepth, surfacePressure), gfLow)],
                name: `${t('modifiedMValueLabel')}`,
                line: { width: 1, color: getCompartmentColor(i), dash: 'dash' },
                mode: 'lines',
                yaxis: 'y3',
                xaxis: 'x3', legendgroup: `compartment${i}`,
                hoverinfo: 'none'
            };
            if (i > 0) { traceModifiedMValues.showlegend = false; }
            applyTraceVisibility(traceModifiedMValues, i);
            data_ply.push(traceModifiedMValues);
        }
    }

    // Find the fastest compartment that is visible to associate the GF candlestick with.
    let fastestVisibleComIdxOr0 = null;
    for (let i = 0; i < N_COMPARTMENTS; i++) {
        if (traceVisibility[i]) {
            fastestVisibleComIdxOr0 = i;
            break; // Stop at the first visible compartment.
        }
    } // if no compartment is visible, this will remain null

    let annotations: Array<Annotation> = [];
    if (fastestVisibleComIdxOr0 !== null) {
        // Add GF Low/High visualization segments for the fastest visible compartment.
        const Afast = BUEHLMANN[fastestVisibleComIdxOr0].A;
        const Bfast = BUEHLMANN[fastestVisibleComIdxOr0].B;
        const gf_shift = 0.;

        // GF High at surface
        const M_surf = getMValue(Afast, Bfast, surfacePressure);
        const modM_surf = getModifiedMValue(Afast, Bfast, surfacePressure, gfHigh);
        const traceGFHighMain: Trace = {
            x: [depthToPressure(SURFACE_DEPTH, surfacePressure) - gf_shift, depthToPressure(SURFACE_DEPTH, surfacePressure) - gf_shift],
            y: [depthToPressure(SURFACE_DEPTH, surfacePressure), modM_surf],
            mode: 'lines',
            name: `GF High (${Math.round(gfHigh * 100)}%)`,
            line: { color: 'cyan', width: 5 },
            yaxis: 'y3',
            xaxis: 'x3',
            legendgroup: 'gf',
            hoverinfo: 'name',
            opacity: 0.5
        };
        data_ply.push(traceGFHighMain);
        const traceGFHighRemaining: Trace = {
            x: [depthToPressure(SURFACE_DEPTH, surfacePressure) - gf_shift, depthToPressure(SURFACE_DEPTH, surfacePressure) - gf_shift],
            y: [modM_surf, M_surf],
            mode: 'lines',
            line: { color: 'cyan', width: 1 },
            yaxis: 'y3',
            xaxis: 'x3',
            showlegend: false,
            legendgroup: 'gf',
            hoverinfo: 'none',
            opacity: 0.5
        };
        data_ply.push(traceGFHighRemaining);

        // GF Low at max depth
        const y_modM_max = getModifiedMValue(Afast, Bfast, depthToPressure(gfLowDepth, surfacePressure), gfLow);
        const y_M_max = getMValue(Afast, Bfast, depthToPressure(gfLowDepth, surfacePressure));
        if (needStop) {
            const traceGFLowMain: Trace = {
                x: [depthToPressure(gfLowDepth, surfacePressure) + gf_shift, depthToPressure(gfLowDepth, surfacePressure) + gf_shift],
                y: [depthToPressure(gfLowDepth, surfacePressure), y_modM_max],
                mode: 'lines',
                name: `GF Low (${Math.round(gfLow * 100)}%)`,
                line: { color: 'magenta', width: 5 },
                yaxis: 'y3',
                xaxis: 'x3',
                legendgroup: 'gf',
                hoverinfo: 'name',
                opacity: 0.5
            };
            data_ply.push(traceGFLowMain);

            const traceGFLowRemaining: Trace = {
                x: [depthToPressure(gfLowDepth, surfacePressure) + gf_shift, depthToPressure(gfLowDepth, surfacePressure) + gf_shift],
                y: [y_modM_max, y_M_max],
                mode: 'lines',
                line: { color: 'magenta', width: 1 },
                yaxis: 'y3',
                xaxis: 'x3',
                showlegend: false,
                legendgroup: 'gf',
                hoverinfo: 'none',
                opacity: 0.5
            };
            data_ply.push(traceGFLowRemaining);
        }
        annotations = [
            {
                text: 'GF High',
                xref: 'x3',
                yref: 'y3',
                x: depthToPressure(SURFACE_DEPTH, surfacePressure) - gf_shift - 0.05,
                y: (modM_surf + depthToPressure(SURFACE_DEPTH, surfacePressure)) / 2,
                showarrow: false,
                xanchor: 'right',
                font: {
                    color: 'cyan',
                    size: 12
                }
            }];
        if (needStop) {
            annotations.push(
                {
                    text: 'GF Low',
                    xref: 'x3',
                    yref: 'y3',
                    x: depthToPressure(gfLowDepth, surfacePressure) + gf_shift + 0.05,
                    y: (y_modM_max + depthToPressure(gfLowDepth, surfacePressure)) / 2,
                    showarrow: false,
                    xanchor: 'left',
                    font: {
                        color: 'magenta',
                        size: 12
                    }
                }
            );
        }
    } else {
        annotations = []; // No compartment is visible, so we do not add GF annotations.
    }

    const isDarkMode = document.body.classList.contains('dark-mode');

    const layout: Layout = {
        title: { text: t('tensionsTSTitle') },
        grid: {
            rows: 3,
            columns: 1,
            pattern: 'independent',
            roworder: 'top to bottom',
            ygap: 0.1
        },
        xaxis: {
            tickvals: Array.from({ length: 10 }, (_, i) => Math.round((i / 9) * Math.max(...timePoints))),
            ticktext: [],
            autorange: true,
            rangemode: 'tozero',
            gridcolor: isDarkMode ? '#444' : '#eee',
            range: [0, 200],
        },
        yaxis: {
            title: { text: t('compartmentTensionLabel') + ' (bar)' },
            autorange: localStorage.getItem('upsideDown') === 'true' ? 'reversed' : true,
            rangemode: 'tozero',
            gridcolor: isDarkMode ? '#444' : '#eee',
            domain: [0.64, 1]
        },
        yaxis12: {
            showgrid: false,
            anchor: 'x1',
            overlaying: 'y',
            side: 'right',
            domain: [0.64, 1],
            visible: false
        },
        xaxis2: {
            title: { text: t('timeLabel') + ' (min)' },
            gridcolor: isDarkMode ? '#444' : '#eee',
            ticktext: [],
            tickvals: Array.from({ length: 10 }, (_, i) => Math.round((i / 9) * Math.max(...timePoints))),
            autorange: true,
            rangemode: 'tozero',
            // matches: 'x'
        },
        yaxis2: {
            gridcolor: isDarkMode ? '#444' : '#eee',
            tickvals: [],
            // tickvals: Array.from({ length: N_COMPARTMENTS }, (_, i) => i),
            // ticktext: Array.from({ length: N_COMPARTMENTS }, (_, i) => `C${i}`),
            autorange: 'reversed',
            domain: [0.5, 0.64]
        },
        xaxis3: {
            title: { text: t('pressureLabel') + ' (bar)' },
            rangemode: 'tozero',
            gridcolor: isDarkMode ? '#444' : '#eee',
        },
        yaxis3: {
            title: { text: t('compartmentTensionLabel') + ' (bar)' },
            rangemode: 'tozero',
            gridcolor: isDarkMode ? '#444' : '#eee',
            domain: [0.05, 0.4]
        },
        legend: {
            xanchor: "left",
            yanchor: "top",
            x: 1,
            y: 1,
        },
        paper_bgcolor: isDarkMode ? '#3a3a3a' : '#ffffff',
        plot_bgcolor: isDarkMode ? '#212529' : '#f8f9fa',
        font: {
            color: isDarkMode ? '#f8f9fa' : '#212529'
        },
        annotations: annotations
    };


    if (window.innerWidth < MOBILE_WIDTH_THRESHOLD) { // mobile device
        layout.showlegend = false;
        data_ply.forEach((tr) => { tr.showlegend = false; });
        layout.margin = {
            l: 0,
            r: 0,
            b: 0,
            t: 0,
            pad: 0
        };
    }
    const config: PlotConfig = {
        scrollZoom: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['select2d', 'lasso2d', 'resetScale2d',
            'toggleSpikelines', 'hoverClosestCartesian', 'hoverCompareCartesian'
        ],
        modeBarButtonsToAdd: [
            {
                name: 'upsideDown', title: 'Turn Time-Tensions (Top) Plot Upside Down', icon: Plotly.Icons['3d_rotate'], click: () => {
                    localStorage.setItem('upsideDown', String(localStorage.getItem('upsideDown') === 'false'));
                    plotPlan(plan);
                }
            },
            {
                name: 'showAllSatComps', title: 'Show All Saturated Compartments', icon: Plotly.Icons.drawline, click: () => {
                    const currShowAll = localStorage.getItem('showAllSatComps');
                    if (currShowAll === 'false') { // we switch to saturated compartments visible
                        traceVisibilityBackup = [...traceVisibility]; // backup current visibility
                        localStorage.setItem('showAllSatComps', 'true');
                    } else { // we revert to regular visbility
                        traceVisibility = [...traceVisibilityBackup]; // restore visibility
                        localStorage.setItem('showAllSatComps', 'false');
                    }
                    plotPlan(plan);
                }
            }
        ],
        displaylogo: false,
        responsive: true,
    };

    Plotly.newPlot('plotly-plot', data_ply, layout, config);

    const plotDiv = document.getElementById('plotly-plot') as PlotDivElement;
    plotDiv.on('plotly_legendclick', function (eventData: EventData) {
        toggleTraceVisibilityOnClick(eventData, plan);

        const legendGroup = eventData.data[eventData.curveNumber].legendgroup as string;
        if (legendGroup === 'gf') {
            const traceWasVisible = (eventData.fullData[eventData.curveNumber].visible === true || eventData.fullData[eventData.curveNumber].visible === undefined);
            const newAnnotationVisibleState = !traceWasVisible;
            const update = {
                [`annotations[0].visible`]: newAnnotationVisibleState,
                [`annotations[1].visible`]: newAnnotationVisibleState
            };
            Plotly.relayout(plotDiv, update);
        }
    });
}


function toggleTraceVisibilityOnClick(eventData: EventData, plan: Plan): void {
    const trace = eventData.data[eventData.curveNumber];
    if (trace.legendgroup && trace.legendgroup.startsWith('compartment')) {
        const compartmentIndex = parseInt(trace.legendgroup.substring('compartment'.length));
        const currentVisibility = trace.visible === true || trace.visible === undefined;
        traceVisibility[compartmentIndex] = !currentVisibility;
        localStorage.setItem('showAllSatComps', 'false');
        plotPlan(plan);
    }
}
function applyTraceVisibility(trace: Trace, compartmentIndex: CompIdx): void {
    const visibility = traceVisibility[compartmentIndex];
    trace.visible = visibility ? true : 'legendonly';
}
