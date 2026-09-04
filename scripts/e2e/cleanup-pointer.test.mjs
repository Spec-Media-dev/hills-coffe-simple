import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CURRENT_POINTER, clearCurrentPointer } from "./runtime.mjs";

/**
 * Regression cover for the stale current-fixtures pointer.
 *
 * Cleanup deleted a run's rows, storage objects and auth users but left
 * `current.json` behind. `hasP12Fixtures` therefore stayed true while the
 * personas it named no longer existed, so every authenticated test ran against
 * deleted accounts: sign-in produced no session and fixture-dependent specs
 * burned their whole timeout instead of skipping. An entire regression sweep
 * was spent that way before the cause was found.
 *
 * These tests pin both halves of the fix — that a retired run's pointer is
 * removed, and that nothing else ever is.
 */

let dir;
let pointer;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hills-pointer-"));
  pointer = join(dir, "current.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const write = (value) =>
  writeFileSync(
    pointer,
    typeof value === "string" ? value : JSON.stringify(value),
  );

describe("clearCurrentPointer", () => {
  it("removes the pointer when it names the run just cleaned", () => {
    write({ runId: "run-a", password: "x", personas: {} });
    expect(clearCurrentPointer("run-a", pointer)).toBe("removed");
    expect(existsSync(pointer)).toBe(false);
  });

  it("leaves a pointer that belongs to a different, possibly live run", () => {
    write({ runId: "run-b", password: "x", personas: {} });
    expect(clearCurrentPointer("run-a", pointer)).toBe("other-run");
    // Untouched, contents included.
    expect(JSON.parse(readFileSync(pointer, "utf8")).runId).toBe("run-b");
  });

  it("never deletes a pointer it cannot identify", () => {
    // A half-written or corrupted file might still describe a live run, and
    // guessing is how a cleanup starts removing things it does not own.
    write("{ this is not json");
    expect(clearCurrentPointer("run-a", pointer)).toBe("unreadable");
    expect(existsSync(pointer)).toBe(true);
  });

  it("reports an absent pointer rather than failing", () => {
    expect(clearCurrentPointer("run-a", pointer)).toBe("absent");
  });

  it("treats a pointer with no run id as another run's, not as ours", () => {
    write({ password: "x", personas: {} });
    expect(clearCurrentPointer("run-a", pointer)).toBe("other-run");
    expect(existsSync(pointer)).toBe(true);
  });

  it("is scoped to exactly one known path", () => {
    // The helper must never be handed a directory to sweep. Its default target
    // is the single file the seed writes, and the suite reads.
    expect(CURRENT_POINTER.replace(/\\/g, "/")).toBe(
      "tests/e2e/.p12-runs/current.json",
    );
  });

  it("leaves sibling files in the directory alone", () => {
    const manifest = join(dir, "run-a.json");
    writeFileSync(manifest, JSON.stringify({ runId: "run-a" }));
    write({ runId: "run-a", password: "x", personas: {} });
    expect(clearCurrentPointer("run-a", pointer)).toBe("removed");
    // The run manifest is the cleanup audit trail and must survive.
    expect(existsSync(manifest)).toBe(true);
  });
});
