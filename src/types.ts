// gf.ts
type Depth = number;
type Tension = number;
type Pressure = number;
type PartPressure = Pressure;
type PN2 = PartPressure;
type Time = number;
type HalfTime = Time;
type Coefficient = number;
type CoefficientA = Coefficient;
type CoefficientB = Coefficient;
interface CoefficientPair { t12: HalfTime; A: CoefficientA; B: CoefficientB; }
type MValue = number;
type GradientFactor = number;
type GradientFactorLo = GradientFactor;
type GradientFactorHi = GradientFactor;
type CompartmentIdx = number;
interface Safe { isSafe: boolean, satComp: CompartmentIdx } // index of the first compartment that is not safe


interface Stop { time: Time, depth: Depth, saturatedCompartments: Array<CompartmentIdx>, }
interface Entry { time: Time, depth: Depth, tensions: Array<Tension>, }
interface DiveParams { bottomTime: Time, maxDepth: Depth, gfLow: GradientFactorLo, gfHigh: GradientFactorHi, }
interface Plan {
    dtr: Time;
    stops: Array<Stop>;
    t_descent: Time;
    t_dive_total: Time;
    t_stops: Time;
    history: Array<Entry>;
    diveParams?: DiveParams;
}

// plan_analysis.ts
type Color = string;
interface Trace {
    x: Array<number>;
    y: Array<number>;
    mode: 'lines' | 'lines+markers' | 'tozero';
    name?: string;
    line: { color: Color; width: number; dash?: 'dash' | 'dot'; };
    yaxis: 'y1' | 'y2';
    xaxis: 'x1' | 'x2';
    legendgroup: string;
    customdata?: Array<number|Array<number>>;
    hovertemplate?: string;
    showlegend?: boolean;
    hoverinfo?: 'none' | 'name';
    visible?: 'legendonly';
}

interface Grid { rows: number; columns: number; pattern: 'independent'; roworder: 'top to bottom'; ygap: number; }
interface Axis { title: string; autorange?: true | 'reversed' ; rangemode: 'tozero'; gridcolor: Color; range?: [number, number]; }
interface Legend { xanchor: 'left'; yanchor: 'top'; x: number; y: number; }
interface Font { color: Color; size?: number; }
interface Annotation { text: string; xref: 'x2'; yref: 'y2'; x: number; y: number; showarrow: boolean; xanchor: 'right' | 'left'; font: Font; }
interface Layout {
    title: string;
    grid: Grid;
    xaxis: Axis;
    yaxis:Axis;
    xaxis2: Axis;
    yaxis2: Axis;
    legend: Legend;
    annotations: Array<Annotation>;
    paper_bgcolor: Color;
    plot_bgcolor: Color;
    font: Font;
    showlegend?: boolean;
}

interface PlotlyIcon { width: number; height: number; path: string; }
interface ModeBarButton { name: string; title: string; icon: PlotlyIcon; click: Function; }
interface PlotConfig {
    scrollZoom: boolean;
    displayModeBar: boolean;
    modeBarButtonsToRemove: Array<string>;
    modeBarButtonsToAdd: Array<ModeBarButton>;
    displaylogo: boolean;
    responsive: boolean;
}
type PlotDivElement = HTMLDivElement & { on: Function; };
declare const Plotly: {
    newPlot: (plot: string, traces: Array<Trace>, layout: Layout, config: PlotConfig) => void;
    relayout: (plotDiv:PlotDivElement, update: Record<string, boolean>) => void;
    Icons: Record<string, PlotlyIcon>;
};
interface EventData { curveNumber: number; data: Record<number, { legendgroup: 'compartment0'; }>; fullData: Record<number, { visible?: boolean; }>; }

// script.ts
type SelectedCell = { i: number; j: number; data?: Plan; } | null;
interface Tooltip { active: boolean; x: number; y: number; data?: Plan | null; }

// translations.ts
type Lang = keyof typeof TRANSLATIONS;
interface Window { CURRENT_LANG: Lang; }
