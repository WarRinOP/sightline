"""Read the leap-second table and TDB constants from the LSK (naif0012.tls) as JSON.

The browser engine converts UTC and ET with this table; parity tests compare it with SPICE.
"""

import re
from datetime import date
from pathlib import Path
from typing import Any

_MONTHS = ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
_NUMBER = r"[-+]?\d+\.?\d*(?:[DdEe][-+]?\d+)?"


def _numbers(text: str) -> list[float]:
    return [float(n.replace("D", "E").replace("d", "e")) for n in re.findall(_NUMBER, text)]


def _assignment(data: str, name: str) -> str:
    """Right-hand side of `NAME = value` or `NAME = ( v1 v2 )` in the data section."""
    m = re.search(rf"^{re.escape(name)}\s*=\s*(\([^)]*\)|[^\n]*)", data, re.M)
    if m is None:
        raise ValueError(f"{name} not found in the LSK")
    return m.group(1)


def parse_lsk(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="ascii")
    data = "\n".join(re.findall(r"\\begindata(.*?)\\begintext", text, re.S))

    pairs = re.findall(
        r"(\d+)\s*,\s*@(\d{4})-([A-Z]{3})-(\d{1,2})", _assignment(data, "DELTET/DELTA_AT")
    )
    if not pairs:
        raise ValueError("DELTET/DELTA_AT has no entries")
    delta_at = [
        {"utc": date(int(y), _MONTHS.index(mon) + 1, int(d)).isoformat(), "seconds": int(sec)}
        for sec, y, mon, d in pairs
    ]
    m = _numbers(_assignment(data, "DELTET/M"))
    return {
        "schema_version": 1,
        "source_kernel": path.name,
        "delta_t_a": _numbers(_assignment(data, "DELTET/DELTA_T_A"))[0],
        "k": _numbers(_assignment(data, "DELTET/K"))[0],
        "eb": _numbers(_assignment(data, "DELTET/EB"))[0],
        "m0": m[0],
        "m1": m[1],
        "delta_at": delta_at,
    }
