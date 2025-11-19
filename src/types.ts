// gf.ts
export type Depth = number;
export type Tension = number;
export type Pressure = number;
export type PartPressure = Pressure;
export type PN2 = PartPressure;
export type Time = number;
export type HalfTime = Time;
export type Coefficient = number;
export type CoefficientA = Coefficient;
export type CoefficientB = Coefficient;
export interface CoefficientPair { t12: HalfTime; A: CoefficientA; B: CoefficientB; }
export type MValue = number;
export type GradientFactor = number;
export type GradientFactorLo = GradientFactor;
export type GradientFactorHi = GradientFactor;
export type CompartmentIdx = number;
export interface Safe { isSafe: boolean, satComp: CompartmentIdx } // index of the first compartment that is not safe


export interface Stop { time: Time, depth: Depth, saturatedCompartments: Array<CompartmentIdx>, }
export interface Entry { time: Time, depth: Depth, tensions: Array<Tension>, }
export interface DiveParams { bottomTime: Time, maxDepth: Depth, gfLow: GradientFactorLo, gfHigh: GradientFactorHi, }
export interface Plan {
    dtr: Time;
    stops: Array<Stop>;
    t_descent: Time;
    t_dive_total: Time;
    t_stops: Time;
    history: Array<Entry>;
    diveParams?: DiveParams;
}

// plan_analysis.ts
export type Color = string;
export interface Trace {
    x: Array<number>;
    y: Array<number>;
    mode: 'lines' | 'lines+markers' | 'tozero';
    name?: string;
    line: { color: Color; width: number; dash?: 'dash' | 'dot'; };
    yaxis: 'y1' | 'y2';
    xaxis: 'x1' | 'x2';
    legendgroup: string;
    customdata?: Array<number | Array<number>>;
    hovertemplate?: string;
    showlegend?: boolean;
    hoverinfo?: 'none' | 'name';
    visible?: 'legendonly';
}

export interface Grid { rows: number; columns: number; pattern: 'independent'; roworder: 'top to bottom'; ygap: number; }
export interface Axis { title: string; autorange?: true | 'reversed'; rangemode: 'tozero'; gridcolor: Color; range?: [number, number]; }
export interface Legend { xanchor: 'left'; yanchor: 'top'; x: number; y: number; }
export interface Font { color: Color; size?: number; }
export interface Annotation { text: string; xref: 'x2'; yref: 'y2'; x: number; y: number; showarrow: boolean; xanchor: 'right' | 'left'; font: Font; }
export interface Layout {
    title: string;
    grid: Grid;
    xaxis: Axis;
    yaxis: Axis;
    xaxis2: Axis;
    yaxis2: Axis;
    legend: Legend;
    annotations: Array<Annotation>;
    paper_bgcolor: Color;
    plot_bgcolor: Color;
    font: Font;
    showlegend?: boolean;
}

export interface PlotlyIcon { width: number; height: number; path: string; }
export interface ModeBarButton { name: string; title: string; icon: PlotlyIcon; click: Function; }
export interface PlotConfig {
    scrollZoom: boolean;
    displayModeBar: boolean;
    modeBarButtonsToRemove: Array<string>;
    modeBarButtonsToAdd: Array<ModeBarButton>;
    displaylogo: boolean;
    responsive: boolean;
}
export type PlotDivElement = HTMLDivElement & { on: Function; };
declare global {
    const Plotly: {
        newPlot: (plot: string, traces: Array<Trace>, layout: Layout, config: PlotConfig) => void;
        relayout: (plotDiv: PlotDivElement, update: Record<string, boolean>) => void;
        Icons: Record<string, PlotlyIcon>;
    };
}

export interface EventData { curveNumber: number; data: Record<number, { legendgroup: 'compartment0'; }>; fullData: Record<number, { visible?: boolean; }>; }

// script.ts
export type SelectedCell = { i: number; j: number; data?: Plan; } | null;
export interface Tooltip { active: boolean; x: number; y: number; data?: Plan | null; }

// translations.ts
