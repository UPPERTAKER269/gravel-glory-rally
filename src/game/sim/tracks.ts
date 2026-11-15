// Track definitions are data. Control points are [x, z, height] in meters; the
// spline through them is closed and the race starts at the first point heading
// toward the second.
export type Environment = "forest" | "canyon" | "snow";

export interface TrackDef {
  id: string;
  name: string;
  location: string;
  tagline: string;
  environment: Environment;
  points: [number, number, number][];
  scale: number;
  width: number;
  /** Lateral grip multiplier on the road surface. */
  grip: number;
  /** Grip multiplier off the road. */
  offGrip: number;
  /** Extra drag off the road (1/s). */
  offDrag: number;
  defaultLaps: number;
  rewardMult: number;
  price: number;
  difficulty: 1 | 2 | 3;
  seed: number;
}

export const TRACKS: TrackDef[] = [
  {
    id: "pinewood",
    name: "Pinewood Run",
    location: "Northern Forest",
    tagline: "Fast flowing gravel through dense pines.",
    environment: "forest",
    points: [
      [0, 0, 0], [0, 120, 2], [30, 220, 4], [110, 270, 6], [200, 250, 5],
      [250, 180, 3], [230, 100, 2], [280, 30, 4], [300, -60, 6], [240, -140, 5],
      [150, -150, 3], [90, -100, 1], [30, -90, 0], [0, -45, 0],
    ],
    scale: 1.3,
    width: 11,
    grip: 0.85,
    offGrip: 0.55,
    offDrag: 0.55,
    defaultLaps: 2,
    rewardMult: 1,
    price: 0,
    difficulty: 1,
    seed: 11,
  },
  {
    id: "canyon",
    name: "Red Rock Canyon",
    location: "Desert Highlands",
    tagline: "Tight hairpins and steep climbs between canyon walls.",
    environment: "canyon",
    points: [
      [0, 0, 0], [0, 100, 3], [-20, 180, 8], [-90, 215, 12], [-155, 175, 14],
      [-130, 110, 15], [-185, 50, 13], [-255, 30, 10], [-285, -50, 6], [-225, -115, 4],
      [-145, -95, 5], [-100, -150, 3], [-30, -165, 1], [20, -105, 0], [10, -45, 0],
    ],
    scale: 1.25,
    width: 10,
    grip: 0.9,
    offGrip: 0.6,
    offDrag: 0.7,
    defaultLaps: 2,
    rewardMult: 1.35,
    price: 1200,
    difficulty: 2,
    seed: 23,
  },
  {
    id: "frostpeak",
    name: "Frostpeak Pass",
    location: "Alpine Range",
    tagline: "Icy sweepers where every throttle input counts.",
    environment: "snow",
    points: [
      [0, 0, 0], [10, 110, 4], [60, 190, 9], [150, 215, 14], [225, 160, 16],
      [205, 80, 13], [135, 60, 10], [110, -10, 8], [170, -75, 6], [150, -155, 4],
      [60, -175, 2], [-10, -115, 1], [-10, -50, 0],
    ],
    scale: 1.35,
    width: 12,
    grip: 0.62,
    offGrip: 0.45,
    offDrag: 0.6,
    defaultLaps: 2,
    rewardMult: 1.7,
    price: 2500,
    difficulty: 3,
    seed: 37,
  },
];

export const trackById = (id: string) => TRACKS.find((t) => t.id === id) ?? TRACKS[0];
