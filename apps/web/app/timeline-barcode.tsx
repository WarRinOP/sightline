"use client";

import { useEffect, useRef, useState } from "react";
import type { StepState } from "@sightline/contracts";
import { etToUtcIso, utcIsoToEt } from "@sightline/engine";
import { barcodeColumns, epochAtRatio } from "../lib/barcode";

const ROW_PX = 20;
const GAP_PX = 4;
const ROWS = [
  { key: "sun", label: "Sunlight", token: "--sun" },
  { key: "link", label: "Link to Earth", token: "--earth" },
  { key: "both", label: "Both at once", token: "--both" },
] as const;

interface BarcodeProps {
  steps: readonly StepState[] | undefined;
  start_et: number;
  end_et: number;
  step_s: number;
  epoch_et: number | null;
  onSeek: (epoch_et: number) => void;
}

/**
 * The mission barcode: one row each for sunlight, the link and both, across the whole ephemeris.
 * A filled stripe is the share of the hours under that pixel; an empty one is dark (or no link).
 * Rows are labelled, so no meaning rests on colour. The range input is the keyboard control.
 */
export function TimelineBarcode({
  steps,
  start_et,
  end_et,
  step_s,
  epoch_et,
  onSeek,
}: BarcodeProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = canvas.current?.parentElement;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const height = ROWS.length * ROW_PX + (ROWS.length - 1) * GAP_PX;
    c.width = Math.floor(width * dpr);
    c.height = Math.floor(height * dpr);
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const css = getComputedStyle(document.documentElement);
    const colour = (token: string) => css.getPropertyValue(token).trim();
    const cols = steps ? barcodeColumns(steps, width) : null;
    ROWS.forEach((row, r) => {
      const y = r * (ROW_PX + GAP_PX);
      ctx.globalAlpha = 1;
      ctx.fillStyle = colour("--dark-deep"); // dark: nothing to see
      ctx.fillRect(0, y, width, ROW_PX);
      if (!cols) return;
      ctx.fillStyle = colour(row.token);
      const share = cols[row.key];
      for (let x = 0; x < width; x++) {
        const f = share[x] ?? 0;
        if (f <= 0) continue;
        ctx.globalAlpha = 0.25 + 0.75 * f;
        ctx.fillRect(x, y, 1, ROW_PX);
      }
    });
    ctx.globalAlpha = 1;
  }, [steps, width]);

  const ratio = epoch_et === null ? null : (epoch_et - start_et) / (end_et - start_et);
  const seekFromPointer = (clientX: number) => {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    onSeek(epochAtRatio(start_et, end_et, step_s, (clientX - rect.left) / rect.width));
  };
  const year = etToUtcIso(start_et).slice(0, 4);
  const months = Array.from({ length: 12 }, (_, m) => {
    const et = utcIsoToEt(`${year}-${String(m + 1).padStart(2, "0")}-01T00:00:00`);
    return { m, ratio: (et - start_et) / (end_et - start_et) };
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <ul
          className="flex flex-col font-condensed text-[0.65rem] font-semibold uppercase leading-5 tracking-widest text-text-2"
          style={{ gap: GAP_PX, paddingTop: 0 }}
        >
          {ROWS.map((r) => (
            <li key={r.key} style={{ height: ROW_PX, lineHeight: `${ROW_PX}px` }}>
              {r.label}
            </li>
          ))}
        </ul>
        <div className="relative min-w-0 flex-1">
          <canvas
            ref={canvas}
            aria-hidden="true"
            className="block cursor-crosshair"
            onPointerDown={(e) => seekFromPointer(e.clientX)}
            onPointerMove={(e) => e.buttons === 1 && seekFromPointer(e.clientX)}
          />
          {ratio !== null && ratio >= 0 && ratio <= 1 ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 h-full w-px bg-text-1"
              style={{ left: `${ratio * 100}%` }}
            />
          ) : null}
          <div className="relative mt-1 h-4 font-mono text-[0.6rem] text-text-3" aria-hidden="true">
            {months
              .filter((m) => m.ratio > -0.01 && m.ratio < 1)
              .map((m) => (
                <span
                  key={m.m}
                  className="absolute"
                  style={{ left: `${Math.max(0, m.ratio) * 100}%` }}
                >
                  {new Date(Date.UTC(2000, m.m, 1)).toLocaleString("en", {
                    month: "short",
                    timeZone: "UTC",
                  })}
                </span>
              ))}
          </div>
        </div>
      </div>
      <input
        type="range"
        aria-label="Time"
        className="w-full"
        min={start_et}
        max={end_et}
        step={step_s}
        value={epoch_et ?? start_et}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
    </div>
  );
}
