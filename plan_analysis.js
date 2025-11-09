function formatGFstrings(gfLow, gfHigh) {
    return `${t('GF')} ${Math.round(100 * gfLow)} / ${Math.round(100 * gfHigh)}`;
}

function formatCellDataForDetails(plan) {
    const { dtr, stops, t_descent, totalDiveTime, history, diveParams } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = diveParams;

    let stopsStr = stops.map(s => `${s.time} min @ ${s.depth}m`).join(', ');
    if (stops.length === 0) stopsStr = t('stopsNone');

    return `${t('diveProfileTitle')}\n` +
        `- ${t('maxDepthLabel')} ${maxDepth} meters\n` +
        `- ${t('bottomTimeLabel')} ${bottomTime} minutes\n` +
        `- ${t('gradientFactorsLabel')} ${formatGFstrings(gfLow, gfHigh)}\n` +
        `- ${t('calculatedDTRLabel')} ${Math.ceil(dtr)} minutes\n` +
        `- ${t('calculatedt_descentLabel')} ${t_descent} minutes\n` +
        `- ${t('calculatedTotalDiveTimeLabel')} ${totalDiveTime} minutes\n` +
        `- ${t('requiredStopsLabel')} ${stopsStr}\n`;
}
function formatCellDataShort(plan) {
    const { diveParams } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = diveParams;
    return `${bottomTime}min @ ${maxDepth}m with ${formatGFstrings(gfLow, gfHigh)}`;
}

async function analysePlan(plan) {
    detailsPlanH2.textContent = `${t('profileLabelPrefix')} ${formatCellDataShort(plan)}`;
    detailsResult.textContent = formatCellDataForDetails(plan)
    plotPlan(plan)
}
function hideTrace(i) {
    // || i === Math.floor(N_COMPARTMENTS / 2)
    const displayTrace = (i === 0 || i === N_COMPARTMENTS - 1)
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
    const { dtr, stops, t_descent, totalDiveTime, history, diveParams } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = diveParams;

    const timePoints = history.map(entry => entry.time);
    const depthPoints = history.map(entry => entry.depth);
    const P_N2_ambiantPoints = depthPoints.map(depthToPN2);

    // transpose to get a time series for each compartment
    const Tn2_transposed = Array(N_COMPARTMENTS).fill(null).map(() => []);
    history.forEach(entry => {
        entry.Tn2.forEach((tension, i) => {
            Tn2_transposed[i].push(tension);
        });
    });

    const data_ply = [];

    // --- First Subplot: Time vs Depth/Tensions (Top Plot) ---
    const traceDiveProfile = {
        x: timePoints,
        y: P_N2_ambiantPoints,
        mode: 'lines+markers',
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
            y: Tn2_transposed[i],
            mode: 'lines+markers',
            name: `${t('compartmentLabel')}${i + 1} (${BUEHLMANN.map(c => c.t12)[i]} min)`,
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
    pn2_max = depthToPN2(maxDepth);
    P_max = depthToPressure(maxDepth);
    const traceMainDiag = {
        x: [0, pn2_max],
        y: [0, pn2_max],
        mode: 'lines',
        name: t('pn2ambiantLabel'),
        line: { color: 'black', width: 3 },
        yaxis: 'y2',
        xaxis: 'x2',
        legendgroup: `P_N2_ambiant`,
        showlegend: false
    };
    data_ply.push(traceMainDiag);
    for (let i = 0; i < N_COMPARTMENTS; i++) {
        // plot the tension
        const traceCompVsAmbient = {
            x: P_N2_ambiantPoints,
            y: Tn2_transposed[i],
            mode: 'lines+markers',
            line: { width: 1, color: getCompartmentColor(i) },
            yaxis: 'y2',
            xaxis: 'x2',
            showlegend: false,
            legendgroup: `compartment${i}`
        };
        if (hideTrace(i)) { traceCompVsAmbient.visible = 'legendonly'; }
        data_ply.push(traceCompVsAmbient);

        // plot the M-Value line for this compartment
        const A = BUEHLMANN[i].A;
        const B = BUEHLMANN[i].B;
        const traceMValueLine = {
            x: [0, pn2_max],
            y: [0, getMValue(A, B, P_max)],
            name: `${t('mValueLabel')} ${i + 1}`,
            line: { width: 1, color: getCompartmentColor(i), dash: 'dot' },
            // showlegend: false,
            mode: 'lines',
            yaxis: 'y2',
            xaxis: 'x2', legendgroup: `compartment${i}`
        };
        if (hideTrace(i)) { traceMValueLine.visible = 'legendonly'; }
        data_ply.push(traceMValueLine);

        // plot the modified M-Value line for this compartment
        const GF = getInterpolatedGF(maxDepth, maxDepth, gfLow, gfHigh);
        const traceModifiedMValueLine = {
            x: [0, pn2_max],
            y: [0, getModifiedMValue(A, B, P_max, GF)],
            name: `${t('modifiedMValueLabel')} ${i + 1}`,
            line: { width: 1, color: getCompartmentColor(i), dash: 'dash' },
            // showlegend: false,
            mode: 'lines',
            yaxis: 'y2',
            xaxis: 'x2', legendgroup: `compartment${i}`
        };
        if (hideTrace(i)) { traceModifiedMValueLine.visible = 'legendonly'; }
        data_ply.push(traceModifiedMValueLine);
    }

    const layout = {
        title: t('tensionsTSTitle'),
        grid: {
            rows: 1,
            columns: 2,
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
            x: 0.5,
            y: 1,
            xanchor: 'right'
        },
        height: 800
    };

    Plotly.newPlot('plotly-plot', data_ply, layout, { scrollZoom: true });
}
