// gf.ts
export type Depth = number; // in meters
export type Volume = number; // in liters
export type Pressure = number; // in bars
export type PartPressure = Pressure;
export type PN2 = PartPressure; // in bars
export type Tension = number; // in bars
export type Minutes = number;
export type HalfLife = Minutes;
export type Speed = number; // in meters per minute
export type CoefA = Tension; // in bars, positive
export type CoefB = number; // Pressure/Tension = dimensionless but positive
export interface CompartmentCoefs { t12: HalfLife; A: CoefA; B: CoefB; };
export type GF = number;
export type GFLow = GF; // low = deep = max depth
export type GFHigh = GF; // high = shallow =surface
export type CompIdx = number;
export interface Simulation { isSafe: boolean, satsCompIdx: Array<CompIdx>; }
export type Tensions = Array<Tension>;

export interface Stop { time: Minutes, depth: Depth, saturatedCompartments: Array<CompIdx>, }
export interface State {
    time: Minutes,
    depth: Depth,
    tensions: Tensions,
    tankPressure: Pressure,
    pressure: Pressure,
    mValues: Tensions,
    modMValues: Tensions,
    // ceiling: Depth,
    // gfCeiling: Depth,
    // pn2Ambiant: PN2,
}
export type StateHistory = Array<State>;
export interface DiveParams {
    bottomTime: Minutes,
    maxDepth: Depth
    gfLow: GFLow
    gfHigh: GFHigh
    ascentRate: Speed
    descentRate: Speed;
    surfacePressure: Pressure;
    stopInterval: Depth;
    lastStopDepth: Depth;
    timeStep: Minutes;
}
export interface Plan {
    dtr: Minutes;
    stops: Array<Stop>;
    t_descent: Minutes;
    t_dive_total: Minutes;
    t_stops: Minutes;
    history: StateHistory;
    diveParams?: DiveParams;
}
export type PlansGrid = Array<Array<Plan>>;

// plan_analysis.ts
export type Color = string;
export interface Trace {
    x: Array<number | string>;
    y: Array<number | string>;
    z?: Array<Array<number>>;
    type?: 'scatter' | 'heatmap';
    mode?: 'lines' | 'lines+markers' | 'tozero';
    name?: string;
    line?: { color: Color; width?: number; dash?: 'dash' | 'dot'; };
    yaxis: string;
    xaxis: string;
    legendgroup?: string;
    customdata?: Array<number | Array<number>>;
    hovertemplate?: string;
    showlegend?: boolean;
    hoverinfo?: 'none' | 'name';
    visible?: boolean | 'legendonly';
    fill?: 'none' | 'tozeroy' | 'toself';
    fillcolor?: string;
    colorscale?: string;
    reversescale?: boolean;
    zmid?: number;
    colorbar?: { title: string };
    zsmooth?: 'fast' | 'best' | false;
    connectgaps?: boolean;
    showscale?: boolean;
    opacity?: number;
}

export interface Grid { rows: number; columns: number; pattern: 'independent'; roworder: 'top to bottom'; ygap: number; }
export interface Axis {
    title?: object;
    autorange?: true | 'reversed';
    rangemode?: 'tozero';
    gridcolor?: Color;
    range?: [number, number];
    type?: 'category' | 'linear' | 'log' | 'date';
    tickvals?: Array<number>;
    ticktext?: Array<string>;
    matches?: string;
    domain?: [number, number];
    visible?: boolean;
    showgrid?: boolean;
    anchor?: string;
    overlaying?: string;
    side?: 'left' | 'right' | 'top' | 'bottom';
    position?: number;
}
export interface Legend { xanchor: 'left'; yanchor: 'top'; x: number; y: number; showlegend?: boolean; }
export interface Font { color: Color; size?: number; }
export interface Annotation { text: string; xref: string; yref: string; x: number; y: number; showarrow: boolean; xanchor: 'right' | 'left'; font: Font; }
export interface Margin { l: number; r: number; b: number; t: number; pad: number; }
export interface Layout {
    title?: object;
    grid?: Grid;
    xaxis?: Axis;
    yaxis?: Axis;
    xaxis2?: Axis;
    yaxis2?: Axis;
    xaxis3?: Axis;
    yaxis3?: Axis;
    yaxis12?: Axis;
    legend?: Legend;
    annotations?: Array<Annotation>;
    paper_bgcolor?: Color;
    plot_bgcolor?: Color;
    font?: Font;
    showlegend?: boolean;
    margin?: Margin;
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
        newPlot: (plot: string, traces?: Array<Trace>, layout?: Layout, config?: PlotConfig) => void;
        relayout: (plotDiv: PlotDivElement, update: Record<string, boolean>) => void;
        Icons: Record<string, PlotlyIcon>;
    };
}

export interface EventData { curveNumber: number; data: Trace[]; fullData: Trace[]; }

// script.ts
export type SelectedCell = { i: number; j: number; };
export interface Tooltip { active: boolean; x: number; y: number; data?: Plan | null; }

// translations.ts
type LangTranslation = { [key: string]: string; }
export type Lang = 'fr' | 'en';
export type Translations = { [key in Lang]: LangTranslation; }
