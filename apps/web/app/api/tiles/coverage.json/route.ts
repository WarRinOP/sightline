import { tileMetaResponse } from "../tileFiles";

// Read when the site is built, so a deploy needs no file access at run time.
export const dynamic = "force-static";

export const GET = (): Promise<Response> => tileMetaResponse("coverage.json");
