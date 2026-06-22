const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`PAGE: ${e.message}\n${e.stack}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`CONSOLE: ${m.text()}`);
  });

  for (const path of ["/login", "/dashboard", "/"]) {
    errors.length = 0;
    await page.goto(`https://nova-gestion-eight.vercel.app${path}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    const bodyText = await page.locator("body").innerText().catch(() => "");
    console.log(`\n=== ${path} => ${page.url()} ===`);
    console.log("Application error?", bodyText.includes("Application error"));
    if (errors.length) console.log("ERRORS:\n", errors.join("\n"));
    else console.log("No JS errors detected");
  }

  // Login flow
  await page.goto("https://nova-gestion-eight.vercel.app/login");
  await page.fill('input[name="email"]', "onboarding@resend.dev");
  await page.fill('input[name="password"]', "HilaYael12062025!");
  errors.length = 0;
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  console.log(`\n=== After login => ${page.url()} ===`);
  const bodyText = await page.locator("body").innerText().catch(() => "");
  console.log("Application error?", bodyText.includes("Application error"));
  if (errors.length) console.log("ERRORS:\n", errors.join("\n"));

  await browser.close();
})();
