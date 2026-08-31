import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const flatEn = flatten(en as Tree);
const flatAr = flatten(ar as Tree);

describe("message catalogue parity", () => {
  it("defines exactly the same keys in English and Arabic", () => {
    const enKeys = Object.keys(flatEn).sort();
    const arKeys = Object.keys(flatAr).sort();
    expect(arKeys.filter((k) => !flatEn[k])).toEqual([]);
    expect(enKeys.filter((k) => !flatAr[k])).toEqual([]);
    expect(arKeys).toEqual(enKeys);
  });

  it("has no empty or whitespace-only values", () => {
    const emptyEn = Object.keys(flatEn).filter((k) => !flatEn[k].trim());
    const emptyAr = Object.keys(flatAr).filter((k) => !flatAr[k].trim());
    expect(emptyEn).toEqual([]);
    expect(emptyAr).toEqual([]);
  });

  it("does not leave English copy untranslated in the Arabic catalogue", () => {
    // Brand names and short symbols may legitimately match across locales.
    const allowed = new Set(["Hills Coffee", "Hills", "B2B", "EN", "AR"]);
    const identical = Object.keys(flatEn).filter(
      (key) =>
        flatEn[key] === flatAr[key] &&
        !allowed.has(flatEn[key]) &&
        /[a-z]{4,}/i.test(flatEn[key]),
    );
    expect(identical).toEqual([]);
  });
});
