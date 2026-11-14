// Where things sit on the Stage 1 ground patch. Units are metres.
export const ISLAND_RADIUS = 9;

export const HOUSE_POS = { x: -1.2, z: -3.0 } as const;
/** Door centre, in the house's own coordinates. */
export const DOOR_LOCAL_X = -0.95;
export const HOUSE_HALF_DEPTH = 1.8;

export const TREE_POS = { x: 4.4, z: -2.1 } as const;

/** The walking path is an ellipse in front of the house. */
export const PATH = { cx: 0.3, cz: 3.0, rx: 5.6, rz: 2.7, width: 1.0 } as const;

export function pathPoint(theta: number): { x: number; z: number } {
  return { x: PATH.cx + PATH.rx * Math.cos(theta), z: PATH.cz + PATH.rz * Math.sin(theta) };
}

/** Direction of travel along the path (not normalised). */
export function pathTangent(theta: number): { x: number; z: number } {
  return { x: -PATH.rx * Math.sin(theta), z: PATH.rz * Math.cos(theta) };
}

/** True where small decorations must not be placed. */
export function isOccupied(x: number, z: number): boolean {
  if (Math.hypot(x, z) > ISLAND_RADIUS - 0.9) return true;
  const e = Math.sqrt(((x - PATH.cx) / PATH.rx) ** 2 + ((z - PATH.cz) / PATH.rz) ** 2);
  if (Math.abs(e - 1) < 0.24) return true;
  if (x > HOUSE_POS.x - 2.8 && x < HOUSE_POS.x + 2.8 && z > HOUSE_POS.z - 2.5 && z < HOUSE_POS.z + 3.0) return true;
  const doorX = HOUSE_POS.x + DOOR_LOCAL_X;
  if (Math.abs(x - doorX) < 0.9 && z > HOUSE_POS.z && z < PATH.cz) return true;
  if (Math.hypot(x - TREE_POS.x, z - TREE_POS.z) < 1.3) return true;
  return false;
}
