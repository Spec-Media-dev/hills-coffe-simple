import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const base = process.env.QA_BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const errors = [];
const accessibilityErrors = [];
await mkdir("artifacts/qa", { recursive: true });

async function checkedPage(context, path) {
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${path}: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`${path}: ${error.message}`));
  const response = await page.goto(`${base}${path}`, {
    waitUntil: "networkidle",
  });
  if (!response?.ok())
    throw new Error(`${path} returned ${response?.status()}`);
  return page;
}

async function checkAccessibility(page, label) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  for (const violation of result.violations.filter(
    (item) => item.impact === "critical" || item.impact === "serious",
  )) {
    const nodes = violation.nodes
      .map((node) => `${node.target.join(" ")} ${node.failureSummary ?? ""}`)
      .join(" | ");
    accessibilityErrors.push(
      `${label}: ${violation.id} — ${violation.help}: ${nodes}`,
    );
  }
}

const desktop = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "light",
});
const home = await checkedPage(desktop, "/en");
await home.getByRole("heading", { name: "Green coffee, closer." }).waitFor();
await checkAccessibility(home, "English home");
await home.screenshot({
  path: "artifacts/qa/home-en-light.png",
  fullPage: true,
});
await home.getByRole("button", { name: "Toggle color theme" }).first().click();
await home.locator("html.dark").waitFor();
await home.screenshot({
  path: "artifacts/qa/home-en-dark.png",
  fullPage: false,
});

const catalog = await checkedPage(desktop, "/en/products?location=Egypt");
await catalog
  .getByRole("heading", { name: "Coffees ready for the work ahead." })
  .waitFor();
let catalogText = await catalog.locator("body").innerText();
if (catalogText.includes("USD "))
  throw new Error("Anonymous catalog leaked a protected price value.");
await catalog.getByRole("button", { name: /Hambela Bookkisa/ }).click();
catalogText = await catalog.locator("body").innerText();
if (!catalogText.includes("Sign in to view pricing"))
  throw new Error("Anonymous pricing prompt is missing.");
await catalog.getByRole("button", { name: /Filters/ }).click();
await checkAccessibility(catalog, "English catalog");
await catalog.screenshot({
  path: "artifacts/qa/catalog-en.png",
  fullPage: true,
});

const arabic = await checkedPage(desktop, "/ar");
if ((await arabic.locator("html").getAttribute("dir")) !== "rtl")
  throw new Error("Arabic document is not RTL.");
await arabic.getByRole("heading", { name: "قهوة خضراء، أقرب إليك." }).waitFor();
await checkAccessibility(arabic, "Arabic home");
await arabic.screenshot({
  path: "artifacts/qa/home-ar-rtl.png",
  fullPage: false,
});

const protectedAdmin = await checkedPage(desktop, "/en/admin");
if (!protectedAdmin.url().includes("/en/sign-in"))
  throw new Error("Anonymous admin access was not redirected server-side.");

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  colorScheme: "dark",
});
const mobilePage = await checkedPage(mobile, "/en/products");
await mobilePage.getByRole("button", { name: "Open menu" }).click();
await mobilePage.getByRole("navigation").last().waitFor();
await mobilePage.screenshot({
  path: "artifacts/qa/catalog-mobile-menu.png",
  fullPage: false,
});

await browser.close();
if (errors.length)
  throw new Error(`Browser console errors:\n${errors.join("\n")}`);
if (accessibilityErrors.length)
  throw new Error(
    `Accessibility violations:\n${accessibilityErrors.join("\n")}`,
  );
console.log(
  "Visual QA passed: EN light/dark, AR RTL, anonymous pricing, admin protection, filters, accessibility, and mobile menu.",
);
