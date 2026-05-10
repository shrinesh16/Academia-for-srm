const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// ========== CONFIGURATION ==========
const CONFIG = {
  email: "sm8149@srmist.edu.in",
  password: "Parotta#17",
  headless: false, // Set to true for CI/API usage
  outputDir: path.join(__dirname, "scraped_data"),
  timeouts: {
    navigation: 30000,
    login: 8000,
    pageLoad: 10000,
  },
};

// ========== HELPERS ==========
function ensureOutputDir() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
}

function saveData(filename, data) {
  const filepath = path.join(CONFIG.outputDir, filename);
  fs.writeFileSync(filepath, typeof data === "string" ? data : JSON.stringify(data, null, 2));
  console.log(`  → Saved: ${filepath}`);
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

// ========== MAIN SCRAPER ==========
async function scrapeAcademia() {
  ensureOutputDir();
  log("Starting SRM Academia scraper...");

  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    // ──────── STEP 1: Navigate to Academia ────────
    log("Step 1: Navigating to Academia...");
    await page.goto("https://academia.srmist.edu.in/", {
      waitUntil: "networkidle",
      timeout: CONFIG.timeouts.navigation,
    });
    await page.waitForTimeout(3000);

    // Save initial page state
    await page.screenshot({ path: path.join(CONFIG.outputDir, "01_initial_page.png"), fullPage: true });
    log("  Screenshot saved: 01_initial_page.png");

    // List all frames
    const frames = page.frames();
    log(`  Found ${frames.length} frames:`);
    frames.forEach((f, i) => log(`    [${i}] ${f.url()}`));

    // ──────── STEP 2: Find Login Iframe ────────
    log("Step 2: Looking for login iframe...");
    let loginFrame = null;
    for (const frame of page.frames()) {
      const url = frame.url();
      if (url.includes("accounts.zoho") || url.includes("signin") || url.includes("login")) {
        loginFrame = frame;
        log(`  Found login frame: ${url}`);
        break;
      }
    }

    if (!loginFrame) {
      // Maybe it's not in an iframe, check the main page
      log("  No login iframe found, checking main page...");
      const mainPageHTML = await page.content();
      saveData("01_main_page.html", mainPageHTML);

      // Try to find login form in main page
      const loginForm = await page.locator("input[name='login_id'], input[id='login_id'], input[type='email']").count();
      if (loginForm > 0) {
        loginFrame = page;
        log("  Login form found on main page.");
      } else {
        log("  ERROR: Cannot find any login form. Dumping page content...");
        saveData("error_page.html", mainPageHTML);
        await browser.close();
        return;
      }
    }

    // ──────── STEP 3: Fill Login Credentials ────────
    log("Step 3: Entering credentials...");

    // Try multiple selectors for email input
    const emailSelectors = [
      "input[name='login_id']",
      "input[id='login_id']",
      "input[type='email']",
      "input[placeholder*='email']",
      "input[placeholder*='Email']",
    ];

    let emailInput = null;
    for (const sel of emailSelectors) {
      try {
        const el = loginFrame.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          emailInput = el;
          log(`  Found email input: ${sel}`);
          break;
        }
      } catch (e) {}
    }

    if (!emailInput) {
      log("  ERROR: Could not find email input field.");
      const frameHTML = await loginFrame.content().catch(() => "");
      saveData("error_login_frame.html", frameHTML);
      await browser.close();
      return;
    }

    await emailInput.fill(CONFIG.email);
    log(`  Filled email: ${CONFIG.email}`);

    // Click "Next" button
    const nextBtnSelectors = [
      "button#nextbtn",
      "button#login_btn",
      "button:has-text('Next')",
      "button:has-text('Sign In')",
      "input[type='submit']",
    ];

    for (const sel of nextBtnSelectors) {
      try {
        const btn = loginFrame.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 })) {
          await btn.click();
          log(`  Clicked next button: ${sel}`);
          break;
        }
      } catch (e) {}
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(CONFIG.outputDir, "02_after_email.png"), fullPage: true });

    // Fill password
    const passSelectors = [
      "input[name='password']",
      "input[id='password']",
      "input[type='password']",
    ];

    let passInput = null;
    for (const sel of passSelectors) {
      try {
        const el = loginFrame.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          passInput = el;
          log(`  Found password input: ${sel}`);
          break;
        }
      } catch (e) {}
    }

    if (passInput) {
      await passInput.fill(CONFIG.password);
      log("  Password filled.");
    } else {
      log("  WARNING: Could not find password field.");
    }

    // Click sign-in/next button again
    for (const sel of nextBtnSelectors) {
      try {
        const btn = loginFrame.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 })) {
          await btn.click();
          log(`  Clicked login button: ${sel}`);
          break;
        }
      } catch (e) {}
    }

    log("  Waiting for login to complete...");
    await page.waitForTimeout(CONFIG.timeouts.login);
    await page.screenshot({ path: path.join(CONFIG.outputDir, "03_after_login.png"), fullPage: true });
    log(`  Current URL: ${page.url()}`);

    // ──────── STEP 4: Handle Session Limit ────────
    log("Step 4: Checking for session limit dialog...");

    // Check main page
    const topText = await page.innerText("body").catch(() => "");
    if (
      topText.toLowerCase().includes("active sessions") ||
      topText.toLowerCase().includes("session limit") ||
      topText.toLowerCase().includes("terminate")
    ) {
      log("  Session limit detected on main page!");
      const sessionBtns = [
        "button:has-text('Terminate All Sessions')",
        "button:has-text('Skip')",
        "button:has-text('Continue')",
        "#continue_button",
      ];
      for (const sel of sessionBtns) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 1000 })) {
            await btn.click();
            log(`  Clicked: ${sel}`);
            await page.waitForTimeout(3000);
            break;
          }
        } catch (e) {}
      }
    }

    // Also check all iframes
    for (const frame of page.frames()) {
      try {
        const frameText = await frame.innerText("body").catch(() => "");
        if (
          frameText.toLowerCase().includes("active sessions") ||
          frameText.toLowerCase().includes("session limit") ||
          frameText.toLowerCase().includes("terminate")
        ) {
          log(`  Session limit detected in iframe: ${frame.url()}`);
          const sessionBtns = [
            "#continue_button",
            "div.btn:has-text('Terminate All Sessions')",
            "button:has-text('Terminate')",
            "button:has-text('Skip')",
            ".btn:has-text('Continue')",
          ];
          for (const sel of sessionBtns) {
            try {
              const btn = frame.locator(sel).first();
              if (await btn.isVisible({ timeout: 1000 })) {
                await btn.click();
                log(`  Clicked in iframe: ${sel}`);
                await page.waitForTimeout(3000);
                break;
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }

    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(CONFIG.outputDir, "04_post_session.png"), fullPage: true });
    log(`  URL after session handling: ${page.url()}`);

    // ──────── STEP 5: Check if we're logged in ────────
    log("Step 5: Verifying login success...");
    const currentUrl = page.url();

    if (currentUrl.includes("signin") || currentUrl.includes("login")) {
      log("  ERROR: Still on login page. Credentials may be wrong.");
      // Dump error info
      const errorHTML = await page.content();
      saveData("error_still_login.html", errorHTML);
      await browser.close();
      return;
    }

    log("  ✅ Login appears successful!");

    // ──────── STEP 6: Explore Dashboard / Home ────────
    log("Step 6: Exploring dashboard...");

    // Dump all frames and their content
    const allFrames = page.frames();
    log(`  Total frames: ${allFrames.length}`);
    for (let i = 0; i < allFrames.length; i++) {
      const f = allFrames[i];
      const fUrl = f.url();
      log(`  Frame [${i}]: ${fUrl}`);
      try {
        const fText = await f.innerText("body").catch(() => "");
        if (fText.length > 10) {
          saveData(`frame_${i}_text.txt`, fText.substring(0, 5000));
        }
        const fHTML = await f.content().catch(() => "");
        if (fHTML.length > 100) {
          saveData(`frame_${i}.html`, fHTML.substring(0, 50000));
        }
      } catch (e) {}
    }

    // Save main page
    const dashHTML = await page.content();
    saveData("05_dashboard.html", dashHTML);

    // ──────── STEP 7: Navigate to Attendance Page ────────
    log("Step 7: Navigating to Attendance...");

    // SRM Academia typically uses hash-based navigation
    const attendanceUrls = [
      "https://academia.srmist.edu.in/#Page:My_Attendance",
      "https://academia.srmist.edu.in/lms/student/attendance",
      "https://academia.srmist.edu.in/#attendance",
    ];

    // Try clicking the attendance menu item first
    const attendanceClickSelectors = [
      "a:has-text('Attendance')",
      "span:has-text('Attendance')",
      "div:has-text('My Attendance')",
      "[data-zcqa*='attendance']",
      "li:has-text('Attendance')",
    ];

    let navigatedToAttendance = false;

    // Try clicking in all frames
    for (const frame of page.frames()) {
      for (const sel of attendanceClickSelectors) {
        try {
          const el = frame.locator(sel).first();
          if (await el.isVisible({ timeout: 1500 })) {
            await el.click();
            log(`  Clicked attendance link: ${sel} in frame ${frame.url()}`);
            navigatedToAttendance = true;
            await page.waitForTimeout(5000);
            break;
          }
        } catch (e) {}
      }
      if (navigatedToAttendance) break;
    }

    if (!navigatedToAttendance) {
      // Try direct URL navigation
      for (const url of attendanceUrls) {
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
          log(`  Navigated to: ${url}`);
          navigatedToAttendance = true;
          await page.waitForTimeout(5000);
          break;
        } catch (e) {
          log(`  Failed to navigate to: ${url}`);
        }
      }
    }

    await page.screenshot({ path: path.join(CONFIG.outputDir, "06_attendance.png"), fullPage: true });

    // Dump attendance page content from all frames
    for (let i = 0; i < page.frames().length; i++) {
      const f = page.frames()[i];
      try {
        const text = await f.innerText("body").catch(() => "");
        if (text.length > 50) {
          saveData(`attendance_frame_${i}_text.txt`, text.substring(0, 10000));
        }
        const html = await f.content().catch(() => "");
        if (html.length > 100) {
          saveData(`attendance_frame_${i}.html`, html.substring(0, 50000));
        }
      } catch (e) {}
    }

    // ──────── STEP 8: Try to extract attendance data ────────
    log("Step 8: Extracting attendance data...");

    let attendanceData = [];
    for (const frame of page.frames()) {
      try {
        // Look for table rows with attendance data
        const rows = await frame.locator("table tr, .attendance-row, [class*='attend']").all();
        if (rows.length > 0) {
          log(`  Found ${rows.length} attendance rows in frame`);
          for (const row of rows) {
            const text = await row.innerText().catch(() => "");
            if (text.trim()) {
              attendanceData.push(text.trim());
            }
          }
        }

        // Also try extracting from specific SRM-style elements
        const subjects = await frame.locator(".course-name, .subject-name, td:nth-child(2), .courseName").all();
        const percentages = await frame.locator(".attendance-percentage, .percentage, td:nth-child(5), .percent").all();

        if (subjects.length > 0) {
          log(`  Found ${subjects.length} subject elements`);
        }
      } catch (e) {}
    }

    if (attendanceData.length > 0) {
      saveData("attendance_extracted.json", attendanceData);
      log(`  Extracted ${attendanceData.length} attendance entries`);
    } else {
      log("  No structured attendance data found via selectors.");
    }

    // ──────── STEP 9: Navigate to Marks/Grades Page ────────
    log("Step 9: Navigating to Marks/Grades...");

    const marksClickSelectors = [
      "a:has-text('Marks')",
      "span:has-text('Marks')",
      "a:has-text('Grade')",
      "span:has-text('Grade')",
      "div:has-text('My Marks')",
      "[data-zcqa*='marks']",
      "li:has-text('Marks')",
    ];

    let navigatedToMarks = false;
    for (const frame of page.frames()) {
      for (const sel of marksClickSelectors) {
        try {
          const el = frame.locator(sel).first();
          if (await el.isVisible({ timeout: 1500 })) {
            await el.click();
            log(`  Clicked marks link: ${sel}`);
            navigatedToMarks = true;
            await page.waitForTimeout(5000);
            break;
          }
        } catch (e) {}
      }
      if (navigatedToMarks) break;
    }

    if (!navigatedToMarks) {
      const marksUrls = [
        "https://academia.srmist.edu.in/#Page:My_Marks",
        "https://academia.srmist.edu.in/lms/student/marks",
      ];
      for (const url of marksUrls) {
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
          log(`  Navigated to: ${url}`);
          await page.waitForTimeout(5000);
          break;
        } catch (e) {}
      }
    }

    await page.screenshot({ path: path.join(CONFIG.outputDir, "07_marks.png"), fullPage: true });

    // Dump marks page content
    for (let i = 0; i < page.frames().length; i++) {
      const f = page.frames()[i];
      try {
        const text = await f.innerText("body").catch(() => "");
        if (text.length > 50) {
          saveData(`marks_frame_${i}_text.txt`, text.substring(0, 10000));
        }
      } catch (e) {}
    }

    // ──────── STEP 10: Navigate to Timetable/Schedule ────────
    log("Step 10: Navigating to Timetable...");

    const scheduleClickSelectors = [
      "a:has-text('Timetable')",
      "a:has-text('Time Table')",
      "span:has-text('Timetable')",
      "span:has-text('Time Table')",
      "div:has-text('My Timetable')",
      "[data-zcqa*='timetable']",
      "li:has-text('Timetable')",
    ];

    for (const frame of page.frames()) {
      for (const sel of scheduleClickSelectors) {
        try {
          const el = frame.locator(sel).first();
          if (await el.isVisible({ timeout: 1500 })) {
            await el.click();
            log(`  Clicked timetable link: ${sel}`);
            await page.waitForTimeout(5000);
            break;
          }
        } catch (e) {}
      }
    }

    await page.screenshot({ path: path.join(CONFIG.outputDir, "08_timetable.png"), fullPage: true });

    // Dump timetable content
    for (let i = 0; i < page.frames().length; i++) {
      const f = page.frames()[i];
      try {
        const text = await f.innerText("body").catch(() => "");
        if (text.length > 50) {
          saveData(`timetable_frame_${i}_text.txt`, text.substring(0, 10000));
        }
      } catch (e) {}
    }

    // ──────── STEP 11: Capture Network/API calls for future reference ────────
    log("Step 11: Capturing cookies and session info...");
    const cookies = await context.cookies();
    saveData("cookies.json", cookies);

    // ──────── SUMMARY ────────
    log("\n========== SCRAPING COMPLETE ==========");
    log(`All data saved to: ${CONFIG.outputDir}`);
    log("Files created:");
    const files = fs.readdirSync(CONFIG.outputDir);
    files.forEach((f) => log(`  📄 ${f}`));

  } catch (error) {
    log(`FATAL ERROR: ${error.message}`);
    console.error(error);
    await page.screenshot({ path: path.join(CONFIG.outputDir, "error_screenshot.png") }).catch(() => {});
    const errorHTML = await page.content().catch(() => "");
    saveData("error_page.html", errorHTML);
  } finally {
    // Keep browser open for 10 seconds for manual inspection if headed
    if (!CONFIG.headless) {
      log("Browser will remain open for 10 seconds for inspection...");
      await page.waitForTimeout(10000);
    }
    await browser.close();
    log("Browser closed.");
  }
}

scrapeAcademia();
