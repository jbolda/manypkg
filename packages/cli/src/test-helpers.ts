// These are utils for testing.
// I wanted to put this in the test folder but then jest tested it
// Easier to put it here than add to jest ignore but maybe wrong.
//
// Who can say? ¯\_(ツ)_/¯

import { Package } from "@manypkg/get-packages";

export let getFakeWS = (
  name: string = "pkg-1",
  version: string = "1.0.0"
): Package => {
  return {
    dir: `some/fake/dir/${name}`,
    packageJson: {
      name,
      version
    }
  };
};

export let getWS = (): Map<string, Package> => {
  let pkg = new Map();
  pkg.set("pkg-1", getFakeWS());
  return pkg;
};
