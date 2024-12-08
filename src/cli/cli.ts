import { program } from "commander";
import packageJson from "../../package.json";
import {
  getRequiredBunVersion,
  validateCurrentBunVersion,
} from "../internal/bunVersion";
import { logger } from "../internal/logger";
import { initializeWithGlobalOptions } from "./globalOptions";
import { defineProjectCommands } from "./projectCommands";

export interface Cli {
  run: (argv?: string | string[]) => Promise<void>;
}

export const createCli = (): Cli => {
  program
    .name("bunx bun-workspaces")
    .description("CLI for utilities for Bun workspaces")
    .version(packageJson.version);

  const run = async (argv: string | string[] = process.argv) => {
    process.on("unhandledRejection", (error) => {
      logger.error(error);
      logger.error("Unhandled rejection");
      process.exit(1);
    });

    if (!validateCurrentBunVersion()) {
      logger.error(
        `Bun version mismatch. Required: ${getRequiredBunVersion()}, Found: ${
          Bun.version
        }`,
      );
      process.exit(1);
    }

    const args = typeof argv === "string" ? argv.split(" ") : argv;

    const { project } = initializeWithGlobalOptions(program, args);
    if (!project) return;

    defineProjectCommands(program, project);

    await program.parseAsync(args);
  };

  return {
    run,
  };
};
