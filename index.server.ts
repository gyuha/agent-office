import type { PluginServerContext } from "@getpaseo/plugin/server";
import { contributeOffice } from "./server/office.ts";

export default function contribute(server: PluginServerContext) {
  return contributeOffice(server);
}
