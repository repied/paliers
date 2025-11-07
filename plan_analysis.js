function formatCellDataForDetails(plan) {
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
    const { dtr, stops, t_descent, totalDiveTime, params } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = params;

    const timePoints = [0];
    const depthPoints = [0];
    let currentTime = 0;

    // Descent
    currentTime += t_descent;
    timePoints.push(currentTime);
    depthPoints.push(maxDepth);

    // Bottom
    currentTime += bottomTime - t_descent;
    timePoints.push(currentTime);
    depthPoints.push(maxDepth);

    // Stops (or direct ascent if no stops)
    let lastDepth = maxDepth;
    if (stops.length > 0) {
        stops.forEach(stop => {
            // Ascent to stop
            let t_climb = (lastDepth - stop.depth) / ASCENT_RATE;
            currentTime += t_climb;
            timePoints.push(currentTime);
            depthPoints.push(stop.depth);

            // Time at stop
            currentTime += stop.time;
            timePoints.push(currentTime);
            depthPoints.push(stop.depth);

            lastDepth = stop.depth;
        });
    }

    // Final ascent
    let t_climb_final = lastDepth / ASCENT_RATE;
    currentTime += t_climb_final;
    timePoints.push(currentTime);
    depthPoints.push(0);

    const trace = {
        x: timePoints,
        y: depthPoints,
        mode: 'lines',
        name: 'Dive Profile'
    };

    const data_ply = [trace];

    const layout = {
        title: t('diveProfileTitle'),
        xaxis: {
            title: 'Time (min)'
        },
        yaxis: {
            title: 'Depth (m)',
            autorange: 'reversed'
        }
    };

    Plotly.newPlot('plotly-plot', data_ply, layout);
}
