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
    // transpose to get a time series for each compartment
    const Tn2_compartments_data = Array(N_COMPARTMENTS).fill(null).map(() => []);
    Tn2_history.forEach(entry => {
        entry.Tn2.forEach((tension, i) => {
            Tn2_compartments_data[i].push(tension);
        });
    });
    // debugger;
    const traceDiveProfile = {
        x: timePoints,
        y: depthPoints,
        mode: 'lines',
        name: t('diveProfileLabel'),
        line: { color: 'blue', width: 3 },
        yaxis: 'y1'
    };

    const data_ply = [traceDiveProfile];

    for (let i = 0; i < N_COMPARTMENTS; i++) {
        traceComp = {
            x: timePoints,
            y: Tn2_compartments_data[i],
            mode: 'lines',
            name: `${t('compartmentLabel')} ${i + 1} (T1/2: ${BUEHLMANN_CONSTANTS.map(c => c.t12)[i]} min)`,
            line: { dash: 'dot', width: 1, color: `hsl(${i * (360 / N_COMPARTMENTS)}, 70%, 50%)` },
            yaxis: 'y2',
            visible: 'legendonly'
        };
        data_ply.push(traceComp);
    }

    const layout = {
        title: t('diveProfileTitle'),
        // width: 1200,
        xaxis: {
            title: t('timeLabel') + ' (min)'
        },
        yaxis: {
            title: t('depthLabel') + ' (m)',
            autorange: 'reversed',
            side: 'left',
            position: 0.05
        },
        yaxis2: {
            title: t('partialPressureLabel') + ' (bar)',
            overlaying: 'y',
            side: 'right',
            showgrid: false,
            zeroline: false,
            position: 0.95,
            rangemode: 'tozero',
            autorange: 'reversed'
        },
        legend: {
            x: 1.02,
            y: 1,
            xanchor: 'left'
        },
        margin: {
            r: 80
        }
    };

    Plotly.newPlot('plotly-plot', data_ply, layout);
}


// now add on the same plotly graph a second vertical axis with the partial pressures of all 16 compartiments . you can use the schreinerEquation() functions from #file:gf.js to compute the pressures/tensions along the dive profile. Let the user have the possibility to select/unselect those curves by adding a legend
