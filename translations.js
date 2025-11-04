TRANSLATIONS = {
  "en": {
    "title": "Bühlmann Gradient Factors visualizer",
    "canvastitle": "Time To Surface",
    "intro1": "This tool implements a simplified Bühlmann ZHL-16C algorithm. Total time to surface (TTS) is computed for different gradient factor values. Resulting TTS in minutes are shown in a color coded grid. Decompression profiles appear as small plots on hover and details on click.",
    "readme": "Detailed explanations",
    "maxDepth": "Maximum depth (m):",
    "bottomTime": "Bottom time (min):",
    "gfHigh": "GF High (%)",
    "gfLow": "GF Low (%)",
    "profileLabelPrefix": "Plan analysis:",
    "profileNotApplicable": "Profile not applicable",
    "stopsNone": "No stop required",
    "stopsLabel": "Stops:",
    "diveProfileTitle": "Dive profile:",
    "maxDepthLabel": "Max depth:",
    "bottomTimeLabel": "Bottom time:",
    "gradientFactorsLabel": "Gradient Factors:",
    "calculatedDTRLabel": "TTS:",
    "requiredStopsLabel": "Required stops:",
    "withGF": "FG"
  },
  "fr": {
    "title": "Visualisation des facteurs de gradient",
    "canvastitle": "Durée Totale de Remontée",
    "intro1": "Cet outil implémente un algorithme Bühlmann ZHL-16C simplifié. La durée totale de remontée (DTR) est calculée pour de différentes valeurs des facteurs de gradient. Les DTR résultantes en minutes sont rapportés sous forme de tableau codé par couleur. Les plans de décompression sont affichés sous forme de petits graphiques au survol de la souris. Des détails du plan sont aussi reportés lors d'un clic dans le tableau.",
    "readme": "Explications détaillées",
    "maxDepth": "Profondeur maximale en mètres :",
    "bottomTime": "Durée au fond en minutes :",
    "gfHigh": "GF High (%)",
    "gfLow": "GF Low (%)",
    "profileLabelPrefix": "Analyse du plan :",
    "profileNotApplicable": "Plan non applicable",
    "stopsNone": "Pas de paliers requis",
    "stopsLabel": "Paliers:",
    "diveProfileTitle": "Profil de plongée :",
    "maxDepthLabel": "Profondeur max :",
    "bottomTimeLabel": "Durée au fond :",
    "gradientFactorsLabel": "Facteurs de gradient :",
    "calculatedDTRLabel": "DTR :",
    "requiredStopsLabel": "Paliers requis :",
    "withGF": "GF"
  }
}

window.CURRENT_LANG = window.CURRENT_LANG || (localStorage && localStorage.getItem && localStorage.getItem('paliers_lang')) || 'fr';

function t(key) {
  const dict = TRANSLATIONS[window.CURRENT_LANG];
  return (dict && dict[key]) || `Missing ${window.CURRENT_LANG} translation for ${key}`;
}

function setLanguage(lang) {
  window.CURRENT_LANG = lang;
  localStorage.setItem('paliers_lang', lang);
  applyLanguageToDOM();
}
