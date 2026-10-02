# Citations

Every number shown in the app, the slides or the video comes from engine output or from a source
listed here. Datasets are cited by their id in `pipeline/sources.yaml`.

| Id | Source | Used for |
|---|---|---|
| `ntrs-barker2021-pdf` | Barker, M.K., Mazarico, E., Neumann, G.A., Smith, D.E., Zuber, M.T., Head, J.W. (2021) Improved LOLA elevation maps for south pole landing sites: Error estimates and their impact on illumination conditions. Planetary and Space Science 203:105119, doi:10.1016/j.pss.2020.105119. NTRS 20205009660 (accepted manuscript) | The 5 m site DEMs (`pgda78-site*`); Table 2 and section 5 for the illumination benchmark (`pipeline/benchmarks/barker2021_table2.json`, METHODS §7) |
| `pds-avgvisib-85s-60m` | Mazarico, E., Neumann, G.A., Smith, D.E., Zuber, M.T., Torrence, M.H. (2011) Illumination conditions of the lunar polar regions using LOLA topography. Icarus 211:1066-1081, doi:10.1016/j.icarus.2010.10.030; PDS release 2016-08 | The average-illumination map the lit pattern is compared with (METHODS §7) |
| `pgda90-ldem-80s-80m` | Barker et al. (2023), Planetary Science Journal (DOI still to verify, P1-04d) | The 80 m terrain beyond the site tiles |
| SPICE kernels | NAIF generic kernels, DE440s, `MOON_ME` (DECISIONS D-008) | Sun, Earth and DSN directions |
| JPL Horizons | `sources.yaml` `apis` section | The independent direction check (METHODS §5.1) |
