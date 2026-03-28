import chalk from "chalk";
import { VERSION } from "./constants.js";
// ── Colors (warm black aesthetic) ──
const brand = chalk.hex("#8B5CF6");
const dim = chalk.hex("#6B7280");
const warm = chalk.hex("#D4C5A9");
const bright = chalk.hex("#E5E7EB");
// ── Banner ──
export function banner() {
  const art = [
    "",
    brand("   ___                    __  ____  _       __"),
    brand("  / _ |___ ____ ___  ____/ / / __ \\(_)___ _/ /"),
    brand(" / __ / _ `/ -_) _ \\/ __/ / / / / / / _ `/ / "),
    brand("/_/ |_\\_, /\\__/_//_/\\__/_/ /_/ /_/_/\\_,_/_/  "),
    brand("     /___/"),
    "",
    dim(`  v${VERSION} ${warm("One identity. Every channel.")}`),
    "",
  ];
  console.log(art.join("\n"));
}
// ── Box Drawing ──
export function box(title, content) {
  const lines = content.split("\n");
  const maxLen = Math.max(
    title.length + 2,
    ...lines.map((l) => stripAnsi(l).length),
  );
  const width = Math.min(maxLen + 4, 72);
  const top = dim(`  ${"\u250C"}${"─".repeat(width)}${"\u2510"}`);
  const titleLine =
    dim("  │ ") +
    brand(title) +
    " ".repeat(width - title.length - 2) +
    dim(" │");
  const sep = dim(`  ${"\u251C"}${"─".repeat(width)}${"\u2524"}`);
  const bot = dim(`  ${"\u2514"}${"─".repeat(width)}${"\u2518"}`);
  console.log(top);
  console.log(titleLine);
  console.log(sep);
  for (const line of lines) {
    const stripped = stripAnsi(line);
    const pad = width - stripped.length - 2;
    console.log(dim("  │ ") + line + " ".repeat(Math.max(0, pad)) + dim(" │"));
  }
  console.log(bot);
}
// ── Status Helpers ──
export function success(msg) {
  console.log(chalk.green("  \u2713 ") + bright(msg));
}
export function error(msg) {
  console.log(chalk.red("  \u2717 ") + bright(msg));
}
export function warn(msg) {
  console.log(chalk.yellow("  ! ") + bright(msg));
}
export function info(msg) {
  console.log(dim("  \u2022 ") + warm(msg));
}
export function heading(msg) {
  console.log("\n" + brand("  " + msg));
  console.log(dim("  " + "─".repeat(msg.length)));
}
export function table(headers, rows) {
  if (rows.length === 0) {
    info("No data to display.");
    return;
  }
  const colWidths = headers.map((h) =>
    Math.max(h.length, ...rows.map((r) => stripAnsi(r[h] ?? "").length)),
  );
  const headerLine = headers
    .map((h, i) => brand(h.padEnd(colWidths[i] ?? 0)))
    .join(dim("  "));
  console.log("  " + headerLine);
  console.log("  " + colWidths.map((w) => dim("─".repeat(w))).join(dim("  ")));
  for (const row of rows) {
    const line = headers
      .map((h, i) => {
        const val = row[h] ?? "";
        const stripped = stripAnsi(val);
        const pad = (colWidths[i] ?? 0) - stripped.length;
        return val + " ".repeat(Math.max(0, pad));
      })
      .join(dim("  "));
    console.log("  " + line);
  }
  console.log("");
}
// ── Utilities ──
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001B\[\d+m/g, "").replace(/\u001B\[[\d;]*m/g, "");
}
//# sourceMappingURL=ui.js.map
