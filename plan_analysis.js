function formatGFstrings(gfLow, gfHigh) {
    return `${t('GF')} ${Math.round(100 * gfLow)} / ${Math.round(100 * gfHigh)}`;
}

function formatCellDataForDetails(plan) {
    const { dtr, stops, t_descent, totalDiveTime, diveParams } = plan;
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

function plotPlan(plan) {
    const { Tn2_history } = plan;

    const timePoints = Tn2_history.map(entry => entry.time);
    const depthPoints = Tn2_history.map(entry => entry.depth);
    const P_N2_ambiantPoints = depthPoints.map(depth => FN2 * depthToPressure(depth));
    // transpose to get a time series for each compartment
    const Tn2_compartments_data = Array(N_COMPARTMENTS).fill(null).map(() => []);
    Tn2_history.forEach(entry => {
        entry.Tn2.forEach((tension, i) => {
            Tn2_compartments_data[i].push(tension);
        });
    });

    const data_ply = [];

    // --- First Subplot: Time vs Depth/Tensions (Top Plot) ---
    const traceDiveProfile = {
        x: timePoints,
        y: P_N2_ambiantPoints,
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
            y: Tn2_compartments_data[i],
            mode: 'lines',
            name: `${t('compartmentLabel')}${i + 1} (${BUEHLMANN_CONSTANTS.map(c => c.t12)[i]} min)`,
            line: { width: 1, color: `hsl(${i * (360 / N_COMPARTMENTS)}, 70%, 50%)` },
            yaxis: 'y1',
            xaxis: 'x1',
            legendgroup: `compartment${i}`
        };
        if (!(i === 0 || i === N_COMPARTMENTS - 1 || i === Math.floor(N_COMPARTMENTS / 2))) {
            traceComp.visible = 'legendonly';
        }
        data_ply.push(traceComp);
    }

    // --- Second Subplot: Ambient Pressure vs Tensions (Bottom Plot) ---
    const traceDiveProfile2 = {
        x: P_N2_ambiantPoints,
        y: P_N2_ambiantPoints,
        mode: 'lines',
        name: t('pn2ambiantLabel'),
        line: { color: 'black', width: 3 },
        yaxis: 'y2',
        xaxis: 'x2',
        legendgroup: `P_N2_ambiant`,
        showlegend: false
    };
    data_ply.push(traceDiveProfile2);
    for (let i = 0; i < N_COMPARTMENTS; i++) {
        const traceCompVsAmbient = {
            x: P_N2_ambiantPoints,
            y: Tn2_compartments_data[i],
            mode: 'lines',
            line: { width: 1, color: `hsl(${i * (360 / N_COMPARTMENTS)}, 70%, 50%)` },
            yaxis: 'y2',
            xaxis: 'x2',
            showlegend: false,
            legendgroup: `compartment${i}`
        };
        if (!(i === 0 || i === N_COMPARTMENTS - 1 || i === Math.floor(N_COMPARTMENTS / 2))) {
            traceCompVsAmbient.visible = 'legendonly';
        }
        data_ply.push(traceCompVsAmbient);
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
            x: 1,
            y: 1,
            xanchor: 'right'
        },
        height: 800
    };

    Plotly.newPlot('plotly-plot', data_ply, layout);
}
