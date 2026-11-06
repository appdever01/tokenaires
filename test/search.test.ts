import { describe, expect, it } from "vitest";

describe("leaderboard search filtering logic", () => {
  const sampleEntries = [
    {
      rank: 1,
      user: {
        handle: "femi_dev",
        name: "Femi Adesina",
        avatarUrl: null,
        country: "NG",
      },
      tokens: 150000000,
    },
    {
      rank: 2,
      user: {
        handle: "alex99",
        name: "Alex Johnson",
        avatarUrl: null,
        country: "US",
      },
      tokens: 90000000,
    },
    {
      rank: 3,
      user: {
        handle: "codemaster",
        name: null,
        avatarUrl: null,
        country: "DE",
      },
      tokens: 75000000,
    },
  ];

  function filterEntries(entries: typeof sampleEntries, query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
      const handle = entry.user.handle.toLowerCase();
      const name = (entry.user.name ?? "").toLowerCase();
      return handle.includes(q) || name.includes(q);
    });
  }

  it("returns all entries when query is empty", () => {
    expect(filterEntries(sampleEntries, "")).toHaveLength(3);
    expect(filterEntries(sampleEntries, "   ")).toHaveLength(3);
  });

  it("filters correctly by handle substring case-insensitively", () => {
    const res = filterEntries(sampleEntries, "FEMI");
    expect(res).toHaveLength(1);
    expect(res[0].user.handle).toBe("femi_dev");
  });

  it("filters correctly by name substring", () => {
    const res = filterEntries(sampleEntries, "Johnson");
    expect(res).toHaveLength(1);
    expect(res[0].user.handle).toBe("alex99");
  });

  it("handles null name gracefully without errors", () => {
    const res = filterEntries(sampleEntries, "master");
    expect(res).toHaveLength(1);
    expect(res[0].user.handle).toBe("codemaster");
  });

  it("returns empty list when no matches exist", () => {
    const res = filterEntries(sampleEntries, "nonexistent");
    expect(res).toHaveLength(0);
  });
});
