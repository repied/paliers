import { GFS_GRID_SIZE, GF_INCREMENT, MAX_STOP_TIME_BEFORE_INFTY, calculatePlan } from "./gf.js";
import { TRANSLATIONS } from "./translations.js";
import { analysePlan, formatGFstrings } from "./plan_analysis.js";
import { Lang, Plan, PlansGrid, Color, DiveParams, SelectedCell, Tooltip, Depth, Minutes } from "./types.js";

// --- DOM References ---
export const MOBILE_WIDTH_THRESHOLD = 600;

// --- DOM References ---
const canvas = document.getElementById('decoCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const bottomTimeInput = document.getElementById('bottom_time') as HTMLInputElement;
const maxDepthInput = document.getElementById('max_depth') as HTMLInputElement;
const ascentRateInput = document.getElementById('ascent_rate') as HTMLInputElement;
const descentRateInput = document.getElementById('descent_rate') as HTMLInputElement;
const surfacePressureInput = document.getElementById('surface_pressure') as HTMLInputElement;
const stopIntervalInput = document.getElementById('stop_interval') as HTMLInputElement;
const lastStopDepthInput = document.getElementById('last_stop_depth') as HTMLInputElement;
const timeStepInput = document.getElementById('simulation_step') as HTMLInputElement;
const addSafetyStopCheckbox = document.getElementById('add_safety_stop') as HTMLInputElement;
const safetyStopInputsContainer = document.getElementById('safety_stop_inputs') as HTMLDivElement;
const safetyStopDepthInput = document.getElementById('safety_stop_depth') as HTMLInputElement;
const safetyStopDurationInput = document.getElementById('safety_stop_duration') as HTMLInputElement;

const bottomTimeSlider = document.getElementById('bottom_time_slider') as HTMLInputElement;
const maxDepthSlider = document.getElementById('max_depth_slider') as HTMLInputElement;

// const mainTitle = document.getElementById('main-title') as HTMLHeadingElement;
// const into = document.getElementById('intro') as HTMLParagraphElement;
// const canvastitle = document.getElementById('canvas-title') as HTMLHeadingElement;
// const readmeLink = document.getElementById('readme-link') as HTMLAnchorElement;
// const labelMaxDepth = document.getElementById('label-maxDepth') as HTMLLabelElement;
// const labelBottomTime = document.getElementById('label-bottomTime') as HTMLLabelElement;
// const labelAscentRate = document.getElementById('label-ascent_rate') as HTMLLabelElement;
// const labelDescentRate = document.getElementById('label-descent_rate') as HTMLLabelElement;
// const labelSurfacePressure = document.getElementById('label-surface_pressure') as HTMLLabelElement;
// const labelStopInterval = document.getElementById('label-stop_interval') as HTMLLabelElement;
// const labelLastStopDepth = document.getElementById('label-last_stop_depth') as HTMLLabelElement;
// const labelTimeStep = document.getElementById('label-time_step') as HTMLLabelElement;
// const labelAddSafetyStop = document.getElementById('label-add_safety_stop') as HTMLLabelElement;
// const labelSafetyStopDepth = document.getElementById('label-safety_stop_depth') as HTMLLabelElement;
// const labelSafetyStopDuration = document.getElementById('label-safety_stop_duration') as HTMLLabelElement;


// --- State variables ---

// canvas is a square
let margin = (canvas.width * 0.10) / 2; // 5% on each side : margin -- grid -- margin
let grid_width = canvas.width - 2 * margin;
let cell_number = GFS_GRID_SIZE + 1;
let cell_width = grid_width / cell_number;

let calculatedPlans: PlansGrid = [];
let tooltip: Tooltip = { active: false, x: 0, y: 0, data: null };
const middleIdx = Math.floor(cell_number / 2);
let selectedCell: SelectedCell = { i: middleIdx, j: middleIdx }; // default selected cell
let currentLang: Lang = (localStorage.getItem('paliers_lang') as Lang) || 'fr';

// --- Language functions ---
export function t(key: keyof typeof TRANSLATIONS[keyof typeof TRANSLATIONS]): string {
    const dict = TRANSLATIONS[currentLang];
    return (dict && dict[key]) || `Missing ${currentLang} translation for ${key}`;
}

export function setLanguage(lang: Lang) {
    currentLang = lang;
    localStorage.setItem('paliers_lang', lang);
    applyLanguageAndDraw();
}
document.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach(b => {
    b.addEventListener('click', () => setLanguage(b.dataset.lang as Lang));
});

export function applyLanguageAndDraw(): void {
    // mainTitle.textContent = t('title');
    // if (window.innerWidth < MOBILE_WIDTH_THRESHOLD) {
    //     into.innerHTML = t('into_mobile');
    // } else {
    //     into.innerHTML = t('into');
    // }
    // canvastitle.textContent = t('canvastitle');
    // readmeLink.textContent = t('readme');
    // labelMaxDepth.textContent = t('maxDepth');
    // labelBottomTime.textContent = t('bottomTime');
    // labelAscentRate.textContent = t('label-ascent_rate');
    // labelDescentRate.textContent = t('label-descent_rate');
    // labelSurfacePressure.textContent = t('label-surface_pressure');
    // labelStopInterval.textContent = t('label-stop_interval');
    // labelLastStopDepth.textContent = t('label-last_stop_depth');
    // labelTimeStep.textContent = t('label-time_step');
    // labelAddSafetyStop.textContent = t('label-add_safety_stop');
    // labelSafetyStopDepth.textContent = t('label-safety_stop_depth');
    // labelSafetyStopDuration.textContent = t('label-safety_stop_duration');
    // // update readme href from data attributes
    // if (readmeLink) {
    //     const href = readmeLink.getAttribute(`data-href-${currentLang}`) as string;
    //     readmeLink.setAttribute('href', href);
    // }
    // set selector value and active btn
    const btns = document.querySelectorAll<HTMLButtonElement>('.lang-btn');
    btns.forEach(b => b.classList.toggle('active', b.dataset.lang === currentLang));
    drawCanvasAndPlan();
}

// --- Canvas drawing functions ---
function calculatePlans(): void {
    const bottomTime = parseInt(bottomTimeInput.value);
    const maxDepth = parseInt(maxDepthInput.value);
    const ascentRate = parseInt(ascentRateInput.value);
    const descentRate = parseInt(descentRateInput.value);
    const surfacePressure = parseFloat(surfacePressureInput.value);
    const stopInterval = parseInt(stopIntervalInput.value);
    const lastStopDepth = parseInt(lastStopDepthInput.value);
    const timeStep = parseFloat(timeStepInput.value);
    const addSafetyStop = addSafetyStopCheckbox.checked;
    const safetyStopDepth = addSafetyStop ? parseInt(safetyStopDepthInput.value) : 0;
    const safetyStopDuration = addSafetyStop ? parseInt(safetyStopDurationInput.value) : 0;

    calculatedPlans = [];
    for (let i = 0; i < cell_number; i++) { // GF Low (0 to 100)
        const gfLow = (i * GF_INCREMENT) / 100;
        let row: Array<Plan> = [];
        for (let j = 0; j < cell_number; j++) { // GF High (0 to 100)
            const gfHigh = (j * GF_INCREMENT) / 100;
            const diveParams: DiveParams = { bottomTime, maxDepth, gfLow, gfHigh, ascentRate, descentRate, surfacePressure, stopInterval, lastStopDepth, timeStep, addSafetyStop, safetyStopDepth, safetyStopDuration };
            const plan = calculatePlan(diveParams);
            plan.diveParams = diveParams;
            row.push(plan);
        }
        calculatedPlans.push(row);
    }
}

function calculatePlansAndDraw(): void {
    calculatePlans();
    drawCanvasAndPlan();
}

function drawCanvasAndPlan(): void {
    drawCanvas();
    const plan = calculatedPlans[selectedCell.i][selectedCell.j];
    analysePlan(plan);
}


function getColorForValue(value: number): Color {
    // Short/aggressive DTR (close to 0) -> Green
    // Long/conservative DTR (close to 1) -> Red
    const C1 = { r: 40, g: 167, b: 69 }; // Green
    const C2 = { r: 255, g: 193, b: 7 }; // Yellow
    const C3 = { r: 220, g: 53, b: 69 }; // Red

    let color: { r?: number; g?: number; b?: number; } = {};
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

function drawCanvas(): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Labels
    ctx.fillStyle = '#343a40';
    ctx.font = `bold ${Math.max(10, cell_number / 3)}px Inter`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // GF High Labels (X Axis)
    ctx.fillText(t('gfHigh'), canvas.width / 2, margin / 4);
    for (let j = 0; j < cell_number; j++) {
        const x = margin + j * cell_width + cell_width / 2;
        ctx.fillText((j * GF_INCREMENT).toString(), x, margin - margin / 4);
    }

    // GF Low Labels (Y Axis)
    ctx.save();
    ctx.translate(margin / 4, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(t('gfLow'), 0, 0);
    ctx.restore();
    for (let i = 0; i < cell_number; i++) {
        const y = margin + i * cell_width + cell_width / 2;
        ctx.fillText((i * GF_INCREMENT).toString(), margin - margin / 4, y);
    }

    // 2. Draw Grid
    let minDTR = Infinity;
    let maxDTR = 0;
    for (let i = 0; i < cell_number; i++) { // GF Low (0 to 100)
        for (let j = 0; j < cell_number; j++) { // GF High (0 to 100)
            const plan = calculatedPlans[i][j];
            // Color normalization (only for dives WITH stops)
            if (plan.dtr > 0 && plan.dtr !== Infinity && plan.stops.length > 0) {
                minDTR = Math.min(minDTR, plan.dtr);
                maxDTR = Math.max(maxDTR, plan.dtr);
            }
        }
    }
    // If only dives without stops, avoid division by zero
    if (minDTR === Infinity) minDTR = 0;
    if (maxDTR === 0) maxDTR = 1;
    const rangeDTR = maxDTR - minDTR;

    for (let i = 0; i < calculatedPlans.length; i++) {
        for (let j = 0; j < calculatedPlans[i].length; j++) {
            const { dtr, stops } = calculatedPlans[i][j];
            const x = margin + j * cell_width;
            const y = margin + i * cell_width;

            // Cell background
            if (dtr === Infinity) {
                ctx.fillStyle = '#adb5bd'; // N/A (GF Low > GF High) or Impossible -> Gray background
            } else if (stops.length === 0) {
                ctx.fillStyle = '#ffffff'; // White if "No Stop"
            } else {  // Normalization
                const norm = (rangeDTR > 0) ? (dtr - minDTR) / rangeDTR : 0;
                ctx.fillStyle = getColorForValue(Math.max(0, Math.min(1, norm)));
            }
            ctx.fillRect(x, y, cell_width, cell_width);

            // Border
            ctx.strokeStyle = '#dee2e6';
            ctx.strokeRect(x, y, cell_width, cell_width);

            // Highlight selected cell
            if (selectedCell.i === i && selectedCell.j === j) {
                ctx.strokeStyle = '#007bff';
                ctx.lineWidth = 5;
                ctx.strokeRect(x + 1.5, y + 1.5, cell_width - 3, cell_width - 3);
                ctx.lineWidth = 1; // Reset
            }

            // Cell text (DTR)
            ctx.fillStyle = '#212529';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (dtr === Infinity) {
                ctx.fillStyle = '#fff';
                ctx.font = `${Math.max(8, cell_width / 3.5)}px Inter`;
                ctx.fillText('X', x + cell_width / 2, y + cell_width / 2);
            } else if (stops.length === 0) {
                ctx.font = `${Math.max(7, cell_width / 4)}px Inter`; // Smaller font
                ctx.fillText('', x + cell_width / 2, y + cell_width / 2);
            } else {
                ctx.font = `bold ${Math.max(9, cell_width / 3)}px Inter`;
                ctx.fillText(Math.ceil(dtr).toString(), x + cell_width / 2, y + cell_width / 2);
            }
        }
    }

    // 3. Draw Tooltip (Info bubble)
    if (tooltip.active && tooltip.data) {
        drawTooltip(tooltip.x, tooltip.y, tooltip.data);
    }
}

function drawTooltip(mouseX: number, mouseY: number, plan: Plan): void {
    const { dtr, stops, t_descent, t_dive_total, diveParams } = plan;
    const { bottomTime, maxDepth, gfLow, gfHigh } = diveParams as DiveParams;

    // Tooltip dimensions
    const ttW = 200, ttH = 220;
    const ttPad = 10;
    const graphH = 100, legendH = 90;

    // Positioning (avoid going off screen)
    let ttX = mouseX + 15;
    let ttY = mouseY + 15;
    if (ttX + ttW > grid_width) { ttX = mouseX - ttW - 15; }
    if (ttY + ttH > canvas.height) { ttY = mouseY - ttH - 15; }

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // @ts-ignore `roundRect() available since TypeScript 4.9`
    ctx.roundRect(ttX, ttY, ttW, ttH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 1; // Reset

    // Title
    ctx.fillStyle = '#0056b3';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${formatGFstrings(gfLow, gfHigh)} | ${t('calculatedDTRLabel')} ${Math.ceil(dtr)} min`, ttX + ttPad, ttY + ttPad);

    // Handle "No Stop" or "N/A" cases
    if (dtr === Infinity) {
        ctx.fillStyle = '#333';
        ctx.font = '12px Inter';
        ctx.fillText(t('profileNotApplicable') + ` (>${MAX_STOP_TIME_BEFORE_INFTY} min)`, ttX + ttPad, ttY + 40);
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
    const maxTime = t_dive_total;
    // Y scale: 0m (top) to maxDepth (bottom)
    const scaleY = (depth: Depth) => (depth / maxDepth) * graphH;
    // X scale: 0 (left) to maxTime (right)
    const scaleX = (time: Minutes) => (time / maxTime) * graphW;

    ctx.strokeStyle = '#007bff'; // Profile color
    ctx.lineWidth = 2;
    ctx.beginPath();

    let currentTime = 0;
    const depth0 = 0;

    // 1. Start (0, 0)
    ctx.moveTo(graphX + scaleX(currentTime), graphY + scaleY(depth0));

    // 2. Descent
    currentTime = currentTime + t_descent;
    ctx.lineTo(graphX + scaleX(currentTime), graphY + scaleY(maxDepth));

    // 3. Bottom
    const t_at_bottom = bottomTime - t_descent;
    currentTime = currentTime + t_at_bottom;
    ctx.lineTo(graphX + scaleX(currentTime), graphY + scaleY(maxDepth));

    // 4. Stops (or direct ascent if no stops)
    let lastDepth = maxDepth;
    const ascentRate = parseInt(ascentRateInput.value);
    if (stops.length > 0) {
        stops.forEach(stop => {
            // Ascent to stop
            let t_climb = (lastDepth - stop.depth) / ascentRate;
            currentTime += t_climb;
            ctx.lineTo(graphX + scaleX(currentTime), graphY + scaleY(stop.depth));

            // Time at stop
            currentTime += stop.time;
            ctx.lineTo(graphX + scaleX(currentTime), graphY + scaleY(stop.depth));

            lastDepth = stop.depth;
        });
    }

    // 5. Final ascent
    let t_climb_final = lastDepth / ascentRate;
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
    function wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
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


function mouseInCanvas(e: MouseEvent): { mouseXcanvas: number; mouseYcanvas: number; } {
    const canvasRectangle = canvas.getBoundingClientRect();
    const scaleX = canvas.width / canvasRectangle.width;
    const scaleY = canvas.height / canvasRectangle.height;
    const mouseXcanvas = (e.clientX - canvasRectangle.left) * scaleX;
    const mouseYcanvas = (e.clientY - canvasRectangle.top) * scaleY;
    return { mouseXcanvas, mouseYcanvas };
}

function mouse2cell(mouseXcanvas: number, mouseYcanvas: number): SelectedCell | null {
    const mouseXgrid = mouseXcanvas - margin;
    const mouseYgrid = mouseYcanvas - margin;
    const isOutsideGrid = (
        mouseXgrid < 0 ||
        mouseYgrid < 0 ||
        mouseXgrid >= grid_width ||
        mouseYgrid >= grid_width);
    if (isOutsideGrid) {
        return null;
    }
    // mouseX changes the column, == the value of GFhigh
    const j = Math.floor(mouseXgrid / cell_width);
    const i = Math.floor(mouseYgrid / cell_width);
    return { i, j }; // row = GFlow, col = GFhigh
}


// --- Event listeners ---

// Debounce function
function debounce(func: Function, wait: number): Function {
    let timeout: number;
    return function (...args: Array<unknown>) {
        // @ts-ignore
        const context = this;
        clearTimeout(timeout);
        timeout = window.setTimeout(() => func.apply(context, args), wait);
    };
}
const debouncedCalculatePlansAndDraw = debounce(calculatePlansAndDraw, 250);

// --- Inputs listeners (depth and time) ---
[bottomTimeInput,
    maxDepthInput,
    ascentRateInput,
    descentRateInput,
    surfacePressureInput,
    stopIntervalInput,
    lastStopDepthInput,
    timeStepInput,
    safetyStopDepthInput,
    safetyStopDurationInput
].forEach(input => {
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            calculatePlansAndDraw();
        }
    });

    // Trigger calculation when input value changes via up/down buttons
    input.addEventListener('change', () => {
        calculatePlansAndDraw();
    });
    // Synchronize to sliders
    input.addEventListener('input', () => {
        if (input.id === 'bottomTime') { bottomTimeSlider.value = input.value; }
        if (input.id === 'maxDepth') { maxDepthSlider.value = input.value; }
    });
});

addSafetyStopCheckbox.addEventListener('change', () => {
    safetyStopInputsContainer.style.display = addSafetyStopCheckbox.checked ? 'flex' : 'none';
    calculatePlansAndDraw();
});

// Sliders
[bottomTimeSlider, maxDepthSlider].forEach(slider => {
    slider.addEventListener('input', () => {
        // Update numeric field
        if (slider.id === 'bottomTimeSlider') bottomTimeInput.value = slider.value;
        if (slider.id === 'maxDepthSlider') maxDepthInput.value = slider.value;
        // Run calculation (with debounce)
        debouncedCalculatePlansAndDraw();
    });
});

// --- Canvas listeners (Tooltip and Click) ---

// display tooltips on mouse over
canvas.addEventListener('mousemove', (e: MouseEvent) => {
    const { mouseXcanvas, mouseYcanvas } = mouseInCanvas(e);
    const cellOrNull = mouse2cell(mouseXcanvas, mouseYcanvas);

    if (cellOrNull) {
        tooltip.active = true;
        tooltip.x = mouseXcanvas;
        tooltip.y = mouseYcanvas;
        tooltip.data = calculatedPlans[cellOrNull.i][cellOrNull.j];
    } else {
        tooltip.active = false;
    }
    drawCanvas();
});

canvas.addEventListener('mouseout', () => {
    tooltip.active = false;
    drawCanvas();
});

// display details on click on a cell
canvas.addEventListener('click', (e) => {
    const { mouseXcanvas, mouseYcanvas } = mouseInCanvas(e);
    const cellOrNull = mouse2cell(mouseXcanvas, mouseYcanvas);
    if (cellOrNull) {
        selectedCell = { i: cellOrNull.i, j: cellOrNull.j };
        drawCanvas();
        const newPlan = calculatedPlans[cellOrNull.i][cellOrNull.j]
        analysePlan(newPlan);
    } else {
        // clicked outside grid, do nothing
    }
});

// update selected cell with arrow keys and plot details
window.addEventListener('keydown', (e) => {
    let { i, j } = selectedCell;
    let moved = false;

    switch (e.key) {
        case 'ArrowUp':
            if (i > 0) { i--; moved = true; }
            break;
        case 'ArrowDown':
            if (i < cell_number - 1) { i++; moved = true; }
            break;
        case 'ArrowLeft':
            if (j > 0) { j--; moved = true; }
            break;
        case 'ArrowRight':
            if (j < cell_number - 1) { j++; moved = true; }
            break;
        default:
            return;
    }

    if (moved) {
        // e.preventDefault();
        selectedCell = { i, j };
        const newPlan = calculatedPlans[i][j];
        tooltip.active = true;
        tooltip.data = newPlan;
        tooltip.x = margin + j * cell_width + cell_width / 2;
        tooltip.y = margin + i * cell_width + cell_width / 2;
        drawCanvas();
        analysePlan(newPlan);
    }
});

// Initial launch
document.addEventListener('DOMContentLoaded', () => {

    // Calculate plans for default values and default selected cell
    calculatePlansAndDraw();
    applyLanguageAndDraw();

    // Theme logic 
    const themeToggleBtn = document.getElementById('theme-toggle-btn') as HTMLButtonElement;
    const body = document.body;

    function setDarkTheme(isDarkMode: boolean) {
        if (isDarkMode) {
            body.classList.add('dark-mode');
            themeToggleBtn.textContent = '☀️';
            themeToggleBtn.title = 'Switch to light mode';
        } else {
            body.classList.remove('dark-mode');
            themeToggleBtn.textContent = '🌙';
            themeToggleBtn.title = 'Switch to dark mode';
        }

        const plan = calculatedPlans[selectedCell.i][selectedCell.j];
        analysePlan(plan); // replot plotly to get it to match theme

    }

    // Load theme preference from localStorage
    function setThemePreference(): void {
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
    setThemePreference();
});
