import spiceypy

from sightline_pipeline.kernels import kernel_datasets, loaded_kernels
from sightline_pipeline.leapseconds import parse_lsk
from sightline_pipeline.sources import DEFAULT_RAW_DIR, load_sources
from tests.conftest import needs_kernels

LSK = DEFAULT_RAW_DIR / "naif-lsk" / "naif0012.tls"


@needs_kernels
def test_lsk_table_has_the_28_entries_and_the_tdb_constants() -> None:
    t = parse_lsk(LSK)
    assert len(t["delta_at"]) == 28
    assert t["delta_at"][0] == {"utc": "1972-01-01", "seconds": 10}
    assert t["delta_at"][-1] == {"utc": "2017-01-01", "seconds": 37}
    assert t["delta_t_a"] == 32.184


@needs_kernels
def test_lsk_values_equal_what_spice_loads_from_the_same_kernel() -> None:
    t = parse_lsk(LSK)
    with loaded_kernels(DEFAULT_RAW_DIR, load_sources()):
        assert spiceypy.gdpool("DELTET/DELTA_T_A", 0, 1)[0] == t["delta_t_a"]
        assert spiceypy.gdpool("DELTET/K", 0, 1)[0] == t["k"]
        assert spiceypy.gdpool("DELTET/EB", 0, 1)[0] == t["eb"]
        m = spiceypy.gdpool("DELTET/M", 0, 2)
        assert (m[0], m[1]) == (t["m0"], t["m1"])
        # SPICE stores DELTA_AT as (seconds, epoch) pairs; compare the seconds column.
        pairs = spiceypy.gdpool("DELTET/DELTA_AT", 0, 2 * len(t["delta_at"]))
        assert [int(pairs[2 * i]) for i in range(len(t["delta_at"]))] == [
            e["seconds"] for e in t["delta_at"]
        ]


def test_the_kernel_list_is_the_eight_of_d008() -> None:
    names = [d.filename for d in kernel_datasets(load_sources())]
    assert names == [
        "naif0012.tls",
        "de440s.bsp",
        "moon_pa_de440_200625.bpc",
        "pck00011.tpc",
        "moon_de440_250416.tf",
        "earth_2026_260806_2126_predict.bpc",
        "earth_topo_260814.tf",
        "earthstns_itrf93_260814.bsp",
    ]
