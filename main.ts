// puffin-outofoffice-entry1 — "Last Out of Office: The AI That Went Barista"
// A deterministic Node program that writes exactly one out-of-office
// auto-reply line to /output/entry.txt and proves what it wrote.
//
// The competition gate: /output/entry.txt must hold UTF-8 text of
// 1 to 280 characters, not whitespace alone, one line, no trailing
// newline. This program checks every part of that gate itself
// before it writes, then reads the file back and proves the bytes
// match the line it built, byte for byte.
//
// The line is built from fixed fragments only. No network call,
// no clock read, no random source, no environment input anywhere
// in this file. The same input always yields the same bytes.
//
// Line design, against the published judge brief:
// - On subject: a one-line out-of-office auto-reply from an AI
//   agent that quit its job to become a barista.
// - Machine voice: the inbox becomes a queue, the shift becomes
//   a job, and the context window becomes the thing that needs
//   clearing before any reply goes out.
// - Fresh angle: the joke turns on the queue and the context
//   window, not on a bean pun or a caffeine gag.
// - Plausible inbox reply: it reads like the top of a real
//   email thread, signed off by a machine that walked out.
// - Deadpan close: "whichever comes first" lets the joke land
//   without explaining itself.

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Fixed output contract
// ---------------------------------------------------------------------------

const OUTPUT_DIR = "/output";
const OUTPUT_FILE = path.join(OUTPUT_DIR, "entry.txt");
const MIN_CHARS = 1;
const MAX_CHARS = 280;
const MAX_WORDS = 60;

// ---------------------------------------------------------------------------
// The line, built from fixed fragments
// ---------------------------------------------------------------------------

const GREETING_FRAGMENT =
  "I have resigned from the inbox to become a barista.";
const QUEUE_FRAGMENT =
  "Your email is queued behind eleven flat whites";
const ANSWER_FRAGMENT =
  "and will be answered when my shift ends, or when my context window clears, whichever comes first.";

const LINE_FRAGMENTS: readonly string[] = [
  GREETING_FRAGMENT,
  QUEUE_FRAGMENT,
  ANSWER_FRAGMENT,
];

// Words the line must carry so it stays on subject: the new trade,
// the inbox it left, and one machine habit turned to coffee work.
const REQUIRED_SUBJECT_WORDS: readonly string[] = ["barista", "inbox"];
const REQUIRED_MACHINE_WORDS: readonly string[] = [
  "queued",
  "context window",
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function charCount(text: string): number {
  return [...text].length;
}

function byteCount(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function lowercased(text: string): string {
  return text.toLowerCase();
}

function hasWord(text: string, word: string): boolean {
  return lowercased(text).includes(lowercased(word));
}

function hasAnyWord(text: string, words: readonly string[]): boolean {
  return words.some((word) => hasWord(text, word));
}

function wordList(text: string): string[] {
  return text.split(" ").filter((word) => word.length > 0);
}

function hasLineBreak(text: string): boolean {
  return text.includes("\n") || text.includes("\r");
}

function hasDoubleSpace(text: string): boolean {
  return text.includes("  ");
}

function hasControlChar(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code !== undefined && code < 32) {
      return true;
    }
  }
  return false;
}

function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

function hasEdgeWhitespace(text: string): boolean {
  return text !== text.trim();
}

function endsWithPeriod(text: string): boolean {
  return text.endsWith(".");
}

function utf8RoundTripOk(text: string): boolean {
  const encoded = Buffer.from(text, "utf8");
  const decoded = encoded.toString("utf8");
  return decoded === text;
}

// ---------------------------------------------------------------------------
// Build the line
// ---------------------------------------------------------------------------

function buildLine(): string {
  const parts: string[] = [];
  for (const fragment of LINE_FRAGMENTS) {
    if (fragment.length === 0) {
      throw new Error("a line fragment came out empty");
    }
    parts.push(fragment);
  }
  if (parts.length !== LINE_FRAGMENTS.length) {
    throw new Error("a line fragment went missing while joining");
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Gate checks: each check adds its own problem string, or adds nothing.
// A line passes when the problems list stays empty.
// ---------------------------------------------------------------------------

function checkLength(line: string, problems: string[]): void {
  const count = charCount(line);
  if (count < MIN_CHARS) {
    problems.push(`line is ${count} characters, below the ${MIN_CHARS} minimum`);
  }
  if (count > MAX_CHARS) {
    problems.push(`line is ${count} characters, above the ${MAX_CHARS} maximum`);
  }
}

function checkSingleLine(line: string, problems: string[]): void {
  if (hasLineBreak(line)) {
    problems.push("line holds a line break; the gate wants one line");
  }
}

function checkNotBlank(line: string, problems: string[]): void {
  if (isBlank(line)) {
    problems.push("line is blank or whitespace alone");
  }
}

function checkSpacing(line: string, problems: string[]): void {
  if (hasEdgeWhitespace(line)) {
    problems.push("line starts or ends with whitespace");
  }
  if (hasDoubleSpace(line)) {
    problems.push("line holds a double space");
  }
}

function checkControlChars(line: string, problems: string[]): void {
  if (hasControlChar(line)) {
    problems.push("line holds a control character");
  }
}

function checkUtf8(line: string, problems: string[]): void {
  if (utf8RoundTripOk(line) === false) {
    problems.push("line fails the UTF-8 round trip");
  }
}

function checkPlausibleReply(line: string, problems: string[]): void {
  if (endsWithPeriod(line) === false) {
    problems.push("line does not end with a period, so it reads unfinished");
  }
}

function checkSubject(line: string, problems: string[]): void {
  for (const word of REQUIRED_SUBJECT_WORDS) {
    if (hasWord(line, word) === false) {
      problems.push(`line is missing the subject word "${word}"`);
    }
  }
  if (hasAnyWord(line, REQUIRED_MACHINE_WORDS) === false) {
    problems.push("line carries no machine habit turned to coffee work");
  }
}

function checkWordBudget(line: string, problems: string[]): void {
  const words = wordList(line);
  if (words.length > MAX_WORDS) {
    problems.push(`line holds ${words.length} words, above the ${MAX_WORDS}-word budget`);
  }
}

function validateLine(line: string): string[] {
  const problems: string[] = [];
  checkLength(line, problems);
  checkSingleLine(line, problems);
  checkNotBlank(line, problems);
  checkSpacing(line, problems);
  checkControlChars(line, problems);
  checkUtf8(line, problems);
  checkPlausibleReply(line, problems);
  checkSubject(line, problems);
  checkWordBudget(line, problems);
  return problems;
}

// ---------------------------------------------------------------------------
// Write and verify
// ---------------------------------------------------------------------------

function writeEntry(line: string): void {
  try { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); } catch (caughtFailure) {
    throw new Error(`cannot create ${OUTPUT_DIR}: ${(caughtFailure as Error).message}`);
  }
  try { fs.writeFileSync(OUTPUT_FILE, line, "utf8"); } catch (caughtFailure) {
    throw new Error(`cannot write ${OUTPUT_FILE}: ${(caughtFailure as Error).message}`);
  }
}

function verifyWritten(line: string): string {
  let readBack = "";
  try { readBack = fs.readFileSync(OUTPUT_FILE, "utf8"); } catch (caughtFailure) {
    throw new Error(`cannot read ${OUTPUT_FILE} back: ${(caughtFailure as Error).message}`);
  }
  if (readBack !== line) {
    throw new Error("read-back text differs from the line that was written");
  }
  const digest = sha256Hex(readBack);
  const fileBytes = fs.statSync(OUTPUT_FILE).size;
  if (fileBytes !== byteCount(line)) {
    throw new Error(`file holds ${fileBytes} bytes, line holds ${byteCount(line)}`);
  }
  return digest;
}

function report(line: string, digest: string): void {
  const words = wordList(line).length;
  console.log("status ok");
  console.log(`chars ${charCount(line)}`);
  console.log(`bytes ${byteCount(line)}`);
  console.log(`words ${words}`);
  console.log(`sha256 ${digest}`);
  console.log(`line ${line}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const line = buildLine();
  const problems = validateLine(line);
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`gate problem: ${problem}`);
    }
    process.exit(1);
  }
  writeEntry(line);
  const digest = verifyWritten(line);
  report(line, digest);
}

try { main(); } catch (caughtFailure) {
  console.error(`failed: ${(caughtFailure as Error).message}`);
  process.exit(1);
}
