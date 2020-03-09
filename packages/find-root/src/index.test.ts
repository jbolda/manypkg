import { findRoot, findRootSync } from ".";
import fixturez from "fixturez";
import path from "path";

let f = fixturez(__dirname);

type FindRoot = typeof findRoot | typeof findRootSync;

const runTests = (findRoot: FindRoot) => {
  test("it returns the root of a monorepo", async () => {
    let tmpPath = f.copy("basic");
    let packagesRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    expect(packagesRoot).toBe(tmpPath);
  });

  test("it returns the root of a pnpm monorepo", async () => {
    let tmpPath = f.copy("basic-pnpm");
    let packagesRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    expect(packagesRoot).toBe(tmpPath);
  });

  test("it returns the root of a single-package repo", async () => {
    let tmpPath = f.copy("single-pkg");
    let packagesRoot = await findRoot(path.join(tmpPath, "src"));
    expect(packagesRoot).toBe(tmpPath);
  });
};

describe("findRoot", () => {
  runTests(findRoot);
});

describe("findRootSync", () => {
  runTests(findRootSync);
});
