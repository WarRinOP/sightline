import type { Metadata } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Condensed,
  Instrument_Serif,
} from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// MASTER_PLAN §2.1: next/font downloads the Latin subsets at build time and serves them from our own
// origin, so a page never asks Google for a font. Only the weights the UI uses are loaded. Each font
// sets a CSS variable that globals.css puts first in its stack, so the system stack is the fallback.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-sans",
});
const plexCondensed = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
  variable: "--font-plex-condensed",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "SIGHTLINE",
  description:
    "When does a spot near the Moon's south pole get sunlight, and when can it talk to Earth? Prototype: simulated data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fonts = [plexSans, plexCondensed, plexMono, instrumentSerif]
    .map((f) => f.variable)
    .join(" ");
  return (
    <html lang="en" className={fonts}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
