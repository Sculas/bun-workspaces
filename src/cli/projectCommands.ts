import { type Command } from "commander";
import { logger } from "../internal/logger";
import type { Project } from "../project";
import type { Workspace } from "../workspaces";

const printWorkspaceInfo = (workspace: Workspace) => {
  console.log(`Workspace: ${workspace.name}`);
  console.log(` - Path: ${workspace.path}`);
  console.log(` - Glob Match: ${workspace.matchPattern}`);
  console.log(
    ` - Scripts: ${Object.keys(workspace.packageJson.scripts)
      .sort()
      .join(", ")}`,
  );
};

const printScriptInfo = (script: string, workspaces: Workspace[]) => {
  console.log(`Script: ${script}`);
  workspaces.forEach((workspace) => {
    console.log(` - ${workspace.name}`);
  });
};

const listWorkspaces = (program: Command, project: Project) => {
  program
    .command("list-workspaces")
    .aliases(["ls", "list"])
    .description("List all workspaces")
    .option("--name-only", "Only show workspace names")
    .action((options) => {
      logger.debug("Command: List workspaces");

      if (options.more) {
        logger.debug("Showing more metadata");
      }

      project.workspaces.forEach((workspace) => {
        if (options.nameOnly) {
          console.log(workspace.name);
        } else {
          printWorkspaceInfo(workspace);
        }
      });
    });
};

const listScripts = (program: Command, project: Project) => {
  program
    .command("list-scripts")
    .description("List all scripts available with their workspaces")
    .option("--name-only", "Only show script names")
    .action((options) => {
      logger.debug("Command: List scripts");

      const scripts = project.listScriptsWithWorkspaces();
      Object.values(scripts)
        .sort(({ name: nameA }, { name: nameB }) => nameA.localeCompare(nameB))
        .forEach(({ name, workspaces }) => {
          if (options.nameOnly) {
            console.log(name);
          } else {
            printScriptInfo(name, workspaces);
          }
        });
    });
};

const workspaceInfo = (program: Command, project: Project) => {
  program
    .command("workspace-info <workspace>")
    .aliases(["info"])
    .description("Show information about a workspace")
    .action((workspaceName) => {
      logger.debug(`Command: Workspace info for ${workspaceName}`);

      const workspace = project.findWorkspaceByName(workspaceName);
      if (!workspace) {
        logger.error(`Workspace not found: ${JSON.stringify(workspaceName)}`);
        return;
      }

      printWorkspaceInfo(workspace);
    });
};

const scriptInfo = (program: Command, project: Project) => {
  program
    .command("script-info <script>")
    .description("Show information about a script")
    .action((script) => {
      logger.debug(`Command: Script info for ${script}`);

      const scripts = project.listScriptsWithWorkspaces();
      const scriptMetadata = scripts[script];
      if (!scriptMetadata) {
        logger.error(
          `Script not found: ${JSON.stringify(
            script,
          )} (available: ${Object.keys(scripts).join(", ")})`,
        );
        return;
      }
      printScriptInfo(script, scriptMetadata.workspaces);
    });
};

const runScript = (program: Command, project: Project) => {
  program
    .command("run <script> [workspaces...]")
    .description("Run a script in all workspaces")
    .option("--parallel", "Run the scripts in parallel")
    .option("--args <args>", "Args to append to the script command", "")
    .action(async (script: string, workspaces: string[], options) => {
      logger.debug(
        `Command: Run script ${JSON.stringify(script)} for ${
          workspaces.length
            ? "workspaces " + workspaces.join(", ")
            : "all workspaces"
        } (parallel: ${!!options.parallel}, method: ${JSON.stringify(
          options.method,
        )}, args: ${JSON.stringify(options.args)})`,
      );

      workspaces = workspaces.length
        ? workspaces
        : project.listWorkspacesWithScript(script).map(({ name }) => name);

      if (!workspaces.length) {
        logger.error(`No workspaces found for script: ${script}`);
        process.exit(1);
      }

      const scriptCommands = workspaces.map((workspaceName) =>
        project.createScriptCommand({
          scriptName: script,
          workspaceName,
          method: "cd",
          args: options.args.replace(/<workspace>/g, workspaceName),
        }),
      );

      const runCommand = async ({
        command,
        scriptName,
        workspace,
      }: (typeof scriptCommands)[number]) => {
        const splitCommand = command.command.split(/\s+/g);

        logger.debug(
          `Running script ${scriptName} in workspace ${workspace.name} (cwd: ${
            command.cwd
          }): ${splitCommand.join(" ")}`,
        );

        const silent = logger.level === "silent";

        if (!silent) {
          console.log(
            `Running script ${JSON.stringify(
              scriptName,
            )} in workspace ${JSON.stringify(workspace.name)}`,
          );
        }

        const proc = Bun.spawn(command.command.split(/\s+/g), {
          cwd: command.cwd,
          env: process.env,
          stdout: silent ? "ignore" : "inherit",
          stderr: silent ? "ignore" : "inherit",
        });

        await proc.exited;

        return {
          scriptName,
          workspace,
          command,
          success: proc.exitCode === 0,
        };
      };

      const handleError = (error: unknown) => {
        logger.error(error);
        process.exit(1);
      };

      const handleResult = ({
        scriptName,
        workspace,
        success,
      }: (typeof scriptCommands)[number] & { success: boolean }) => {
        logger.info(
          `${success ? "✅" : "❌"} ${workspace.name}: ${scriptName}`,
        );
        if (!success) {
          process.exit(1);
        }
      };

      if (options.parallel) {
        for await (const result of await Promise.allSettled(
          scriptCommands.map(runCommand),
        )) {
          if (result.status === "rejected") {
            handleError(result.reason);
          } else {
            handleResult(result.value);
          }
        }
      } else {
        for (const command of scriptCommands) {
          try {
            const result = await runCommand(command);
            handleResult(result);
          } catch (error) {
            handleError(error);
          }
        }
      }
    });
};

export const defineProjectCommands = (program: Command, project: Project) => {
  listWorkspaces(program, project);
  listScripts(program, project);
  workspaceInfo(program, project);
  scriptInfo(program, project);
  runScript(program, project);
};
