import { expect, test } from "vitest";
import { pickNext } from "./gamepadNav";

const grid = [
  { x: 0, y: 0, w: 100, h: 40 },   // 0 top-left
  { x: 120, y: 0, w: 100, h: 40 }, // 1 top-right
  { x: 0, y: 60, w: 100, h: 40 },  // 2 bottom-left
  { x: 120, y: 60, w: 100, h: 40 },// 3 bottom-right
];

test("D-pad down from a menu item goes to the item below", () => {
  expect(pickNext(grid[0], [grid[1], grid[2], grid[3]], "down")).toBe(1); // index into [1,2,3] -> grid[2]
});

test("D-pad right goes to the item beside, not diagonal", () => {
  expect(pickNext(grid[2], [grid[0], grid[1], grid[3]], "right")).toBe(2); // grid[3]
});

test("nothing further in that direction stays put", () => {
  expect(pickNext(grid[0], [grid[1], grid[2], grid[3]], "up")).toBe(-1);
});
