function formatCellDataForDetails(planData) {
    const { dtr, stops, gfLow, gfHigh, profileParams } = planData;
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
function formatCellDataShort(planData) {
    const { dtr, stops, gfLow, gfHigh, profileParams } = planData;
    const { BT, maxDepth } = profileParams;
    return `${BT}min @ ${maxDepth}m with GF ${gfLow} / ${gfHigh}`;
}

async function analysePlan(planData) {
    detailsPlanH2.textContent = `${t('profileLabelPrefix')} ${formatCellDataShort(planData)}`;
    detailsResult.textContent = formatCellDataForDetails(planData)
    plotPlan(planData)
}

function plotPlan(planData) {
    // console.log(planData)
    // function plotly_plan()

    // 3. PRÉPAREZ VOS DONNÉES
    // C'est ici que vos "calculs" JavaScript interviennent.
    // Vous devez générer vos points.
    // Par exemple, pour un axe X de 0 à 10 :
    const labelsX = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // Vos 10 lignes de données (calculées)
    const dataLigne1 = labelsX.map(x => x * 2); // y = 2x
    const dataLigne2 = labelsX.map(x => x * x); // y = x^2

    // 2. DÉFINIR VOS "TRACES" (les objets de données)

    // Votre première ligne
    const trace1 = {
        x: labelsX,         // Les données X
        y: dataLigne1,      // Les données Y
        mode: 'lines',      // Type de tracé : 'lines', 'markers', 'lines+markers'
        name: 'Ligne y = 2x'  // Nom pour la légende
    };

    // Votre deuxième ligne
    const trace2 = {
        x: labelsX,
        y: dataLigne2,
        mode: 'lines',
        name: 'Ligne y = x^2'
    };

    // ... définissez vos 8 autres traces de la même manière

    // 3. REGROUPER LES TRACES
    // C'est simplement un tableau de vos objets "trace"
    const data_ply = [trace1, trace2 /*, trace3, ... */];

    // 4. DÉFINIR LE "LAYOUT" (l'apparence du graphique)
    const layout = {
        title: 'Mon Super Graphique Plotly',
        xaxis: {
            title: 'Axe X'
        },
        yaxis: {
            title: 'Axe Y'
        }
    };

    // 5. CRÉER LE GRAPHIQUE
    // On dit à Plotly de créer un nouveau graphique
    // dans le <div> 'monGraphiquePlotly'
    // en utilisant les données 'data_ply' et le style 'layout'.
    Plotly.newPlot('plotlyplot', data_ply, layout);
}
