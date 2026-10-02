import type { Metadata } from "next";
import Link from "next/link";
import { barkerRows, directionRows, sciText } from "../../lib/evidence";
import { BUNDLED_SITES } from "@sightline/engine";
import { HORIZONS_RESIDUALS, ILLUMINATION_BENCHMARK } from "../../lib/evidence-data";

const siteName = (id: string) => BUNDLED_SITES.find((s) => s.id === id)?.name ?? id;

export const metadata: Metadata = {
  title: "Evidence · SIGHTLINE",
  description: "How the Sun and Earth directions and the terrain illumination method were checked.",
};

const pct = (v: number) => `${v.toFixed(1)} %`;
const th =
  "px-3 py-2 text-left font-condensed text-xs font-semibold uppercase tracking-widest text-text-2";
const td = "px-3 py-2 font-mono text-sm tabular-nums";

export default function EvidencePage() {
  const residuals = HORIZONS_RESIDUALS;
  const dir = directionRows(residuals);
  const barker = barkerRows(ILLUMINATION_BENCHMARK);
  const crit = ILLUMINATION_BENCHMARK.barker_table2.criteria;
  const avg = ILLUMINATION_BENCHMARK.avgvisib;
  const siteIds = Object.keys(residuals.by_site);

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <Link
          href="/"
          className="font-condensed text-xs font-semibold uppercase tracking-widest text-earth"
        >
          ← Lab
        </Link>
        <h1 className="font-condensed text-4xl font-semibold tracking-wide">Evidence</h1>
        <p className="text-text-2">
          What was checked, against what, and what the checks do not show. Every figure on this page
          is read from a file written by a command in the repository (<code>fixtures/golden/</code>
          ), not typed by hand.
        </p>
      </header>

      <section aria-labelledby="dir-title" className="space-y-4">
        <h2 id="dir-title" className="font-condensed text-2xl font-semibold tracking-wide">
          1. Sun and Earth directions against JPL Horizons
        </h2>
        <p className="text-text-2">
          The engine&apos;s Sun and Earth directions at the three sites (
          {residuals.reference.epoch_count} epochs each, {residuals.cases.length} comparisons)
          against NASA JPL&apos;s Horizons service. The acceptance limit, {residuals.tolerance_deg}
          °, was written down before the first gap was computed. Result:{" "}
          {residuals.passes
            ? "every comparison is inside the limit."
            : "NOT every comparison is inside the limit."}
        </p>
        <div className="overflow-x-auto rounded-lg border border-hairline">
          <table className="w-full min-w-[34rem] border-collapse">
            <caption className="sr-only">
              Largest, mean and rms angular gap to Horizons, by body
            </caption>
            <thead>
              <tr className="border-b border-hairline">
                <th scope="col" className={th}>
                  Body
                </th>
                <th scope="col" className={th}>
                  Largest gap
                </th>
                <th scope="col" className={th}>
                  Mean
                </th>
                <th scope="col" className={th}>
                  RMS
                </th>
                <th scope="col" className={th}>
                  Inside the limit by
                </th>
              </tr>
            </thead>
            <tbody>
              {dir.map((r) => (
                <tr key={r.body} className="border-b border-hairline last:border-0">
                  <th scope="row" className={`${td} text-left font-sans`}>
                    {r.body}
                  </th>
                  <td className={td}>
                    {sciText(r.max_deg)}° <span className="text-text-3">({r.max_text})</span>
                  </td>
                  <td className={td}>{sciText(r.mean_deg)}°</td>
                  <td className={td}>{sciText(r.rms_deg)}°</td>
                  <td className={td}>{Math.round(r.margin).toLocaleString("en")}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-text-2">
          The Earth&apos;s gap is larger than the Sun&apos;s. It comes from the engine&apos;s
          approximation of stellar aberration for the Earth (METHODS section 3): Horizons and the
          SPICE route the pipeline uses agree with each other to{" "}
          {sciText(residuals.horizons_vs_spice_separation_deg.earth?.max ?? NaN)}° for the Earth, so
          it is not a disagreement between those two. By site, the largest gaps are:{" "}
          {siteIds
            .map((id) => {
              const s = residuals.by_site[id];
              return s
                ? `${siteName(id)}: Sun ${sciText(s.sun.separation_deg.max_abs)}°, Earth ${sciText(s.earth.separation_deg.max_abs)}°`
                : id;
            })
            .join("; ")}
          .
        </p>
        <details className="text-sm text-text-2">
          <summary className="cursor-pointer text-text-1">How the comparison was made</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {residuals.reference.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      </section>

      <section aria-labelledby="barker-title" className="space-y-4">
        <h2 id="barker-title" className="font-condensed text-2xl font-semibold tracking-wide">
          2. Terrain illumination method against Barker et al. (2021)
        </h2>
        <p className="text-text-2">
          The method that turns terrain and Sun positions into an average illumination was run at
          the seven regions of interest in Table 2 of Barker et al. (2021), for{" "}
          {ILLUMINATION_BENCHMARK.barker_table2.start_utc.slice(0, 4)} to{" "}
          {ILLUMINATION_BENCHMARK.barker_table2.end_utc.slice(0, 4)}, at 1 m and 5 m above the
          ground. The pass criteria were fixed before the run (DECISIONS D-025). Their values are
          the 1st percentile over 100 DEM error clones (A) and the best pixel in the region (C), so
          ours is expected to be at least A and below C.
        </p>
        <div className="overflow-x-auto rounded-lg border border-hairline">
          <table className="w-full min-w-[40rem] border-collapse">
            <caption className="sr-only">
              Average illumination, ours and the paper&apos;s, by region and height
            </caption>
            <thead>
              <tr className="border-b border-hairline">
                <th scope="col" className={th}>
                  Region
                </th>
                <th scope="col" className={th}>
                  Ours, 1 m
                </th>
                <th scope="col" className={th}>
                  Paper A, 1 m
                </th>
                <th scope="col" className={th}>
                  Paper C, 1 m
                </th>
                <th scope="col" className={th}>
                  Ours, 5 m
                </th>
                <th scope="col" className={th}>
                  Paper A, 5 m
                </th>
                <th scope="col" className={th}>
                  Paper C, 5 m
                </th>
              </tr>
            </thead>
            <tbody>
              {barker.map((r) => (
                <tr key={r.roi} className="border-b border-hairline last:border-0">
                  <th scope="row" className={`${td} text-left font-sans`}>
                    {r.roi}
                  </th>
                  <td className={td}>{pct(r.ours_1m)}</td>
                  <td className={td}>{pct(r.paper_a_1m)}</td>
                  <td className={td}>{pct(r.paper_c_1m)}</td>
                  <td className={td}>{pct(r.ours_5m)}</td>
                  <td className={td}>{pct(r.paper_a_5m)}</td>
                  <td className={td}>{pct(r.paper_c_5m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-text-2">
          Criteria: ours at least A minus 2 points ({crit.A1_floor ? "met" : "not met"}); ours at
          most C plus 5 points ({crit.A2_ceiling ? "met" : "not met"}); median of ours at 1 m at
          least 70 % ({pct(crit.A3_median_at_1m_pct)}, {crit.passes ? "met" : "not met"}). This is a
          one-sided check: the paper&apos;s values are pessimistic percentiles.
        </p>
      </section>

      <section aria-labelledby="map-title" className="space-y-4">
        <h2 id="map-title" className="font-condensed text-2xl font-semibold tracking-wide">
          3. The lit pattern against NASA&apos;s AVGVISIB map
        </h2>
        <p className="text-text-2">
          900 random points in the three terrain tiles (300 each): the share of time (2024 to 2026,
          2 m mast) that any part of the Sun&apos;s disk is above the terrain, at each point,
          against the value of NASA&apos;s PDS average-illumination map at the same place, as a rank
          correlation (Spearman). The thresholds ({avg.criteria.rho_all_at_least} overall,{" "}
          {avg.criteria.rho_each_tile_at_least} per tile) were fixed first.
        </p>
        <div className="overflow-x-auto rounded-lg border border-hairline">
          <table className="w-full min-w-[24rem] border-collapse">
            <caption className="sr-only">
              Rank correlation with the AVGVISIB map, overall and by tile
            </caption>
            <thead>
              <tr className="border-b border-hairline">
                <th scope="col" className={th}>
                  Tile
                </th>
                <th scope="col" className={th}>
                  Points
                </th>
                <th scope="col" className={th}>
                  Spearman, 2 m mast
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(avg.tiles).map(([id, t]) => (
                <tr key={id} className="border-b border-hairline">
                  <th scope="row" className={`${td} text-left font-sans`}>
                    {siteName(id)}
                  </th>
                  <td className={td}>{t.points}</td>
                  <td className={td}>{t.spearman_2m.toFixed(3)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className={`${td} text-left font-sans`}>
                  All three
                </th>
                <td className={td}>{avg.all_tiles.points}</td>
                <td className={td}>{avg.all_tiles.spearman_2m.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-labelledby="not-title"
        className="space-y-3 rounded-lg border border-hairline bg-surface-glass p-4"
      >
        <h2 id="not-title" className="font-condensed text-2xl font-semibold tracking-wide">
          What this does not show
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-text-2">
          <li>
            It does not validate the illumination at the three preset sites. No published value
            exists for those exact points; the checks above test the method (at Barker&apos;s
            regions) and the spatial pattern (against the map).
          </li>
          <li>
            It says nothing about Earth visibility or the direct-to-Earth link: no published
            reference has been compared, so no link figure is presented as checked.
          </li>
          <li>
            The map&apos;s simulated time span and observer height for this release are not
            published in its label, so that comparison is by rank only.
          </li>
          <li>
            Both illumination checks use the same 5 m elevation tiles as the paper, so neither tests
            the elevation data itself.
          </li>
          <li>The three sites are positions in NASA elevation tiles, not landing points.</li>
        </ul>
        <p className="text-sm text-text-3">
          Sources: JPL Horizons; Barker et al. (2021), Planetary and Space Science 203:105119;
          Mazarico et al. (2011), Icarus 211:1066, with the PDS release of 2016-08; NASA LOLA
          elevation data via PGDA. Methods: <code>docs/science/METHODS.md</code> sections 5 to 7.
        </p>
      </section>
    </main>
  );
}
