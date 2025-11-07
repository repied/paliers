function formatCellDataForDetails(data) {
    const { dtr, stops, gfLow, gfHigh, profileParams } = data;
    const { BT, maxDepth } = profileParams;

    let stopsStr = stops.map(s => `${s.time} min @ ${s.depth}m`).join(', ');
    if (stops.length === 0) stopsStr = t('stopsNone');

    return `${t('diveProfileTitle')}\n` +
        `- ${t('maxDepthLabel')} ${maxDepth} meters\n` +
        `- ${t('bottomTimeLabel')} ${BT} minutes\n` +
        `- ${t('gradientFactorsLabel')} GF ${gfLow} / ${gfHigh}\n` +
        `- ${t('calculatedDTRLabel')} ${dtr} minutes\n` +
        `- ${t('requiredStopsLabel')} ${stopsStr}\n`;
}
function formatCellDataShort(data) {
    const { dtr, stops, gfLow, gfHigh, profileParams } = data;
    const { BT, maxDepth } = profileParams;
    return `${BT}min @ ${maxDepth}m with GF ${gfLow} / ${gfHigh}`;
}

async function analysePlan(cellData) {
    // TODO add graphs details
    detailsResult.textContent = formatCellDataForDetails(cellData)
}
