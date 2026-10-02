import { createMockEngineClient } from "@sightline/engine";
import { LiveReadout } from "./live-readout";

export default async function HomePage() {
  const engine = createMockEngineClient();
  const sites = await engine.listSites();

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <p
          role="status"
          className="inline-block rounded-md bg-sim px-3 py-1 font-condensed text-sm font-semibold uppercase tracking-widest text-void"
        >
          Simulated
        </p>
        <h1 className="font-condensed text-4xl font-semibold tracking-wide">SIGHTLINE</h1>
        <p className="text-text-2">
          Hello Moon. This page runs on the synthetic mock engine: the terrain, the Sun and the
          Earth below are not measurements. Real NASA data (LOLA, SPICE) replaces them as the
          pipeline lands. The {sites.length} preset sites are named after real features, but their
          coordinates are nominal placeholders, not surveyed positions.
        </p>
      </header>

      <LiveReadout sites={sites} />
    </main>
  );
}
