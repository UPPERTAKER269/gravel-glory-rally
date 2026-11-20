// Car roster. `model` keys map to GLB files in the scene layer.
export interface CarSpec {
  id: string;
  name: string;
  model: "vento" | "strada" | "ridge" | "falco" | "apex";
  /** Factory paint colour (hex). */
  paint: string;
  className: string;
  description: string;
  /** Top speed (m/s). */
  topSpeed: number;
  /** Peak acceleration (m/s^2). */
  accel: number;
  /** Braking deceleration (m/s^2). */
  brake: number;
  /** Lateral grip multiplier. */
  grip: number;
  /** Steering response multiplier. */
  turn: number;
  /** Relative mass for car-to-car contact. */
  mass: number;
  price: number;
}

export const CARS: CarSpec[] = [
  {
    id: "hatch", name: "Vento R2", model: "vento", paint: "#c8322a", className: "R2",
    description: "Light, nimble and forgiving. The perfect first rally car.",
    topSpeed: 40, accel: 9, brake: 20, grip: 1.0, turn: 1.05, mass: 1.0, price: 0,
  },
  {
    id: "sedan", name: "Strada GT", model: "strada", paint: "#1f4fa8", className: "GT",
    description: "Stable at speed with a rear wing that keeps it planted.",
    topSpeed: 44, accel: 9.8, brake: 21, grip: 1.05, turn: 1.0, mass: 1.1, price: 1500,
  },
  {
    id: "suv", name: "Ridge 4x4", model: "ridge", paint: "#e9e6dc", className: "T1",
    description: "Heavy all-terrain grip. Shrugs off snow and rough verges.",
    topSpeed: 41, accel: 9.4, brake: 20, grip: 1.22, turn: 0.95, mass: 1.45, price: 2500,
  },
  {
    id: "proto", name: "Falco Proto", model: "falco", paint: "#f0a91c", className: "R5",
    description: "A purpose-built rally weapon with brutal acceleration.",
    topSpeed: 49, accel: 11.5, brake: 23, grip: 1.12, turn: 1.08, mass: 1.05, price: 5000,
  },
  {
    id: "apex", name: "Apex X", model: "apex", paint: "#23272c", className: "Rally1",
    description: "Hybrid hypercar for rally. Fastest car in the paddock.",
    topSpeed: 54, accel: 12.8, brake: 25, grip: 1.18, turn: 1.1, mass: 1.0, price: 9000,
  },
];

export const carById = (id: string) => CARS.find((c) => c.id === id) ?? CARS[0];

/** 0-100 for garage stat bars. */
export function carStats(c: CarSpec) {
  const n = (v: number, lo: number, hi: number) => Math.round(((v - lo) / (hi - lo)) * 80 + 20);
  return {
    speed: n(c.topSpeed, 38, 55),
    accel: n(c.accel, 8.5, 13),
    handling: n(c.grip * c.turn, 0.95, 1.32),
    weight: n(c.mass, 0.9, 1.5),
  };
}
