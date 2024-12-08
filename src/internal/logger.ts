import createLogger from "pino";

export const logger = createLogger({
  msgPrefix: "[bun-workspaces] ",
  level:
    process.env.NODE_ENV === "test"
      ? "silent"
      : process.env.NODE_ENV === "development"
      ? "debug"
      : "info",
  transport: {
    target: "pino-pretty",
    options: {
      color: true,
    },
  },
});
