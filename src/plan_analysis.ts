import { Plan, GFLow, GFHigh, CompIdx, Color, TensionBar, Trace, Layout, PlotConfig, PlotDivElement, EventData, DiveParams, Annotation } from "./types.js";
import { t } from "./script.js";
import { depthToPN2, depthToPressure, getMValue, getModifiedMValue, N_COMPARTMENTS, BUEHLMANN, SURFACE_PRESSURE, SURFACE_DEPTH } from "./gf.js";

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

    let stopsStr = stops.map(s => `${s.time} min @ ${s.depth}m`).join(', ');
    let comptStr = stops.map(s => `[${s.saturatedCompartments.join(', ')}]`).join(', ');
    if (stops.length === 0) { stopsStr = t('stopsNone'); }

    let t_at_bottom = bottomTime - t_descent;
    if (t_at_bottom < 0) { t_at_bottom = 0; }

    let t_ascent = dtr - t_stops;
    if (t_ascent < 0) { t_ascent = 0; }

    return `${t('diveProfileTitle')}\n` +
        // `- ${t('maxDepthLabel')} ${maxDepth} meters\n` +
        // `- ${t('bottomTimeLabel')} ${bottomTime} minutes\n` +
        // `- ${t('gradientFactorsLabel')} ${formatGFstrings(gfLow, gfHigh)}\n` +
        `- ${t('calculatedDTRLabel')} ${parseFloat(dtr.toFixed(2))} minutes\n` +
        `- ${t('calculatedTotalDiveTimeLabel')} ${parseFloat(t_dive_total.toFixed(2))} minutes\n` +
        `   - ${t('calculatedt_descentLabel')} ${parseFloat(t_descent.toFixed(2))} minutes\n` +
        `   - ${t('calculatedTotalBottomTimeLabel')} ${parseFloat(t_at_bottom.toFixed(2))} minutes\n` +
        `   - ${t('calculatedTotalStopTimeLabel')} ${parseFloat(t_stops.toFixed(2))} minutes\n` +
        `   - ${t('calculatedAscentTimeLabel')} ${parseFloat(t_ascent.toFixed(2))} minutes\n` +
        `- ${t('requiredStopsLabel')} ${stopsStr}\n` +
        `- ${t('compartmentstopsLabel')} ${comptStr}\n`;
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
    const { maxDepth, gfLow, gfHigh } = diveParams as DiveParams;

    const timePoints = history.map(entry => entry.time);
    const depthPoints = history.map(entry => entry.depth);
    const PN2_Points = depthPoints.map(depthToPN2);
    const P_Points = depthPoints.map(depthToPressure);

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
            mode: 'lines+markers',
            name: `${t('compartmentLabel')}${i} (${BUEHLMANN.map(c => c.t12)[i]} min)`,
            line: { width: 1, color: getCompartmentColor(i) },
            yaxis: 'y1',
            xaxis: 'x1',
            legendgroup: `compartment${i}`,
            hovertemplate:
                `${t('tensionLabel')}: %{y:.2f} bar<br>`
        };
        applyTraceVisibility(traceComp, i);
        data_ply.push(traceComp);
    }

    // --- Second Subplot: Ambient Pressure vs Tensions (Bottom Plot) ---
    const traceMainDiagonalPN2: Trace = {
        x: [depthToPN2(SURFACE_DEPTH), depthToPN2(maxDepth)],
        y: [depthToPN2(SURFACE_DEPTH), depthToPN2(maxDepth)],
        mode: 'lines',
        name: t('pn2ambiantLabel'),
        line: { color: 'black', width: 3 },
        yaxis: 'y2',
        xaxis: 'x2',
        legendgroup: `P_N2_ambiant`,
        showlegend: false,
        hoverinfo: 'none'
    };
    data_ply.push(traceMainDiagonalPN2);
    const traceMainDiagonalP: Trace = {
        x: [depthToPN2(SURFACE_DEPTH), depthToPN2(maxDepth)],
        y: [depthToPressure(SURFACE_DEPTH), depthToPressure(maxDepth)],
        mode: 'lines',
        name: t('pressureLabel'),
        line: { color: 'black', width: 1 },
        yaxis: 'y2',
        xaxis: 'x2',
        legendgroup: `P_ambiant`,
        showlegend: false,
        hoverinfo: 'none'
    };
    data_ply.push(traceMainDiagonalP);

    for (let i = 0; i < N_COMPARTMENTS; i++) {
        // plot the tension
        const traceTensionsVsPN2: Trace = {
            x: PN2_Points,
            y: compsTensions[i],
            mode: 'lines+markers',
            name: `${t('compartmentLabel')}${i} (${BUEHLMANN.map(c => c.t12)[i]} min)`,
            line: { width: 1, color: getCompartmentColor(i) },
            yaxis: 'y2',
            xaxis: 'x2',
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
            x: [depthToPN2(SURFACE_DEPTH), depthToPN2(maxDepth)],
            y: [getMValue(A, B, SURFACE_PRESSURE), getMValue(A, B, depthToPressure(maxDepth))],
            name: `${t('mValueLabel')}`,
            line: { width: 1, color: getCompartmentColor(i), dash: 'dot' },
            mode: 'lines',
            yaxis: 'y2',
            xaxis: 'x2', legendgroup: `compartment${i}`,
            hoverinfo: 'none'
        };
        if (i > 0) { traceMValues.showlegend = false; }
        applyTraceVisibility(traceMValues, i);
        data_ply.push(traceMValues);

        // plot the modified M-Value line for this compartment
        const traceModifiedMValues: Trace = {
            x: [depthToPN2(SURFACE_DEPTH), depthToPN2(maxDepth)],
            y: [getModifiedMValue(A, B, SURFACE_PRESSURE, gfHigh), getModifiedMValue(A, B, depthToPressure(maxDepth), gfLow)],
            name: `${t('modifiedMValueLabel')}`,
            line: { width: 1, color: getCompartmentColor(i), dash: 'dash' },
            mode: 'lines',
            yaxis: 'y2',
            xaxis: 'x2', legendgroup: `compartment${i}`,
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
        const M_surf = getMValue(Afast, Bfast, SURFACE_PRESSURE);
        const modM_surf = getModifiedMValue(Afast, Bfast, SURFACE_PRESSURE, gfHigh);
        const traceGFHighMain: Trace = {
            x: [depthToPN2(SURFACE_DEPTH) - gf_shift, depthToPN2(SURFACE_DEPTH) - gf_shift],
            y: [depthToPressure(SURFACE_DEPTH), modM_surf],
            mode: 'lines',
            name: `GF High (${Math.round(gfHigh * 100)}%)`,
            line: { color: 'cyan', width: 5 },
            yaxis: 'y2',
            xaxis: 'x2',
            legendgroup: 'gf',
            hoverinfo: 'name'
        };
        data_ply.push(traceGFHighMain);
        const traceGFHighRemaining: Trace = {
            x: [depthToPN2(SURFACE_DEPTH) - gf_shift, depthToPN2(SURFACE_DEPTH) - gf_shift],
            y: [modM_surf, M_surf],
            mode: 'lines',
            line: { color: 'cyan', width: 1 },
            yaxis: 'y2',
            xaxis: 'x2',
            showlegend: false,
            legendgroup: 'gf',
            hoverinfo: 'none'
        };
        data_ply.push(traceGFHighRemaining);

        // GF Low at max depth
        const y_modM_max = getModifiedMValue(Afast, Bfast, depthToPressure(maxDepth), gfLow);
        const y_M_max = getMValue(Afast, Bfast, depthToPressure(maxDepth));
        const traceGFLowMain: Trace = {
            x: [depthToPN2(maxDepth) + gf_shift, depthToPN2(maxDepth) + gf_shift],
            y: [depthToPressure(maxDepth), y_modM_max],
            mode: 'lines',
            name: `GF Low (${Math.round(gfLow * 100)}%)`,
            line: { color: 'magenta', width: 5 },
            yaxis: 'y2',
            xaxis: 'x2',
            legendgroup: 'gf',
            hoverinfo: 'name'
        };
        data_ply.push(traceGFLowMain);
        const traceGFLowRemaining: Trace = {
            x: [depthToPN2(maxDepth) + gf_shift, depthToPN2(maxDepth) + gf_shift],
            y: [y_modM_max, y_M_max],
            mode: 'lines',
            line: { color: 'magenta', width: 1 },
            yaxis: 'y2',
            xaxis: 'x2',
            showlegend: false,
            legendgroup: 'gf',
            hoverinfo: 'none'
        };
        data_ply.push(traceGFLowRemaining);
        annotations = [
            {
                text: 'GF High',
                xref: 'x2',
                yref: 'y2',
                x: depthToPN2(SURFACE_DEPTH) - gf_shift - 0.05,
                y: (modM_surf + depthToPressure(SURFACE_DEPTH)) / 2,
                showarrow: false,
                xanchor: 'right',
                font: {
                    color: 'cyan',
                    size: 12
                }
            },
            {
                text: 'GF Low',
                xref: 'x2',
                yref: 'y2',
                x: depthToPN2(maxDepth) + gf_shift + 0.05,
                y: (y_modM_max + depthToPressure(maxDepth)) / 2,
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
            rows: 2,
            columns: 1,
            pattern: 'independent',
            roworder: 'top to bottom',
            ygap: 0.15
        },
        xaxis: {
            title: { text: t('timeLabel') + ' (min)' },
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
        },
        xaxis2: {
            title: { text: t('pn2ambiantLabel') + ' (bar)' },
            rangemode: 'tozero',
            gridcolor: isDarkMode ? '#444' : '#eee',
        },
        yaxis2: {
            title: { text: t('compartmentTensionLabel') + ' (bar)' },
            rangemode: 'tozero',
            gridcolor: isDarkMode ? '#444' : '#eee',
        },
        legend: {
            xanchor: "left",
            yanchor: "top",
            x: 1,
            y: 1,
        },
        paper_bgcolor: isDarkMode ? '#343a40' : '#ffffff',
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
        toggleTraceVisibilityOnClick(eventData);

        const legendGroup = eventData.data[eventData.curveNumber].legendgroup as string;
        if (legendGroup === 'gf') {
            // Determine the new visibility state for the GF annotation.
            // If the trace was visible (true or default), it will become hidden. So annotation should be hidden.
            // If the trace was hidden (false or 'legendonly'), it will become visible. So annotation should be visible.
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


function toggleTraceVisibilityOnClick(eventData: EventData): void {
    const trace = eventData.data[eventData.curveNumber];
    if (trace.legendgroup && trace.legendgroup.startsWith('compartment')) {
        const compartmentIndex = parseInt(trace.legendgroup.substring('compartment'.length));
        const currentVisibility = trace.visible === true || trace.visible === undefined;
        traceVisibility[compartmentIndex] = !currentVisibility;
    }
}
function applyTraceVisibility(trace: Trace, compartmentIndex: CompIdx): void {
    const visibility = traceVisibility[compartmentIndex];
    trace.visible = visibility ? true : 'legendonly';
}
