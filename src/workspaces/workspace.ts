import type { ResolvedPackageJsonContent } from "./packageJson";

export interface Workspace {
  /** The name of the workspace from its `package.json` */
  name: string;
  /** The relative path to the workspace from the root `package.json` */
  path: string;
  /** The pattern from `"workspaces"` in the root `package.json`that this workspace was matched from*/
  matchPattern: string;
  /** The contents of the workspace's package.json, with `"workspaces"` and `"scripts"` resolved */
  packageJson: ResolvedPackageJsonContent;
}
