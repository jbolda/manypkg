// This is a modified version of the package-getting in bolt
// It supports yarn workspaces as well, and can fall back through
// several options

import fs from "fs-extra";
import path from "path";
import globby, { sync as globbySync } from "globby";
import readYamlFile, { sync as readYamlFileSync } from "read-yaml-file";
import { PackageJSON } from "@changesets/types";
import { findRoot, findRootSync } from "@manypkg/find-root";

export type Tool = "yarn" | "bolt" | "pnpm" | "cargo" | "root";

export type Package = { packageJson: PackageJSON; dir: string };

export type Packages = {
  tool: Tool;
  packages: Package[];
  root: Package;
};

export class PackageJsonMissingNameError extends Error {
  directories: string[];
  constructor(directories: string[]) {
    super(
      `The following package.jsons are missing the "name" field:\n${directories.join(
        "\n"
      )}`
    );
    this.directories = directories;
  }
}

export function determineTool(pkg: any, pkgFileType: string, sidecar: any) {
  switch (pkgFileType) {

    case 'JavaScript':
      if (!sidecar) {
        if (pkg.workspaces) {
          if (Array.isArray(pkg.workspaces)) {
            return {
              type: "yarn",
              packageGlobs: pkg.workspaces
            };
          } else if (pkg.workspaces.packages) {
            return {
              type: "yarn",
              packageGlobs: pkg.workspaces.packages
            };
          }
        } else if (pkg.bolt && pkg.bolt.workspaces) {
          return {
            type: "bolt",
            packageGlobs: pkg.bolt.workspaces
          };
        }
      } else if (sidecar && sidecar.packages) {
        return {
          type: "pnpm",
          packageGlobs: sidecar.packages
        };
      }

    case 'Rust':
      if (pkg.workspaces) {
      return {
        type: 'cargo',
        packageGlobs: pkg.workspaces
      }
    } else {
      return {type: 'cargo'}
    }
  }
}

export async function getPackages(dir: string, toolset: string = 'default'): Promise<Packages> {
  const cwd = await findRoot(dir);
  let pkg: any | undefined

  let tool:
    | {
      type: Tool;
      packageGlobs: string[];
    }
    | undefined;

  try {
    pkg = await fs.readJson(path.join(cwd, "package.json"));
    tool = determineTool(pkg, 'JavaScript')
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }

  // if we found package.json, but not the tool, try pnpm
  if (!!pkg && !tool) {
    try {
      const manifest = await readYamlFile<{ packages?: string[] }>(
        path.join(cwd, "pnpm-workspace.yaml")
      );
      tool = determineTool(pkg, 'JavaScript', manifest)
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  // if we have nothing yet, try rust
  if (!pkg && !tool) {
    try {
      const manifest = await fs.readToml(path.join(cwd, "Cargo.toml"));
      tool = determineTool(pkg, 'Rust', manifest)
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  if (!tool) {
    const root = {
      dir: cwd,
      packageJson: pkg
    };
    if (!pkg.name) {
      throw new PackageJsonMissingNameError(["package.json"]);
    }
    return {
      tool: "root",
      root,
      packages: [root]
    };
  }

  const directories = await globby(tool.packageGlobs, {
    cwd,
    onlyDirectories: true,
    absolute: true,
    expandDirectories: false,
    ignore: ["**/node_modules", '**/target']
  });

  let pkgJsonsMissingNameField: Array<string> = [];

  // TODO deal with results for Rust
  const results = (
    await Promise.all(
      directories.sort().map(dir =>
        fs
          .readJson(path.join(dir, "package.json"))
          .then(packageJson => {
            if (!packageJson.name) {
              pkgJsonsMissingNameField.push(
                path.relative(cwd, path.join(dir, "package.json"))
              );
            }
            return { packageJson, dir };
          })
          .catch(err => {
            if (err.code === "ENOENT") {
              return null;
            }
            throw err;
          })
      )
    )
  ).filter(x => x);
  if (pkgJsonsMissingNameField.length !== 0) {
    pkgJsonsMissingNameField.sort();
    throw new PackageJsonMissingNameError(pkgJsonsMissingNameField);
  }
  return {
    tool: tool.type,
    root: {
      dir: cwd,
      packageJson: pkg
    },
    packages: results as Package[]
  };
}

export function getPackagesSync(dir: string): Packages {
  const cwd = findRootSync(dir);
  const pkg = fs.readJsonSync(path.join(cwd, "package.json"));

  let tool:
    | {
      type: Tool;
      packageGlobs: string[];
    }
    | undefined;

  if (pkg.workspaces) {
    if (Array.isArray(pkg.workspaces)) {
      tool = {
        type: "yarn",
        packageGlobs: pkg.workspaces
      };
    } else if (pkg.workspaces.packages) {
      tool = {
        type: "yarn",
        packageGlobs: pkg.workspaces.packages
      };
    }
  } else if (pkg.bolt && pkg.bolt.workspaces) {
    tool = {
      type: "bolt",
      packageGlobs: pkg.bolt.workspaces
    };
  } else {
    try {
      const manifest = readYamlFileSync<{ packages?: string[] }>(
        path.join(cwd, "pnpm-workspace.yaml")
      );
      if (manifest && manifest.packages) {
        tool = {
          type: "pnpm",
          packageGlobs: manifest.packages
        };
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  if (!tool) {
    const root = {
      dir: cwd,
      packageJson: pkg
    };
    if (!pkg.name) {
      throw new PackageJsonMissingNameError(["package.json"]);
    }
    return {
      tool: "root",
      root,
      packages: [root]
    };
  }
  const directories = globbySync(tool.packageGlobs, {
    cwd,
    onlyDirectories: true,
    absolute: true,
    expandDirectories: false,
    ignore: ["**/node_modules"]
  });

  let pkgJsonsMissingNameField: Array<string> = [];

  const results = directories
    .sort()
    .map(dir => {
      try {
        const packageJson = fs.readJsonSync(path.join(dir, "package.json"));
        if (!packageJson.name) {
          pkgJsonsMissingNameField.push(
            path.relative(cwd, path.join(dir, "package.json"))
          );
        }
        return { packageJson, dir };
      } catch (err) {
        if (err.code === "ENOENT") return null;
        throw err;
      }
    })
    .filter(x => x);

  if (pkgJsonsMissingNameField.length !== 0) {
    pkgJsonsMissingNameField.sort();
    throw new PackageJsonMissingNameError(pkgJsonsMissingNameField);
  }

  return {
    tool: tool.type,
    root: {
      dir: cwd,
      packageJson: pkg
    },
    packages: results as Package[]
  };
}
