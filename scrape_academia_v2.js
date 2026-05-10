const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// ========== CONFIG ==========
const CONFIG = {
  email: "sm8149@srmist.edu.in",
  password: "Parotta#17",
  headless: false,
  outputDir: path.join(__dirname, "scraped_data_v2"),
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function save(filename, data) {
  const fp = path.join(CONFIG.outputDir, filename);
  fs.writeFileSync(fp, typeof data === "string" ? data : JSON.stringify(data, null, 2));
  console.log(`  💾 ${filename}`);
}
function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function login(page) {
  log("Navigating to Academia...");
  await page.goto("https://academia.srmist.edu.in/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Find login iframe
  let loginFrame = null;
  for (const frame of page.frames()) {
    if (frame.url().includes("signin") || frame.url().includes("accounts.zoho")) {
      loginFrame = frame;
      break;
    }
  }
  if (!loginFrame) throw new Error("Login iframe not found");

  // Email
  const emailInput = loginFrame.locator("input[id='login_id']").first();
  await emailInput.waitFor({ state: "visible", timeout: 5000 });
  await emailInput.fill(CONFIG.email);
  
  const nextBtn = loginFrame.locator("button#nextbtn").first();
  await nextBtn.click();
  await page.waitForTimeout(2000);

  // Password
  const passInput = loginFrame.locator("input[id='password']").first();
  await passInput.waitFor({ state: "visible", timeout: 5000 });
  await passInput.fill(CONFIG.password);
  await nextBtn.click();
  
  log("Waiting for login...");
  await page.waitForTimeout(8000);

  // Handle session limit
  const bodyText = await page.innerText("body").catch(() => "");
  if (bodyText.toLowerCase().includes("session") || bodyText.toLowerCase().includes("terminate")) {
    log("Handling session limit...");
    const continueBtn = page.locator("#continue_button").first();
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  // Verify login
  await page.waitForURL(/.*#WELCOME.*|.*portal.*/, { timeout: 15000 }).catch(() => {});
  const url = page.url();
  log(`Logged in. URL: ${url}`);
  
  if (url.includes("signin") || url.includes("login")) {
    throw new Error("Login failed - still on login page");
  }
  
  return page;
}

async function clickNavTab(page, tabName) {
  log(`Clicking nav tab: "${tabName}"...`);
  
  // The SRM portal uses a Zoho Creator app with tabs in the header
  // Try clicking by visible text in the header area
  const selectors = [
    `text="${tabName}"`,
    `a:has-text("${tabName}")`,
    `span:has-text("${tabName}")`,
    `div:has-text("${tabName}")`,
    `li:has-text("${tabName}")`,
  ];
  
  for (const sel of selectors) {
    try {
      // Search in all frames
      for (const frame of page.frames()) {
        const el = frame.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.click();
          log(`  Clicked: ${sel}`);
          await page.waitForTimeout(5000); // Wait for Zoho Creator to load the page content
          return true;
        }
      }
    } catch (e) {}
  }
  
  log(`  ⚠️ Could not find tab: ${tabName}`);
  return false;
}

async function clickSubMenuItem(page, menuText, subItemText) {
  log(`Hovering nav tab "${menuText}" and clicking "${subItemText}"...`);
  
  // First, hover over the parent menu to reveal dropdown
  for (const frame of page.frames()) {
    try {
      const menuEl = frame.locator(`text="${menuText}"`).first();
      if (await menuEl.isVisible({ timeout: 2000 }).catch(() => false)) {
        await menuEl.hover();
        await page.waitForTimeout(1000);
        
        // Now click the sub-item
        const subEl = frame.locator(`text="${subItemText}"`).first();
        if (await subEl.isVisible({ timeout: 2000 }).catch(() => false)) {
          await subEl.click();
          log(`  Clicked sub-item: ${subItemText}`);
          await page.waitForTimeout(5000);
          return true;
        }
      }
    } catch (e) {}
  }
  
  return false;
}

async function capturePageData(page, pageName) {
  log(`Capturing data for: ${pageName}`);
  
  // Screenshot
  await page.screenshot({ 
    path: path.join(CONFIG.outputDir, `${pageName}_screenshot.png`), 
    fullPage: true 
  });
  
  const result = {
    pageName,
    url: page.url(),
    frames: [],
  };
  
  // Capture content from ALL frames
  const frames = page.frames();
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    try {
      const text = await frame.innerText("body").catch(() => "");
      const html = await frame.content().catch(() => "");
      
      if (text.length > 20) {
        save(`${pageName}_frame_${i}_text.txt`, text);
        save(`${pageName}_frame_${i}.html`, html.substring(0, 100000));
        
        result.frames.push({
          index: i,
          url: frame.url(),
          textLength: text.length,
          htmlLength: html.length,
        });
      }
    } catch (e) {}
  }
  
  // Try to extract tabular data
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    try {
      // Look for tables
      const tables = await frame.locator("table").all();
      if (tables.length > 0) {
        log(`  Found ${tables.length} tables in frame ${i}`);
        for (let t = 0; t < tables.length; t++) {
          const tableHTML = await tables[t].innerHTML().catch(() => "");
          if (tableHTML.length > 50) {
            save(`${pageName}_table_${i}_${t}.html`, tableHTML);
          }
          
          // Extract rows
          const rows = await tables[t].locator("tr").all();
          const tableData = [];
          for (const row of rows) {
            const cells = await row.locator("td, th").all();
            const rowData = [];
            for (const cell of cells) {
              rowData.push(await cell.innerText().catch(() => ""));
            }
            if (rowData.length > 0) tableData.push(rowData);
          }
          if (tableData.length > 0) {
            save(`${pageName}_table_${i}_${t}_data.json`, tableData);
            log(`    Table ${t}: ${tableData.length} rows × ${tableData[0].length} cols`);
          }
        }
      }
      
      // Look for Zoho Creator list views / record views
      const listViews = await frame.locator(".listViewRow, .recordRow, .zc-record-row, .cp-livedata-row, [class*='listRow'], [class*='record-row']").all();
      if (listViews.length > 0) {
        log(`  Found ${listViews.length} list view rows in frame ${i}`);
        const listData = [];
        for (const row of listViews) {
          listData.push(await row.innerText().catch(() => ""));
        }
        save(`${pageName}_listview_${i}.json`, listData);
      }
      
    } catch (e) {}
  }
  
  return result;
}

async function interceptNetworkRequests(page) {
  const apiCalls = [];
  
  page.on("response", async (response) => {
    const url = response.url();
    // Capture Zoho Creator API calls (these contain the actual data)
    if (
      url.includes("/api/") || 
      url.includes("/report/") || 
      url.includes("getRecords") || 
      url.includes("loadReport") ||
      url.includes("getData") ||
      url.includes("fetchData") ||
      url.includes("attendance") ||
      url.includes("marks") ||
      url.includes("timetable") ||
      url.includes("student")
    ) {
      try {
        const body = await response.text().catch(() => "");
        if (body.length > 10) {
          apiCalls.push({
            url,
            status: response.status(),
            bodyLength: body.length,
            body: body.substring(0, 20000),
          });
          log(`  🌐 API: ${url.substring(0, 120)} [${response.status()}] ${body.length} bytes`);
        }
      } catch (e) {}
    }
  });
  
  return apiCalls;
}

// ========== MAIN ==========
async function main() {
  ensureDir(CONFIG.outputDir);
  log("=== SRM Academia Scraper v2 ===\n");
  
  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  
  // Set up network interception
  const apiCalls = await interceptNetworkRequests(page);
  
  try {
    // ── LOGIN ──
    await login(page);
    await page.waitForTimeout(3000);
    
    // ── CAPTURE WELCOME/DASHBOARD ──
    const welcomeData = await capturePageData(page, "01_welcome");
    
    // ── STUDENT PROFILE ──
    log("\n── STUDENT PROFILE ──");
    if (await clickNavTab(page, "Student Profile")) {
      await page.waitForTimeout(5000); // Extra wait for Zoho content to load
      await capturePageData(page, "02_student_profile");
    }
    
    // ── ACADEMIC REPORTS (this likely contains attendance + marks) ──
    log("\n── ACADEMIC REPORTS ──");
    if (await clickNavTab(page, "Academic Reports")) {
      await page.waitForTimeout(5000);
      await capturePageData(page, "03_academic_reports");
      
      // Academic Reports might have sub-pages or reports within it
      // Look for attendance-related links/buttons inside
      for (const frame of page.frames()) {
        try {
          const attendanceLinks = await frame.locator("text=Attendance, text=attendance, a:has-text('Attendance')").all();
          if (attendanceLinks.length > 0) {
            log(`  Found ${attendanceLinks.length} attendance-related links`);
            await attendanceLinks[0].click();
            await page.waitForTimeout(5000);
            await capturePageData(page, "03b_attendance_detail");
          }
        } catch (e) {}
        
        try {
          const marksLinks = await frame.locator("text=Marks, text=Internal, a:has-text('Marks')").all();
          if (marksLinks.length > 0) {
            log(`  Found ${marksLinks.length} marks-related links`);
            await marksLinks[0].click();
            await page.waitForTimeout(5000);
            await capturePageData(page, "03c_marks_detail");
          }
        } catch (e) {}
      }
    }
    
    // ── UNIFIED TIME TABLE ──
    log("\n── UNIFIED TIME TABLE ──");
    // This has sub-items, need to hover first
    const ttClicked = await clickSubMenuItem(page, "Unified Time Table", "Unified Time Table 2025");
    if (!ttClicked) {
      // Try clicking the main tab first
      if (await clickNavTab(page, "Unified Time Table")) {
        await page.waitForTimeout(3000);
        
        // Then try to click a sub-item
        for (const frame of page.frames()) {
          try {
            const subItems = await frame.locator("text=Unified Time Table 2025").all();
            if (subItems.length > 0) {
              await subItems[0].click();
              await page.waitForTimeout(5000);
            }
          } catch (e) {}
        }
      }
    }
    await capturePageData(page, "04_timetable");
    
    // ── FACULTY AND STUDENT ──
    log("\n── FACULTY AND STUDENT ──");
    if (await clickNavTab(page, "Faculty and Student")) {
      await page.waitForTimeout(5000);
      await capturePageData(page, "05_faculty_student");
    }
    
    // ── TRY DIRECT HASH URLS (SRM uses Zoho Creator page hashes) ──
    log("\n── TRYING DIRECT PAGE URLS ──");
    const directPages = [
      { hash: "#Page:My_Attendance", name: "06_direct_attendance" },
      { hash: "#Page:My_Time_Table", name: "07_direct_timetable" },
      { hash: "#Page:Student_Profile", name: "08_direct_profile" },
      { hash: "#Report:My_Attendance", name: "09_report_attendance" },
      { hash: "#Report:Marks", name: "10_report_marks" },
      { hash: "#Page:Attendance", name: "11_page_attendance" },
      { hash: "#Page:Internal_Marks", name: "12_page_internal_marks" },
    ];
    
    for (const dp of directPages) {
      try {
        log(`  Trying: ${dp.hash}`);
        await page.goto(`https://academia.srmist.edu.in/${dp.hash}`, { 
          waitUntil: "networkidle", 
          timeout: 15000 
        });
        await page.waitForTimeout(4000);
        
        const bodyText = await page.innerText("body").catch(() => "");
        if (!bodyText.includes("Page not found")) {
          log(`  ✅ Found valid page: ${dp.hash}`);
          await capturePageData(page, dp.name);
        } else {
          log(`  ❌ Page not found: ${dp.hash}`);
        }
      } catch (e) {
        log(`  ⚠️ Error loading ${dp.hash}: ${e.message}`);
      }
    }
    
    // ── SAVE API CALLS ──
    if (apiCalls.length > 0) {
      save("network_api_calls.json", apiCalls);
      log(`\n📡 Captured ${apiCalls.length} API calls`);
    }
    
    // ── SAVE COOKIES ──
    const cookies = await context.cookies();
    save("cookies.json", cookies);
    
    // ── SUMMARY ──
    log("\n========== SCRAPING COMPLETE ==========");
    const files = fs.readdirSync(CONFIG.outputDir);
    log(`Total files: ${files.length}`);
    files.forEach(f => log(`  📄 ${f}`));
    
  } catch (error) {
    log(`FATAL ERROR: ${error.message}`);
    console.error(error);
    await page.screenshot({ path: path.join(CONFIG.outputDir, "error.png") }).catch(() => {});
  } finally {
    if (!CONFIG.headless) {
      log("Browser open for 10s inspection...");
      await page.waitForTimeout(10000);
    }
    await browser.close();
    log("Done.");
  }
}

main();
