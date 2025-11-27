import { Plan, GFLow, GFHigh, CompIdx, Color, TensionBar, Trace, Layout, PlotConfig, PlotDivElement, EventData, DiveParams, Annotation } from "./types.js";
import { t } from "./script.js";
import { depthToPN2, depthToPressure, getMValue, getModifiedMValue, N_COMPARTMENTS, BUEHLMANN, SURFACE_DEPTH } from "./gf.js";

// Maintain trace visibility state across re-plots
let traceVisibility: boolean[] = Array(N_COMPARTMENTS).fill(false);
let traceVisibilityBackup: boolean[] = Array(N_COMPARTMENTS).fill(false);
traceVisibility[0] = true; // start with C0 visible
localStorage.setItem('upsideDown', 'false');
localStorage.setItem('showAllSatComps', 'false');


export function formatGFstrings(gfLow: GFLow, gfHigh: GFHigh): string {
    return `${t('GF')} ${Math.round(100 * gfLow)} / ${Math.round(100 * gfHigh)}`;
}
function formatCellDataForDetails(plan: Plan): string {
    const { dtr, stops, t_descent, t_dive_total, t_stops, history, diveParams } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = diveParams as DiveParams;

    let stopsStr = stops.map(s => `${parseFloat(s.time.toFixed(2))} min @ ${s.depth}m`).join('\n - ');
    let comptStr = stops.map(s => `C${s.saturatedCompartments.join(', C')}`).join('\n - ');
    if (stops.length === 0) { stopsStr = t('stopsNone'); }

    let t_at_bottom = bottomTime - t_descent;
    if (t_at_bottom < 0) { t_at_bottom = 0; }

    let t_ascent = dtr - t_stops;
    if (t_ascent < 0) { t_ascent = 0; }

    return `${t('diveProfileTitle')} ${formatGFstrings(gfLow, gfHigh)}\n\n` +
        // `- ${t('maxDepthLabel')} ${maxDepth} meters\n` +
        // `- ${t('bottomTimeLabel')} ${bottomTime} min\n` +
        // `- ${t('gradientFactorsLabel')} ${formatGFstrings(gfLow, gfHigh)}\n` +
        `${t('calculatedDTRLabel')} ${Math.ceil(dtr).toString()} min\n\n` +
        `${t('calculatedTotalDiveTimeLabel')} ${parseFloat(t_dive_total.toFixed(2))} min\n` +
        ` - ${t('calculatedt_descentLabel')} ${parseFloat(t_descent.toFixed(2))} min\n` +
        ` - ${t('calculatedTotalBottomTimeLabel')} ${parseFloat(t_at_bottom.toFixed(2))} min\n` +
        ` - ${t('calculatedTotalStopTimeLabel')} ${parseFloat(t_stops.toFixed(2))} min\n` +
        ` - ${t('calculatedAscentTimeLabel')} ${parseFloat(t_ascent.toFixed(2))} min\n` +
        `${t('requiredStopsLabel')}\n - ${stopsStr}\n` +
        `${t('compartmentstopsLabel')}\n - ${comptStr}\n`;
}
function formatCellDataShort(plan: Plan): string {
    const { diveParams } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = diveParams as DiveParams;
    return `${bottomTime}min @ ${maxDepth}m with ${formatGFstrings(gfLow, gfHigh)}`;
}


export async function analysePlan(plan: Plan): Promise<void> {
    const planDetailsTitle = document.getElementById('details-plan-h2') as HTMLHeadingElement;
    const planDetailsTxt = document.getElementById('plan-as-string') as HTMLDivElement;
    planDetailsTitle.textContent = `${t('profileLabelPrefix')} ${formatCellDataShort(plan)}`;
    planDetailsTxt.textContent = formatCellDataForDetails(plan)
    plotPlan(plan);
}

function getCompartmentColor(i: CompIdx): Color {
    const colorPalette: Array<Color> = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5', '#c49c94'];
    return colorPalette[i % colorPalette.length];
}

function plotPlan(plan: Plan): void {
    const { history, diveParams } = plan as Plan;
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

    const timePoints = history.map(entry => entry.time);
    const depthPoints = history.map(entry => entry.depth);
    const PN2_Points = depthPoints.map(depth => depthToPN2(depth, surfacePressure));
    const P_Points = depthPoints.map(depth => depthToPressure(depth, surfacePressure));

    // transpose to get a time series for each compartment
    const compsTensions: Array<Array<TensionBar>> = Array(N_COMPARTMENTS).fill(null).map(() => []);
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
    const tracePN2: Trace = {
        x: timePoints,
        y: PN2_Points,
        mode: 'lines',
        name: t('pn2ambiantLabel'),
        line: { color: 'black', width: 3 },
        yaxis: 'y1',
        xaxis: 'x1',
        legendgroup: `P_N2_ambiant`,
        customdata: depthPoints,
        hovertemplate:
            `${t('timeLabel')}: %{x:.2f} min<br>` +
            `${t('depthLabel')}: %{customdata:.0f} m<br>` +
            `${t('pn2ambiantLabel')}: %{y:.2f} bar`
    };
    data_ply.push(tracePN2);
    const tracePressure: Trace = {
        x: timePoints,
        y: P_Points,
        mode: 'lines',
        name: t('pressureLabel'),
        line: { color: 'black', width: 1 },
        yaxis: 'y1',
        xaxis: 'x1',
        legendgroup: `P_ambiant`,
        hoverinfo: 'none'
    };
    data_ply.push(tracePressure);

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
    // Prepare zData for heatmap: Calculate saturation relative to ambient PN2: Tension - PN2
    const zData: number[][] = [];
    for (let i = 0; i < N_COMPARTMENTS; i++) {
        const row = history.map(h => h.tensions[i] - depthToPN2(h.depth, surfacePressure));
        zData.push(row);
    }

    const traceHeatmap: Trace = {
        x: timePoints,
        y: Array.from({ length: N_COMPARTMENTS }, (_, i) => `C${i}`),
        z: zData,
        name: "",
        type: 'heatmap',
        colorscale: 'Jet',
        zmid: 0,
        xaxis: 'x2',
        yaxis: 'y2',
        showlegend: false,
        showscale: false,
        hovertemplate:
            `%{y}<br>` +
            `${t('timeLabel')}: %{x:.2f} min<br>` +
            `${t('relativeTensionLabel')}: %{z:.2f} bar<br>`
    };
    data_ply.push(traceHeatmap);

    // --- Third Subplot: Ambient Pressure vs Tensions (Bottom Plot) ---
    const traceMainDiagonalPN2: Trace = {
        x: [depthToPressure(SURFACE_DEPTH, surfacePressure), depthToPressure(maxDepth, surfacePressure)],
        y: [depthToPN2(SURFACE_DEPTH, surfacePressure), depthToPN2(maxDepth, surfacePressure)],
        mode: 'lines',
        name: t('pn2ambiantLabel'),
        line: { color: 'black', width: 3 },
        yaxis: 'y3',
        xaxis: 'x3',
        legendgroup: `P_N2_ambiant`,
        showlegend: false,
        hoverinfo: 'none'
    };
    data_ply.push(traceMainDiagonalPN2);
    const traceMainDiagonalP: Trace = {
        x: [depthToPressure(SURFACE_DEPTH, surfacePressure), depthToPressure(maxDepth, surfacePressure)],
        y: [depthToPressure(SURFACE_DEPTH, surfacePressure), depthToPressure(maxDepth, surfacePressure)],
        mode: 'lines',
        name: t('pressureLabel'),
        line: { color: 'black', width: 1 },
        yaxis: 'y3',
        xaxis: 'x3',
        legendgroup: `P_ambiant`,
        showlegend: false,
        hoverinfo: 'none'
    };
    data_ply.push(traceMainDiagonalP);

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
        const traceModifiedMValues: Trace = {
            x: [depthToPressure(SURFACE_DEPTH, surfacePressure), depthToPressure(maxDepth, surfacePressure)],
            y: [getModifiedMValue(A, B, surfacePressure, gfHigh), getModifiedMValue(A, B, depthToPressure(maxDepth, surfacePressure), gfLow)],
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
        const gf_shift = 0.1;

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
            hoverinfo: 'name'
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
            hoverinfo: 'none'
        };
        data_ply.push(traceGFHighRemaining);

        // GF Low at max depth
        const y_modM_max = getModifiedMValue(Afast, Bfast, depthToPressure(maxDepth, surfacePressure), gfLow);
        const y_M_max = getMValue(Afast, Bfast, depthToPressure(maxDepth, surfacePressure));
        const traceGFLowMain: Trace = {
            x: [depthToPressure(maxDepth, surfacePressure) + gf_shift, depthToPressure(maxDepth, surfacePressure) + gf_shift],
            y: [depthToPressure(maxDepth, surfacePressure), y_modM_max],
            mode: 'lines',
            name: `GF Low (${Math.round(gfLow * 100)}%)`,
            line: { color: 'magenta', width: 5 },
            yaxis: 'y3',
            xaxis: 'x3',
            legendgroup: 'gf',
            hoverinfo: 'name'
        };
        data_ply.push(traceGFLowMain);
        const traceGFLowRemaining: Trace = {
            x: [depthToPressure(maxDepth, surfacePressure) + gf_shift, depthToPressure(maxDepth, surfacePressure) + gf_shift],
            y: [y_modM_max, y_M_max],
            mode: 'lines',
            line: { color: 'magenta', width: 1 },
            yaxis: 'y3',
            xaxis: 'x3',
            showlegend: false,
            legendgroup: 'gf',
            hoverinfo: 'none'
        };
        data_ply.push(traceGFLowRemaining);
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
            },
            {
                text: 'GF Low',
                xref: 'x3',
                yref: 'y3',
                x: depthToPressure(maxDepth, surfacePressure) + gf_shift + 0.05,
                y: (y_modM_max + depthToPressure(maxDepth, surfacePressure)) / 2,
                showarrow: false,
                xanchor: 'left',
                font: {
                    color: 'magenta',
                    size: 12
                }
            }
        ];
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


    if (window.innerWidth < 700) { // mobile device
        layout.showlegend = false;
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
