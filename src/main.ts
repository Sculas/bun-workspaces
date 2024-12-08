import { createCli } from "./cli";

if (require.main === module) {
  createCli().run();
}
