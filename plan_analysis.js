function formatCellDataForDetails(planData) {
    const { dtr, stops, t_descent, totalDiveTime, params } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = params;

    let stopsStr = stops.map(s => `${s.time} min @ ${s.depth}m`).join(', ');
    if (stops.length === 0) stopsStr = t('stopsNone');

    return `${t('diveProfileTitle')}\n` +
        `- ${t('maxDepthLabel')} ${maxDepth} meters\n` +
        `- ${t('bottomTimeLabel')} ${bottomTime} minutes\n` +
        `- ${t('gradientFactorsLabel')} GF ${gfLow} / ${gfHigh}\n` +
        `- ${t('calculatedDTRLabel')} ${dtr} minutes\n` +
        `- ${t('calculatedt_descentLabel')} ${t_descent} minutes\n` +
        `- ${t('requiredStopsLabel')} ${stopsStr}\n`;
}
function formatCellDataShort(plan) {
    const { dtr, stops, t_descent, totalDiveTime, params } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = params;
    return `${bottomTime}min @ ${maxDepth}m with GF ${gfLow} / ${gfHigh}`;
}

async function analysePlan(plan) {
    detailsPlanH2.textContent = `${t('profileLabelPrefix')} ${formatCellDataShort(plan)}`;
    detailsResult.textContent = formatCellDataForDetails(plan)
    plotPlan(plan)
}

function plotPlan(plan) {
    console.log(plan)
    const { dtr, stops, t_descent, totalDiveTime, params } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = params;

    const labelsX = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const dataLigne1 = labelsX.map(x => x * 2);
    const dataLigne2 = labelsX.map(x => x * x);
    const trace1 = {
        x: labelsX,
        y: dataLigne1,
        mode: 'lines',
        name: 'Ligne y = 2x'
    };
    const trace2 = {
        x: labelsX,
        y: dataLigne2,
        mode: 'lines',
        name: 'Ligne y = x^2'
    };

    const data_ply = [trace1, trace2 /*, trace3, ... */];

    const layout = {
        title: 'Mon Super Graphique Plotly',
        xaxis: {
            title: 'Axe X'
        },
        yaxis: {
            title: 'Axe Y'
        }
    };

    Plotly.newPlot('plotly-plot', data_ply, layout);
}
