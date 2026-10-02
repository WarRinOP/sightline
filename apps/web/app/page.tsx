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
          Light and link verdicts need the terrain horizon, which is not built yet, so they are not
          shown.
        </p>
        <p className="text-text-2">
          The {sites.length} preset sites are the centres of NASA PGDA site-DEM tiles, named after
          the PGDA product. They are not landing points or rim positions.
        </p>
      </header>

      <LiveReadout sites={sites} />
    </main>
  );
}
