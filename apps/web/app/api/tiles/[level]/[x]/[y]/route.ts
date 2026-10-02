import { BUNDLED_TILE_COVERAGE } from "@sightline/engine";
import { readTileFile, tileRelPath } from "../../../tileFiles";

interface Params {
  level: string;
  x: string;
  y: string;
}

/** The committed tiles are built into the site; any other tile is read when asked for, so a local
 * full pyramid works in `next dev` and `next start` and is a 404 where there is none. */
export function generateStaticParams(): Params[] {
  return BUNDLED_TILE_COVERAGE.rects.flatMap((r) => {
    const out: Params[] = [];
    for (let x = r.x_min; x <= r.x_max; x++) {
      for (let y = r.y_min; y <= r.y_max; y++) {
        out.push({ level: String(r.level), x: String(x), y: `${y}.bin` });
      }
    }
    return out;
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
): Promise<Response> {
  const { level, x, y } = await params;
  const rel = tileRelPath(level, x, y);
  const bytes = rel === null ? null : await readTileFile(rel);
  if (bytes === null) return new Response("tile not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
