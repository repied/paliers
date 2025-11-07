// --- DOM References ---
const canvas = document.getElementById('decoCanvas');
const ctx = canvas.getContext('2d');
const bottomTimeInput = document.getElementById('bottomTime');
const maxDepthInput = document.getElementById('maxDepth');
const bottomTimeSlider = document.getElementById('bottomTimeSlider');
const maxDepthSlider = document.getElementById('maxDepthSlider');

const detailsContainer = document.getElementById('details-analysis-container');
const detailsProfileLabel = document.getElementById('details-selected-profile');
const detailsResult = document.getElementById('details-result');
const mainTitle = document.getElementById('main-title');
const intro1 = document.getElementById('intro-1');
const intro2 = document.getElementById('intro-2');
const canvastitle = document.getElementById('canvas-title');
const readmeLink = document.getElementById('readme-link');
const labelMaxDepth = document.getElementById('label-maxDepth');
const labelBottomTime = document.getElementById('label-bottomTime');

// --- State variables ---
let W_all = canvas.width;
let H = canvas.height;
let LABEL_MARGIN = W_all * 0.1;
let W = W_all - LABEL_MARGIN / 2
let CELL_SIZE = (W - LABEL_MARGIN) / (1 + GF_N_INCR); // N+1 cells for 0-100%
let currentGridData = [];
let tooltip = { active: false, x: 0, y: 0, data: null };
let selectedCell = null;

// --- Language functions ---
function applyLanguageToDOM() {
    mainTitle.textContent = t('title');
    intro1.textContent = t('intro1');
    canvastitle.textContent = t('canvastitle');
    readmeLink.textContent = t('readme');
    labelMaxDepth.textContent = t('maxDepth');
    labelBottomTime.textContent = t('bottomTime');
    // update readme href from data attributes
    if (readmeLink) {
        const href = readmeLink.getAttribute(`data-href-${window.CURRENT_LANG}`);
        readmeLink.setAttribute('href', href);
    }
    // set selector value and active btn
    const btns = document.querySelectorAll('.lang-btn');
    btns.forEach(b => b.classList.toggle('active', b.dataset.lang === window.CURRENT_LANG));
    drawCanvas();
    detailsContainer.style.display = 'none';
    selectedCell = null;
}

// --- Canvas drawing functions ---
function calculatePlanForAllCells() {
    const BT = parseInt(bottomTimeInput.value);
    const D = parseInt(maxDepthInput.value);

    currentGridData = [];
    for (let i = 0; i <= GF_N_INCR; i++) { // GF Low (0 to 100)
        const gfLow = (i * GF_INCREMENT) / 100;
        let row = [];
        for (let j = 0; j <= GF_N_INCR; j++) { // GF High (0 to 100)
            const gfHigh = (j * GF_INCREMENT) / 100;
            const data = calculatePlan(BT, D, gfLow, gfHigh);
            data.gfLow = Math.round(gfLow * 100);
            data.gfHigh = Math.round(gfHigh * 100);
            data.profileParams = { BT, maxDepth: D, t_descent: data.t_descent, totalDiveTime: data.totalDiveTime };
            row.push(data);
        }
        currentGridData.push(row);
    }
    // redraw and hide details
    drawCanvas();
    detailsContainer.style.display = 'none';
    selectedCell = null;
}

function getColorForValue(value) {
    // Short/aggressive DTR (close to 0) -> Green
    // Long/conservative DTR (close to 1) -> Red
    const C1 = { r: 40, g: 167, b: 69 }; // Green
    const C2 = { r: 255, g: 193, b: 7 }; // Yellow
    const C3 = { r: 220, g: 53, b: 69 }; // Red

    let color = {};
    if (value <= 0.5) {
        // Goes from C1 (Green) to C2 (Yellow)
        const ratio = value * 2;
        color.r = Math.round(C1.r + (C2.r - C1.r) * ratio);
        color.g = Math.round(C1.g + (C2.g - C1.g) * ratio);
        color.b = Math.round(C1.b + (C2.b - C1.b) * ratio);
    } else {
        // Goes from C2 (Yellow) to C3 (Red)
        const ratio = (value - 0.5) * 2;
        color.r = Math.round(C2.r + (C3.r - C2.r) * ratio);
        color.g = Math.round(C2.g + (C3.r - C2.g) * ratio);
        color.b = Math.round(C2.b + (C3.b - C2.b) * ratio);
    }
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function drawCanvas() {
    ctx.clearRect(0, 0, W, H);

    // 1. Draw Labels
    ctx.fillStyle = '#343a40';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // GF High Labels (X Axis)
    ctx.fillText(t('gfHigh'), (LABEL_MARGIN + W) / 2, LABEL_MARGIN / 2);
    for (let j = 0; j <= GF_N_INCR; j++) {
        const x = LABEL_MARGIN + j * CELL_SIZE + CELL_SIZE / 2;
        ctx.fillText((j * GF_INCREMENT).toString(), x, LABEL_MARGIN - 20);
    }

    // GF Low Labels (Y Axis)
    ctx.save();
    ctx.translate(LABEL_MARGIN / 2, (LABEL_MARGIN + H) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(t('gfLow'), 0, 0);
    ctx.restore();
    for (let i = 0; i <= GF_N_INCR; i++) {
        const y = LABEL_MARGIN + i * CELL_SIZE + CELL_SIZE / 2;
        ctx.fillText((i * GF_INCREMENT).toString(), LABEL_MARGIN - 25, y);
    }

    // 2. Draw Grid
    let minDTR = Infinity;
    let maxDTR = 0;
    for (let i = 0; i <= GF_N_INCR; i++) { // GF Low (0 to 100)
        for (let j = 0; j <= GF_N_INCR; j++) { // GF High (0 to 100)
            data = currentGridData[i][j]
            // Color normalization (only for dives WITH stops)
            if (data.dtr > 0 && data.dtr !== Infinity && data.stops.length > 0) {
                minDTR = Math.min(minDTR, data.dtr);
                maxDTR = Math.max(maxDTR, data.dtr);
            }
        }
    }
    // If only dives without stops, avoid division by zero
    if (minDTR === Infinity) minDTR = 0;
    if (maxDTR === 0) maxDTR = 1;
    const rangeDTR = maxDTR - minDTR;

    for (let i = 0; i < currentGridData.length; i++) {
        for (let j = 0; j < currentGridData[i].length; j++) {
            const data = currentGridData[i][j];
            const { dtr, stops } = data;
            const x = LABEL_MARGIN + j * CELL_SIZE;
            const y = LABEL_MARGIN + i * CELL_SIZE;

            // Cell background
            if (isNaN(dtr) || dtr === Infinity) {
                ctx.fillStyle = '#adb5bd'; // N/A (GF Low > GF High) or Impossible -> Gray background
            } else if (stops.length === 0) {
                ctx.fillStyle = '#ffffff'; // White if "No Stop"
            } else {
                // Normalization
                const norm = (rangeDTR > 0) ? (dtr - minDTR) / rangeDTR : 0;
                ctx.fillStyle = getColorForValue(Math.max(0, Math.min(1, norm)));
            }
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

            // Border
            ctx.strokeStyle = '#dee2e6';
            ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

            // Cell text (DTR)
            ctx.fillStyle = '#212529';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (isNaN(dtr) || dtr === Infinity) {
                ctx.fillStyle = '#fff';
                ctx.font = '11px Inter';
                ctx.fillText('X', x + CELL_SIZE / 2, y + CELL_SIZE / 2);
            } else if (stops.length === 0) {
                ctx.font = '10px Inter'; // Smaller font
                ctx.fillText('', x + CELL_SIZE / 2, y + CELL_SIZE / 2);
            } else {
                ctx.font = 'bold 12px Inter';
                ctx.fillText(dtr.toString(), x + CELL_SIZE / 2, y + CELL_SIZE / 2);
            }
        }
    }

    // 3. Draw Tooltip (Info bubble)
    if (tooltip.active && tooltip.data) {
        drawTooltip(tooltip.x, tooltip.y, tooltip.data);
    }
}

function drawTooltip(mouseX, mouseY, data) {
    const { dtr, stops, gfLow, gfHigh, profileParams } = data;
    const { BT, maxDepth, t_descent, totalDiveTime } = profileParams;

    // Tooltip dimensions
    const ttW = 200, ttH = 220;
    const ttPad = 10;
    const graphH = 100, legendH = 90;

    // Positioning (avoid going off screen)
    let ttX = mouseX + 15;
    let ttY = mouseY + 15;
    if (ttX + ttW > W) ttX = mouseX - ttW - 15;
    if (ttY + ttH > H) ttY = mouseY - ttH - 15;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(ttX, ttY, ttW, ttH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 1; // Reset

    // Title
    ctx.fillStyle = '#0056b3';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${t('withGF')} ${gfLow}/${gfHigh} | ${t('calculatedDTRLabel')} ${dtr} min`, ttX + ttPad, ttY + ttPad);

    // Handle "No Stop" or "N/A" cases
    if (isNaN(dtr) || dtr === Infinity) {
        ctx.fillStyle = '#333';
        ctx.font = '12px Inter';
        ctx.fillText(t('profileNotApplicable'), ttX + ttPad, ttY + 40);
        return;
    }

    // --- Draw micro-graph ---
    const graphX = ttX + ttPad, graphY = ttY + 35;
    const graphW = ttW - 2 * ttPad;

    // Graph background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = '#ced4da';
    ctx.strokeRect(graphX, graphY, graphW, graphH);

    // Scale calculations
    const maxTime = totalDiveTime;
    // Y scale: 0m (top) to maxDepth (bottom)
    const scaleY = (depth) => (depth / maxDepth) * graphH;
    // X scale: 0 (left) to maxTime (right)
    const scaleX = (time) => (time / maxTime) * graphW;

    ctx.strokeStyle = '#007bff'; // Profile color
    ctx.lineWidth = 2;
    ctx.beginPath();

    let currentTime = 0;

    // 1. Start (0, 0)
    ctx.moveTo(graphX + scaleX(currentTime), graphY + scaleY(0));

    // 2. Descent
    currentTime += t_descent;
    ctx.lineTo(graphX + scaleX(currentTime), graphY + scaleY(maxDepth));

    // 3. Bottom
    currentTime += BT;
    ctx.lineTo(graphX + scaleX(currentTime), graphY + scaleY(maxDepth));

    // 4. Stops (or direct ascent if no stops)
    let lastDepth = maxDepth;
    if (stops.length > 0) {
        stops.forEach(stop => {
            // Ascent to stop
            let t_climb = (lastDepth - stop.depth) / ASCENT_RATE;
            currentTime += t_climb;
            ctx.lineTo(graphX + scaleX(currentTime), graphY + scaleY(stop.depth));

            // Time at stop
            currentTime += stop.time;
            ctx.lineTo(graphX + scaleX(currentTime), graphY + scaleY(stop.depth));

            lastDepth = stop.depth;
        });
    }

    // 5. Final ascent
    let t_climb_final = lastDepth / ASCENT_RATE;
    currentTime += t_climb_final;
    ctx.lineTo(graphX + scaleX(currentTime), graphY + scaleY(0));

    ctx.stroke();
    ctx.lineWidth = 1; // Reset

    // --- Draw Legend (Text) ---
    const legendX = ttX + ttPad, legendY = graphY + graphH + ttPad;
    ctx.fillStyle = '#343a40';
    ctx.font = '11px Inter';

    let stopsStr = stops.map(s => `${s.time} min @ ${s.depth}m`).join(', ');
    if (stops.length === 0) {
        stopsStr = t('stopsNone');
    }

    // Function to wrap text
    function wrapText(text, x, y, maxWidth, lineHeight) {
        let words = text.split(' ');
        let line = '';
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            let testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, y);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, y);
    }

    wrapText(`${t('stopsLabel')} ${stopsStr}`, legendX, legendY, graphW, 14);
}

function getCellFromMousePos(mouseX, mouseY) {
    if (mouseX < LABEL_MARGIN || mouseY < LABEL_MARGIN) {
        return null;
    }
    const j = Math.floor((mouseX - LABEL_MARGIN) / CELL_SIZE); // Column (GF High)
    const i = Math.floor((mouseY - LABEL_MARGIN) / CELL_SIZE); // Row (GF Low)

    if (i >= 0 && i < currentGridData.length && j >= 0 && j < currentGridData[0].length) {
        return { i, j, data: currentGridData[i][j] };
    }
    return null;
}


// --- Event listeners ---

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
const debouncedRunCalculation = debounce(calculatePlanForAllCells, 250);


// --- Inputs listeners (depth and time) ---
[bottomTimeInput, maxDepthInput].forEach(input => {
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            calculatePlanForAllCells();
        }
    });
    // Synchronize to sliders
    input.addEventListener('input', () => {
        if (input.id === 'bottomTime') bottomTimeSlider.value = input.value;
        if (input.id === 'maxDepth') maxDepthSlider.value = input.value;
    });
});

// Sliders
[bottomTimeSlider, maxDepthSlider].forEach(slider => {
    slider.addEventListener('input', () => {
        // Update numeric field
        if (slider.id === 'bottomTimeSlider') bottomTimeInput.value = slider.value;
        if (slider.id === 'maxDepthSlider') maxDepthInput.value = slider.value;
        // Run calculation (with debounce)
        debouncedRunCalculation();
    });
});

// --- Canvas listeners (Tooltip and Click) ---

// display tooltips on mouse over
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const cell = getCellFromMousePos(mouseX, mouseY);

    if (cell) {
        tooltip.active = true;
        tooltip.x = mouseX;
        tooltip.y = mouseY;
        tooltip.data = cell.data;
    } else {
        tooltip.active = false;
    }
    drawCanvas()
});

canvas.addEventListener('mouseout', () => {
    tooltip.active = false;
    drawCanvas()
});

// display details on click on a cell
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const cell = getCellFromMousePos(mouseX, mouseY);

    if (cell && cell.data && !isNaN(cell.data.dtr)) {
        selectedCell = cell.data;
        detailsContainer.style.display = 'block';
        detailsProfileLabel.textContent = `${t('profileLabelPrefix')} ${formatCellDataShort(selectedCell)}`;
        analysePlan(selectedCell);
        detailsContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
        detailsContainer.style.display = 'none';
        selectedCell = null;
    }
});

// --- language listeners ---
document.querySelectorAll('.lang-btn').forEach(b => {
    b.addEventListener('click', () => setLanguage(b.dataset.lang));
});

// Theme toggle logic
document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;

    function setDarkTheme(isDarkMode) {
        if (isDarkMode) {
            body.classList.add('dark-mode');
            themeToggleBtn.textContent = '☀️';
            themeToggleBtn.title = 'Switch to light mode';
        } else {
            body.classList.remove('dark-mode');
            themeToggleBtn.textContent = '🌙';
            themeToggleBtn.title = 'Switch to dark mode';
        }
    }

    // Load theme preference from localStorage
    function loadThemePreference() {
        const savedTheme = localStorage.getItem('theme');
        // Check for system preference if no saved theme
        if (savedTheme === null) {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                setDarkTheme(true); // System is dark, apply dark mode
                localStorage.setItem('theme', 'dark');
            } else {
                setDarkTheme(false); // System is light or no preference, apply light mode
                localStorage.setItem('theme', 'light');
            }
        } else if (savedTheme === 'dark') {
            setDarkTheme(true);
        } else {
            setDarkTheme(false);
        }
    }

    // Toggle theme on button click
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDarkMode = body.classList.contains('dark-mode');
            setDarkTheme(!isDarkMode);
            localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
        });
    }

    // Apply theme on page load
    loadThemePreference();
});

// Initial launch
document.addEventListener('DOMContentLoaded', calculatePlanForAllCells);
document.addEventListener('DOMContentLoaded', applyLanguageToDOM);
