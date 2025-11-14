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
