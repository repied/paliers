function formatGFstrings(gfLow, gfHigh) {
    return `${t('GF')} ${Math.round(100 * gfLow)} / ${Math.round(100 * gfHigh)}`;
}

function formatCellDataForDetails(plan) {
    const { dtr, stops, t_descent, t_dive_total, t_stops, history, diveParams } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = diveParams;

    let stopsStr = stops.map(s => `${s.time} min @ ${s.depth}m [${s.saturatedCompartments.join(', ')}]`).join(', ');
    if (stops.length === 0) stopsStr = t('stopsNone');

    let t_at_bottom = bottomTime - t_descent;
    if (t_at_bottom < 0) t_at_bottom = 0;

    let t_ascent = dtr - t_stops;
    if (t_ascent < 0) t_ascent = 0;

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
        `- ${t('requiredStopsLabel')} ${stopsStr}\n`;
}
function formatCellDataShort(plan) {
    const { diveParams } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = diveParams;
    return `${bottomTime}min @ ${maxDepth}m with ${formatGFstrings(gfLow, gfHigh)}`;
}

async function analysePlan(plan) {
    planDetailsTitle.textContent = `${t('profileLabelPrefix')} ${formatCellDataShort(plan)}`;
    planDetailsTxt.textContent = formatCellDataForDetails(plan)
    plotPlan(plan)
}
function hideTrace(i) {
    // || i === Math.floor(N_COMPARTMENTS / 2)
    const displayTrace = (i === 0)//|| i === N_COMPARTMENTS - 1)
    return !displayTrace;
}

// Define a color palette for the compartment traces
const colorPalette = [
    '#1f77b4',
    '#ff7f0e',
    '#2ca02c',
    '#d62728',
    '#9467bd',
    '#8c564b',
    '#e377c2',
    '#7f7f7f',
    '#bcbd22',
    '#17becf',
    '#aec7e8',
    '#ffbb78',
    '#98df8a',
    '#ff9896',
    '#c5b0d5',
    '#c49c94'
];
function getCompartmentColor(i) {
    return colorPalette[i % colorPalette.length];
}

function plotPlan(plan) {
    const { dtr, stops, t_descent, t_dive_total, t_stops, history, diveParams } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = diveParams;

    const timePoints = history.map(entry => entry.time);
    const depthPoints = history.map(entry => entry.depth);
    const PN2_Points = depthPoints.map(depthToPN2);

    // transpose to get a time series for each compartment
    const tensions_transp = Array(N_COMPARTMENTS).fill(null).map(() => []);
    history.forEach(entry => {
        entry.tensions.forEach((tension, i) => {
            tensions_transp[i].push(tension);
        });
    });

    const data_ply = [];

    // --- First Subplot: Time vs Depth/Tensions (Top Plot) ---
    const traceDiveProfile = {
        x: timePoints,
        y: PN2_Points,
        mode: 'lines',
        name: t('pn2ambiantLabel'),
        line: { color: 'black', width: 3 },
        yaxis: 'y1',
        xaxis: 'x1',
        legendgroup: `P_N2_ambiant`
    };
    data_ply.push(traceDiveProfile);

    for (let i = 0; i < N_COMPARTMENTS; i++) {
        const traceComp = {
            x: timePoints,
            y: tensions_transp[i],
            mode: 'lines+markers',
            name: `${t('compartmentLabel')}${i} (${BUEHLMANN.map(c => c.t12)[i]} min)`,
            line: { width: 1, color: getCompartmentColor(i) },
            yaxis: 'y1',
            xaxis: 'x1',
            legendgroup: `compartment${i}`
        };
        if (hideTrace(i)) { traceComp.visible = 'legendonly'; }
        data_ply.push(traceComp);
    }

    // --- Second Subplot: Ambient Pressure vs Tensions (Bottom Plot) ---
    // introduce a point slightly beyond max depth for better visualization
    const traceMainDiagonal = {
        x: [depthToPN2(0), depthToPN2(maxDepth)],
        y: [depthToPN2(0), depthToPN2(maxDepth)],
        mode: 'lines',
        name: t('pn2ambiantLabel'),
        line: { color: 'black', width: 3 },
        yaxis: 'y2',
        xaxis: 'x2',
        legendgroup: `P_N2_ambiant`,
        showlegend: false
    };
    data_ply.push(traceMainDiagonal);

    for (let i = 0; i < N_COMPARTMENTS; i++) {
        // plot the tension
        const traceTensionsVsPN2 = {
            x: PN2_Points,
            y: tensions_transp[i],
            mode: 'lines+markers',
            line: { width: 1, color: getCompartmentColor(i) },
            yaxis: 'y2',
            xaxis: 'x2',
            showlegend: false,
            legendgroup: `compartment${i}`
        };
        if (hideTrace(i)) { traceTensionsVsPN2.visible = 'legendonly'; }
        data_ply.push(traceTensionsVsPN2);

        // plot the M-Value line for this compartment
        const A = BUEHLMANN[i].A;
        const B = BUEHLMANN[i].B;
        const traceMValues = {
            x: [depthToPN2(0), depthToPN2(maxDepth)],
            y: [getMValue(A, B, SURFACE_PRESSURE_BAR), getMValue(A, B, depthToPressure(maxDepth))],
            name: `${t('mValueLabel')}`,
            line: { width: 1, color: getCompartmentColor(i), dash: 'dot' },
            mode: 'lines',
            yaxis: 'y2',
            xaxis: 'x2', legendgroup: `compartment${i}`
        };
        if (i > 0) traceMValues.showlegend = false;
        if (hideTrace(i)) { traceMValues.visible = 'legendonly'; }
        data_ply.push(traceMValues);

        // plot the modified M-Value line for this compartment
        const traceModifiedMValues = {
            x: [depthToPN2(0), depthToPN2(maxDepth)],
            y: [getModifiedMValue(A, B, SURFACE_PRESSURE_BAR, gfHigh), getModifiedMValue(A, B, depthToPressure(maxDepth), gfLow)],
            name: `${t('modifiedMValueLabel')}`,
            line: { width: 1, color: getCompartmentColor(i), dash: 'dash' },
            mode: 'lines',
            yaxis: 'y2',
            xaxis: 'x2', legendgroup: `compartment${i}`
        };
        if (i > 0) traceModifiedMValues.showlegend = false;
        if (hideTrace(i)) { traceModifiedMValues.visible = 'legendonly'; }
        data_ply.push(traceModifiedMValues);
    }

    const layout = {
        title: t('tensionsTSTitle'),
        grid: {
            rows: 2,
            columns: 1,
            pattern: 'independent',
            roworder: 'top to bottom'
        },
        xaxis: {
            title: t('timeLabel') + ' (min)',
            rangemode: 'tozero'
        },
        yaxis: {
            title: t('compartmentTensionLabel') + ' (bar)',
            rangemode: 'tozero'
        },
        xaxis2: {
            title: t('pn2ambiantLabel') + ' (bar)',
            rangemode: 'tozero'
        },
        yaxis2: {
            title: t('compartmentTensionLabel') + ' (bar)',
            rangemode: 'tozero'
        },
        legend: {
            xanchor: "left",
            yanchor: "top",
            x: 1,
            y: 1,
        },
        // height: 800 // decided in the css
    };

    if (window.innerWidth < 300) { // mobile device
        layout.showlegend = false;
    }

    Plotly.newPlot('plotly-plot', data_ply, layout, { scrollZoom: true });
}
