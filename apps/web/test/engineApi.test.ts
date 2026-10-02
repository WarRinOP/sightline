import { readFileSync } from "node:fs";
import { MessageChannel } from "node:worker_threads";
import * as Comlink from "comlink";
import { describe, expect, it } from "vitest";
import { siteLocation } from "@sightline/contracts";
import {
  BUNDLED_EPHEMERIS_META,
  BUNDLED_SITES,
  createSightlineEngineClient,
  utcIsoToEt,
} from "@sightline/engine";
import { createEngineApi, type EngineApi } from "../workers/engineApi";

const bin = readFileSync(
  new URL("../../../packages/engine/src/data/ephemeris_2026_3600s.bin", import.meta.url),
);
const loadBytes = (): Promise<ArrayBuffer> =>
  Promise.resolve(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);

const direct = createSightlineEngineClient(await loadBytes());
const epoch_et = utcIsoToEt("2026-10-07T08:44:13");
const site = BUNDLED_SITES[1];
if (!site) throw new Error("the bundled catalog is empty");
const location = siteLocation(site);

describe("engine API behind the worker", () => {
  it("reports real provenance and the ephemeris span", async () => {
    const info = await createEngineApi(loadBytes).info();
    expect(info.provenance.simulated).toBe(false);
    expect(info.start_et).toBe(BUNDLED_EPHEMERIS_META.header.start_et);
    expect(info.end_et).toBe(BUNDLED_EPHEMERIS_META.header.end_et);
  });

  it("returns exactly what the engine returns, for every bundled site", async () => {
    const api = createEngineApi(loadBytes);
    for (const s of BUNDLED_SITES) {
      const loc = siteLocation(s);
      expect(await api.getSunEarth(epoch_et, loc, 0)).toEqual(
        await direct.getSunEarth(epoch_et, loc, 0),
      );
    }
    expect(await api.listSites()).toEqual(await direct.listSites());
  });

  it("refuses the terrain methods instead of answering with flat-ground numbers", async () => {
    const api = createEngineApi(loadBytes);
    await expect(api.getHorizon(location, 0)).rejects.toMatchObject({ name: "NotAvailableError" });
    await expect(api.probeLit(location, epoch_et)).rejects.toMatchObject({
      name: "NotAvailableError",
    });
  });

  it("rejects an epoch outside the ephemeris", async () => {
    const api = createEngineApi(loadBytes);
    const { end_et } = BUNDLED_EPHEMERIS_META.header;
    await expect(api.getSunEarth(end_et + 3600, location, 0)).rejects.toThrow(/outside/);
  });

  it("loads the file once, and surfaces a load failure", async () => {
    let loads = 0;
    const api = createEngineApi(() => {
      loads += 1;
      return loadBytes();
    });
    await Promise.all([api.info(), api.listSites(), api.getSunEarth(epoch_et, location, 0)]);
    expect(loads).toBe(1);

    const broken = createEngineApi(() => Promise.reject(new Error("HTTP 404")));
    await expect(broken.info()).rejects.toThrow("HTTP 404");
  });

  it("gives the same answers across a message channel, as the worker does", async () => {
    const { port1, port2 } = new MessageChannel();
    // Node's ports are EventTargets with the same message shape as a browser worker's.
    Comlink.expose(createEngineApi(loadBytes), port2 as unknown as Comlink.Endpoint);
    const remote = Comlink.wrap<EngineApi>(port1 as unknown as Comlink.Endpoint);

    expect(await remote.getSunEarth(epoch_et, location, 0)).toEqual(
      await direct.getSunEarth(epoch_et, location, 0),
    );
    // The error crosses the boundary with its name, so callers can tell it from a crash.
    await expect(remote.getTimeline({} as never)).rejects.toMatchObject({
      name: "NotAvailableError",
    });

    // The terrain horizon of the one site that has one crosses the boundary intact, and the
    // other sites are still refused with the error's name.
    const rim = BUNDLED_SITES.find((s) => s.id === "shackleton-rim");
    if (!rim) throw new Error("the bundled catalog has no Shackleton Rim");
    const mask = await remote.getHorizon(siteLocation(rim), 2);
    expect(mask.mask_elevation_rad).toHaveLength(1440);
    expect(mask.simulated).toBe(false);
    expect(await remote.probeLit(siteLocation(rim), epoch_et, 2)).toEqual(
      await direct.probeLit(siteLocation(rim), epoch_et, 2),
    );
    await expect(remote.getHorizon(location, 2)).rejects.toMatchObject({
      name: "NotAvailableError",
    });

    remote[Comlink.releaseProxy]();
    port1.close();
    port2.close();
  });
});
