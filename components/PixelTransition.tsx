"use client";

const COLS = 12;
const ROWS = 8;

/** Full-screen retro pixel block-dissolve overlay. Pure CSS, unmounts when done. */
export default function PixelTransition() {
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // Stagger from the center outward for a digital iris feel
      const dist = Math.abs(r - (ROWS - 1) / 2) + Math.abs(c - (COLS - 1) / 2);
      cells.push(
        <span
          key={`${r}-${c}`}
          className="pixel-cell bg-cyber-cyan shadow-[0_0_18px_rgba(0,240,255,0.7)]"
          style={{ animationDelay: `${dist * 30}ms` }}
        />
      );
    }
  }
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 grid" aria-hidden="true"
      style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
      {cells}
    </div>
  );
}
