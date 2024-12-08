import path from "path";

const TEST_PROJECTS = {
  default: "fullProject",
  fullProject: "fullProject",
  invalidBadJson: "invalid/badJson",
  invalidNoName: "invalid/noName",
  invalidDuplicateName: "invalid/duplicateName",
  invalidBadTypeWorkspaces: "invalid/badTypeWorkspaces",
  invalidBadTypeScripts: "invalid/badTypeScripts",
  invalidNoPackageJson: "invalid/noPackageJson",
  invalidBadWorkspaceGlobType: "invalid/badWorkspaceGlobType",
  invalidBadWorkspaceGlobOutsideRoot: "invalid/badWorkspaceGlobOutsideRoot",
};

type TestProject = keyof typeof TEST_PROJECTS;

export const getProjectRoot = (project: TestProject) =>
  path.join(__dirname, TEST_PROJECTS[project]);
