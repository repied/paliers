function formatGFstrings(gfLow, gfHigh) {
    return `${t('GF')} ${Math.round(100 * gfLow)} / ${Math.round(100 * gfHigh)}`;
}

function formatCellDataForDetails(plan) {
    const { dtr, stops, t_descent, totalDiveTime, params } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = params;

    let stopsStr = stops.map(s => `${s.time} min @ ${s.depth}m`).join(', ');
    if (stops.length === 0) stopsStr = t('stopsNone');

    return `${t('diveProfileTitle')}\n` +
        `- ${t('maxDepthLabel')} ${maxDepth} meters\n` +
        `- ${t('bottomTimeLabel')} ${bottomTime} minutes\n` +
        `- ${t('gradientFactorsLabel')} ${formatGFstrings(gfLow, gfHigh)}\n` +
        `- ${t('calculatedDTRLabel')} ${Math.ceil(dtr)} minutes\n` +
        `- ${t('calculatedt_descentLabel')} ${t_descent} minutes\n` +
        `- ${t('requiredStopsLabel')} ${stopsStr}\n`;
}
function formatCellDataShort(plan) {
    const { dtr, stops, t_descent, totalDiveTime, params } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = params;
    return `${bottomTime}min @ ${maxDepth}m with ${formatGFstrings(gfLow, gfHigh)}`;
}

async function analysePlan(plan) {
    detailsPlanH2.textContent = `${t('profileLabelPrefix')} ${formatCellDataShort(plan)}`;
    detailsResult.textContent = formatCellDataForDetails(plan)
    plotPlan(plan)
}

function plotPlan(plan) {
    const { dtr, stops, t_descent, totalDiveTime, params, Tn2_history, compartmentHalfTimes } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = params;

    const timePoints = Tn2_history.map(entry => entry.time);
    const depthPoints = Tn2_history.map(entry => entry.depth);
    const Tn2_compartments_data = Array(16).fill(null).map(() => []);

    Tn2_history.forEach(entry => {
        entry.Tn2.forEach((tension, i) => {
            Tn2_compartments_data[i].push(tension);
        });
    });

    const traceDiveProfile = {
        x: timePoints,
        y: depthPoints,
        mode: 'lines',
        name: t('diveProfileLabel'),
        line: { color: 'blue', width: 3 },
        yaxis: 'y1'
    };

    const data_ply = [traceDiveProfile];

    for (let i = 0; i < 16; i++) {
        data_ply.push({
            x: timePoints,
            y: Tn2_compartments_data[i],
            mode: 'lines',
            name: `${t('compartmentLabel')} ${i + 1} (T1/2: ${compartmentHalfTimes[i]} min)`,
            line: { dash: 'dot', width: 1, color: `hsl(${i * (360 / 16)}, 70%, 50%)` },
            yaxis: 'y2',
            visible: 'legendonly'
        });
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
