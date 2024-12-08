import { test as _test, expect, describe, mock } from "bun:test";
import { CliProgram, createCliProgram } from "../src/cli/cli";
import { getProjectRoot } from "./testProjects";
import packageJson from "../package.json";
import { OUTPUT_CONFIG } from "../src/cli/output";

const createWriteOutMock = () => mock(OUTPUT_CONFIG.writeOut);
const createWriteErrMock = () => mock(OUTPUT_CONFIG.writeErr);
const createHandleErrorMock = () => mock((error: Error) => void 0);

interface TestContext {
  run: (...argv: string[]) => void;
  cliProgram: CliProgram;
  writeOutSpy: ReturnType<typeof createWriteOutMock>;
  writeErrSpy: ReturnType<typeof createWriteErrMock>;
  handleErrorSpy: ReturnType<typeof createHandleErrorMock>;
  assertLastWrite: (pattern: string | RegExp, err?: boolean) => void;
  assertLastErrorThrown: (error: string | RegExp | typeof Error) => void;
}

const test = (name: string, fn: (context: TestContext) => void, only = false) =>
  (only ? _test.only : _test)(name, async () => {
    const writeOutSpy = createWriteOutMock();
    const writeErrSpy = createWriteErrMock();
    const handleErrorSpy = createHandleErrorMock();

    const cliProgram = createCliProgram({
      writeOut: writeOutSpy,
      writeErr: writeErrSpy,
      handleError: handleErrorSpy,
      postInit: (program) => program.exitOverride(),
      defaultCwd: getProjectRoot("default"),
    });

    const createPattern = (pattern: string | RegExp) =>
      pattern instanceof RegExp
        ? pattern
        : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    await fn({
      run: (...argv: string[]) => {
        cliProgram.run({
          argv: [
            "bunx",
            "bun-workspaces",
            ...(argv.length === 1 ? argv[0].split(/\s+/) : argv).filter(
              Boolean,
            ),
          ],
        });
      },
      handleErrorSpy,
      writeOutSpy,
      writeErrSpy,
      assertLastWrite: (pattern: string | RegExp, err = false) =>
        expect(
          (err ? writeErrSpy : writeOutSpy).mock.lastCall?.[0] ?? "",
        ).toMatch(createPattern(pattern)),
      assertLastErrorThrown: (error: string | RegExp | typeof Error) =>
        (error as typeof Error).prototype instanceof Error
          ? expect(handleErrorSpy.mock.lastCall?.[0]).toBeInstanceOf(error)
          : expect(handleErrorSpy.mock.lastCall?.[0]?.message).toMatch(
              createPattern(error as string),
            ),
      cliProgram,
    });
  });

describe("Test CLI", () => {
  test("Help command shows", async ({
    run,
    writeOutSpy,
    writeErrSpy,
    assertLastWrite,
  }) => {
    expect(writeOutSpy).not.toHaveBeenCalled();
    expect(writeErrSpy).not.toHaveBeenCalled();

    await run("");
    expect(writeErrSpy).toBeCalledTimes(1);
    assertLastWrite("Usage", true);

    await run("--help");
    expect(writeOutSpy).toBeCalledTimes(1);
    assertLastWrite("Usage");

    await run("help");
    expect(writeOutSpy).toBeCalledTimes(2);
    assertLastWrite("Usage");

    await run("something-very-wrong");
    expect(writeErrSpy).toBeCalledTimes(2);
    assertLastWrite("Usage");
  });

  test("Version command shows", async ({ run, assertLastWrite }) => {
    await run("--version");
    assertLastWrite(packageJson.version);

    await run("-V");
    assertLastWrite(packageJson.version);
  });

  describe("list-workspaces", () => {
    test("Default project", async ({ run, assertLastWrite, writeOutSpy }) => {
      await run("list-workspaces");
      assertLastWrite("application-a");
      assertLastWrite("application-b");
      assertLastWrite("library-a");
      assertLastWrite("library-b");
      assertLastWrite("library-c");

      await run("ls");
      assertLastWrite("application-a");
      assertLastWrite("application-b");
      assertLastWrite("library-a");
      assertLastWrite("library-b");
      assertLastWrite("library-c");

      await run("ls --name-only");
      assertLastWrite("application-a");
      assertLastWrite("application-b");
      assertLastWrite("library-a");
      assertLastWrite("library-b");
      assertLastWrite("library-c");

      await run("list-workspaces --name-only");
      assertLastWrite(
        new RegExp(
          "^\n?" +
            [
              "application-a",
              "application-b",
              "library-a",
              "library-b",
              "library-c",
            ].join("\n") +
            "\n?$",
        ),
      );
    });

    test("Empty project", async ({ run, assertLastWrite }) => {
      await run("--cwd", getProjectRoot("emptyWorkspaces"), "list-workspaces");
      assertLastWrite("No workspaces found");
    });

    test("One workspace", async ({ run, assertLastWrite }) => {
      await run(
        "--cwd",
        getProjectRoot("oneWorkspace"),
        "list-workspaces",
        "--name-only",
      );
      assertLastWrite(/^\n?application-a\n?$/);
    });
  });

  describe("Invalid project", () => {
    // Validating issues thrown by the core project code are handled
    test("No package.json", async ({ run, assertLastErrorThrown }) => {
      await run(
        "--cwd",
        getProjectRoot("invalidNoPackageJson"),
        "list-workspaces",
      );
      assertLastErrorThrown("No package.json found");
    });

    test("Invalid package.json", async ({ run, assertLastErrorThrown }) => {
      await run("--cwd", getProjectRoot("invalidBadJson"), "list-workspaces");
      assertLastErrorThrown("package.json to be an object");
    });

    test("Duplicate workspace name", async ({ run, assertLastErrorThrown }) => {
      await run(
        "--cwd",
        getProjectRoot("invalidDuplicateName"),
        "list-workspaces",
      );
      assertLastErrorThrown("Duplicate workspace");
    });
  });

  describe("List scripts", () => {
    test("Default project", async ({ run, assertLastWrite }) => {
      await run("list-scripts");
      assertLastWrite("all-workspaces");
      assertLastWrite("a-workspaces");
      assertLastWrite("b-workspaces");
      assertLastWrite("c-workspaces");
      assertLastWrite("application-a");
      assertLastWrite("application-b");
      assertLastWrite("library-a");
      assertLastWrite("library-b");
      assertLastWrite("library-c");

      await run("list-scripts --name-only");
      assertLastWrite(
        new RegExp(
          "^\n?" +
            [
              "a-workspaces",
              "all-workspaces",
              "application-a",
              "application-b",
              "b-workspaces",
              "c-workspaces",
              "library-a",
              "library-b",
              "library-c",
            ].join("\n") +
            "\n?$",
        ),
      );
    });

    test("Empty project", async ({ run, assertLastWrite }) => {
      await run("--cwd", getProjectRoot("emptyWorkspaces"), "list-scripts");
      assertLastWrite("No scripts found");
    });

    test("One workspace", async ({ run, assertLastWrite }) => {
      await run(
        "--cwd",
        getProjectRoot("oneWorkspace"),
        "list-scripts",
        "--name-only",
      );
      assertLastWrite(
        new RegExp(
          "^\n?" +
            ["a-workspaces", "all-workspaces", "application-a"].join("\n") +
            "\n?$",
        ),
      );
    });
  });

  test("workspace-info", async ({ run, assertLastWrite }) => {
    await run("workspace-info application-a");
    assertLastWrite(/(workspace|name): application-a/i);
    assertLastWrite("path: applications/applicationA");
    assertLastWrite("match: applications/*");
    assertLastWrite("scripts: a-workspaces, all-workspaces, application-a");

    await run("workspace-info library-a");
    assertLastWrite(/(workspace|name): library-a/i);
    assertLastWrite("path: libraries/libraryA");
    assertLastWrite("match: libraries/**/*");
    assertLastWrite("scripts: a-workspaces, all-workspaces, library-a");
  });

  describe("script-info", () => {
    test("Default project", async ({ run, assertLastWrite }) => {
      await run("script-info all-workspaces");
      assertLastWrite(/(script|name): all-workspaces/i);
      assertLastWrite("application-a");
      assertLastWrite("application-a");
      assertLastWrite("library-a");
      assertLastWrite("library-b");
      assertLastWrite("library-c");

      await run("script-info a-workspaces --workspaces-only");
      assertLastWrite(
        new RegExp(
          "^\n?" + ["application-a", "library-a"].join("\n") + "\n?$",
          "i",
        ),
      );
    });

    test("No script found", async ({ run, assertLastWrite }) => {
      await run("script-info not-found");
      assertLastWrite("Script not found");
    });
  });

  describe("run", () => {
    test("Valid commands", async ({ run, handleErrorSpy, writeErrSpy }) => {
      await run("run all-workspaces");
      expect(handleErrorSpy).not.toBeCalled();
      expect(writeErrSpy).not.toBeCalled();

      await run("run all-workspaces application-a");
      expect(handleErrorSpy).not.toBeCalled();
      expect(writeErrSpy).not.toBeCalled();

      await run("run all-workspaces library-a");
      expect(handleErrorSpy).not.toBeCalled();
      expect(writeErrSpy).not.toBeCalled();

      await run("run all-workspaces application-a library-a");
      expect(handleErrorSpy).not.toBeCalled();
      expect(writeErrSpy).not.toBeCalled();

      await run("run b-workspaces application-b library-b");
      expect(handleErrorSpy).not.toBeCalled();
      expect(writeErrSpy).not.toBeCalled();

      await run("run b-workspaces application-b library-b --parallel");
      expect(handleErrorSpy).not.toBeCalled();
      expect(writeErrSpy).not.toBeCalled();

      await run(
        "run",
        "b-workspaces",
        "application-b",
        "library-b",
        "--args",
        '"--my --args"',
      );
      expect(handleErrorSpy).not.toBeCalled();
      expect(writeErrSpy).not.toBeCalled();
    });

    test("Invalid commands", async ({ run, assertLastWrite }) => {
      await run("run not-found");
      assertLastWrite('No workspaces found for script "not-found"', true);

      await run("run all-workspaces not-found");
      assertLastWrite('Workspace not found: "not-found"', true);
    });
  });
});
