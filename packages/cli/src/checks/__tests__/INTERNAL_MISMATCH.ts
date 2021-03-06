import makeCheck, { ErrorType } from "../INTERNAL_MISMATCH";
import { getWS, getFakeWS } from "../../test-helpers";

let rootWorkspace = getFakeWS("root");

describe("internal mismatch", () => {
  it("should not error if internal version is compatible", () => {
    let ws = getWS();
    let dependsOnOne = getFakeWS("depends-on-one");
    dependsOnOne.packageJson.dependencies = {
      "pkg-1": "^1.0.0"
    };
    ws.set("depends-on-one", dependsOnOne);
    let errors = makeCheck.validate(dependsOnOne, ws, rootWorkspace);
    expect(errors.length).toEqual(0);
  });
  it("should error if internal version is not compatible", () => {
    let ws = getWS();
    let dependsOnOne = getFakeWS("depends-on-one");
    dependsOnOne.packageJson.dependencies = {
      "pkg-1": "^0.1.0"
    };
    ws.set("depends-on-one", dependsOnOne);
    let errors = makeCheck.validate(dependsOnOne, ws, rootWorkspace);
    expect(errors[0]).toMatchObject({
      type: "INTERNAL_MISMATCH",
      dependencyWorkspace: ws.get("pkg-1"),
      workspace: dependsOnOne,
      dependencyRange: "^0.1.0"
    });
    expect(errors.length).toEqual(1);
  });
  it("should fix an incompatible version", () => {
    let workspace = getFakeWS("depends-on-one");
    workspace.packageJson.dependencies = {
      "pkg-1": "^0.1.0"
    };

    let error: ErrorType = {
      type: "INTERNAL_MISMATCH",
      workspace,
      dependencyWorkspace: getFakeWS(),
      dependencyRange: "^0.1.0"
    };

    let fixed = makeCheck.fix!(error);
    expect(fixed).toMatchObject({ requiresInstall: true });
    expect(workspace.packageJson.dependencies).toMatchObject({
      "pkg-1": "^1.0.0"
    });
  });
  it("should not check dev dependencies", () => {
    // This is handled by INTERNAL_DEV_DEP_NOT_STAR
    let ws = getWS();
    let dependsOnOne = getFakeWS("depends-on-one");
    dependsOnOne.packageJson.devDependencies = {
      "pkg-1": "^0.1.0"
    };
    ws.set("depends-on-one", dependsOnOne);
    let errors = makeCheck.validate(dependsOnOne, ws, rootWorkspace);
    expect(errors.length).toEqual(0);
  });
});
