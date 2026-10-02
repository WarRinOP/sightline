import { BUNDLED_SITES } from "@sightline/engine";
import { LiveReadout } from "./live-readout";

export default function HomePage() {
  const sites = BUNDLED_SITES.map((s) => ({ ...s }));

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <h1 className="font-condensed text-4xl font-semibold tracking-wide">SIGHTLINE</h1>
        <p className="text-text-2">
          Where the Sun and Earth are in the sky of a spot near the Moon&apos;s south pole. The
          directions below come from NASA NAIF SPICE ephemerides and are computed in your browser.
          Light and link are judged against the terrain horizon built from NASA LOLA elevation data;
          that part is real but not yet checked against published maps.
        </p>
        <p className="text-text-2">
          The {sites.length} preset sites are positions in NASA PGDA site-DEM tiles: Shackleton Rim
          is the crest of the rim ridge in its tile, the other two are tile centres. They are named
          after the PGDA products. None of them is a landing point.
        </p>
      </header>

      <LiveReadout sites={sites} />
    </main>
  );
}
