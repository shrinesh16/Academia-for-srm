// Standalone scraper server — runs outside Next.js
const http = require("http");
const { chromium } = require("playwright");

const PORT = 3001;

// ──── Persistent Browser ────
let _browser = null;

async function getBrowser() {
  if (_browser?.isConnected()) return _browser;
  _browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu",
      "--disable-dev-shm-usage", "--disable-extensions", "--no-first-run",
      "--disable-background-networking", "--disable-default-apps",
    ],
  });
  _browser.on("disconnected", () => { _browser = null; });
  return _browser;
}

// ──── Login ────
async function loginToAcademia(page, netId, password) {
  const t0 = Date.now();
  console.log("[⚡] Navigating to Academia...");
  await page.goto("https://academia.srmist.edu.in/", { waitUntil: "domcontentloaded", timeout: 15000 });

  // Find Zoho login iframe
  let loginFrame = null;
  const d1 = Date.now() + 10000;
  while (!loginFrame && Date.now() < d1) {
    for (const f of page.frames()) {
      if (f.url().includes("signin") || f.url().includes("accounts.zoho")) { loginFrame = f; break; }
    }
    if (!loginFrame) await page.waitForTimeout(150);
  }
  if (!loginFrame) throw new Error("Could not find Zoho login portal. Academia might be down.");
  console.log(`[⚡] Login frame found: ${Date.now() - t0}ms`);

  // Email
  const emailInput = loginFrame.locator("input#login_id").first();
  await emailInput.waitFor({ state: "visible", timeout: 5000 });
  await emailInput.fill(netId);
  await loginFrame.locator("button#nextbtn").first().click();

  // Password
  const passInput = loginFrame.locator("input#password").first();
  await passInput.waitFor({ state: "visible", timeout: 8000 });
  await passInput.fill(password);
  await loginFrame.locator("button#nextbtn").first().click();
  console.log(`[⚡] Credentials submitted: ${Date.now() - t0}ms`);

  // ── Wait for auth to complete (up to 20s) ──
  // Check BOTH URL changes AND page body content
  const loginDeadline = Date.now() + 20000;
  let authComplete = false;
  while (Date.now() < loginDeadline && !authComplete) {
    const url = page.url();

    // Check URL patterns
    if (url.includes("block-sessions") || url.includes("preannouncement") ||
        url.includes("sessions-reminder") || url.includes("#WELCOME") ||
        url.includes("#Page:") || url.includes("portal/academia")) {
      authComplete = true;
      break;
    }

    // Also check if page body has portal content (Zoho Creator loaded)
    const bodyText = await page.innerText("body").catch(() => "");
    if (bodyText.includes("WELCOME") || bodyText.includes("My Attendance") ||
        bodyText.includes("Student Profile") || bodyText.includes("Academic Reports") ||
        bodyText.includes("Day Order")) {
      authComplete = true;
      console.log("[⚡] Portal content detected in body");
      break;
    }

    // Check for session limit text in body
    if (bodyText.includes("concurrent sessions") || bodyText.includes("Terminate All Sessions")) {
      authComplete = true;
      console.log("[⚡] Session limit detected in body");
      break;
    }

    await page.waitForTimeout(500);
  }

  const postLoginUrl = page.url();
  console.log(`[⚡] Post-auth URL: ${postLoginUrl} (${Date.now() - t0}ms)`);

  // ── Handle session limit pages ──
  const bodyText = await page.innerText("body").catch(() => "");

  if (postLoginUrl.includes("block-sessions") || bodyText.includes("Terminate All Sessions")) {
    console.log("[⚡] Session limit — clicking Terminate...");
    try {
      await page.click('text="Terminate All Sessions"', { timeout: 5000 });
      console.log("[⚡] Clicked! Waiting for redirect...");
      await page.waitForTimeout(8000);
    } catch (e) {
      console.log("[⚡] Terminate click failed:", e.message);
    }
  }

  if (page.url().includes("sessions-reminder") || page.url().includes("announcement/sessions")) {
    console.log("[⚡] Sessions reminder — navigating directly to portal...");
    await page.goto("https://academia.srmist.edu.in/#Page:My_Attendance", {
      waitUntil: "networkidle",
      timeout: 20000,
    });
    console.log(`[⚡] After nav: ${page.url()}`);
    return;
  }

  // Check for signin failure
  if (postLoginUrl.includes("signin") && !authComplete) {
    throw new Error("Invalid credentials or login failed.");
  }

  console.log(`[⚡] Login complete: ${page.url()} (${Date.now() - t0}ms)`);
}

// ──── Extract ALL table data in ONE JS call ────
async function extractAllTableData(frame) {
  return frame.evaluate(() => {
    const rows = [];
    document.querySelectorAll("table").forEach((table) => {
      table.querySelectorAll("tr").forEach((row) => {
        const cells = [];
        row.querySelectorAll("td, th").forEach((cell) => {
          cells.push(cell.innerText || "");
        });
        if (cells.length > 0 && cells.some((c) => c.trim())) rows.push(cells);
      });
    });
    return rows;
  });
}

// ──── Parse data ────
function parseAttendanceData(rawRows) {
  const student = {
    name: "Student", regNumber: "", program: "", department: "",
    specialization: "", semester: "", batch: "", feedbackStatus: "", enrollmentStatus: "",
  };
  const subjects = [];
  const marks = [];

  for (const row of rawRows) {
    if (row.length >= 2) {
      const key = row[0]?.trim();
      const val = row[1]?.trim();
      if (key === "Registration Number:") student.regNumber = val;
      else if (key === "Name:") student.name = val;
      else if (key === "Program:") student.program = val;
      else if (key === "Department:") student.department = val;
      else if (key === "Specialization:") student.specialization = val;
      else if (key === "Semester:") { student.semester = val; if (row.length >= 5) student.batch = row[4]?.trim(); }
      else if (key === "Feedback Status") student.feedbackStatus = row[2]?.trim() || val;
      else if (key === "Enrollment Status / DOE:") student.enrollmentStatus = val;
    }
  }

  let inAtt = false, inMarks = false;
  for (const row of rawRows) {
    if (row.length >= 7 && row[0] === "Course Code" && row[1] === "Course Title" && row[6] === "Attn %") {
      inAtt = true; inMarks = false; continue;
    }
    if (row.length >= 3 && row[0] === "Course Code" && row[1] === "Course Type" && row[2] === "Test Performance") {
      inAtt = false; inMarks = true; continue;
    }
    if (inAtt && row.length >= 7) {
      const code = (row[0] || "").split("\n")[0].trim();
      const title = row[1]?.trim() || "";
      const category = row[2]?.trim() || "";
      const faculty = row[3]?.trim() || "";
      const slot = row[4]?.trim() || "";
      const room = row[5]?.trim() || "";
      const attn = parseInt(row[6]?.trim() || "0", 10);
      if (code && title && !isNaN(attn)) subjects.push({ code, title, category, faculty, slot, room, percentage: attn });
    }
    if (inMarks && row.length >= 3) {
      const code = row[0]?.trim() || "";
      const courseType = row[1]?.trim() || "";
      if (!code || code.includes("/")) continue;
      const testEntries = [];
      for (let c = 3; c < row.length; c++) {
        const cell = row[c]?.trim();
        if (cell && cell.includes("/") && cell.includes("\n")) {
          const parts = cell.split("\n");
          const hp = parts[0].split("/");
          const testName = hp[0]?.trim() || "";
          const maxMarks = parseFloat(hp[1]?.trim() || "0");
          const scored = parseFloat(parts[1]?.trim() || "0");
          if (testName && !isNaN(maxMarks) && !isNaN(scored)) testEntries.push({ testName, maxMarks, scored });
        }
      }
      if (code && courseType) marks.push({ code, courseType, marks: testEntries });
    }
  }

  const totalAttn = subjects.reduce((sum, s) => sum + s.percentage, 0);
  const overall = subjects.length > 0 ? Math.round(totalAttn / subjects.length) : 0;
  return { student, attendance: { overall, subjects }, marks };
}

// ──── HTTP Server ────
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }
  if (req.method !== "POST" || req.url !== "/scrape") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found. POST to /scrape" }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const { netId, password } = JSON.parse(body);
    if (!netId || !password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "NetID and password are required." }));
      return;
    }

    const t0 = Date.now();
    console.log(`\n[⚡] ═══ Scrape: ${netId} ═══`);

    const browser = await getBrowser();
    console.log(`[⚡] Browser: ${Date.now() - t0}ms`);

    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

    // Block images/fonts only — keep stylesheets (Zoho Creator needs CSS)
    await context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "font", "media"].includes(type)) return route.abort();
      return route.continue();
    });

    const page = await context.newPage();

    try {
      // Step 1: Login (with proper session handling)
      await loginToAcademia(page, netId, password);
      console.log(`[⚡] Login done: ${Date.now() - t0}ms`);

      // Step 2: Navigate to attendance page
      console.log("[⚡] Going to My_Attendance...");
      await page.goto("https://academia.srmist.edu.in/#Page:My_Attendance", {
        waitUntil: "networkidle",
        timeout: 20000,
      });

      // Step 3: Wait for table data to appear (smart polling)
      const tableDeadline = Date.now() + 12000;
      let foundData = false;
      while (Date.now() < tableDeadline && !foundData) {
        // Check ALL frames for tables
        for (const f of page.frames()) {
          const rowCount = await f.evaluate(() => document.querySelectorAll("table tr").length).catch(() => 0);
          if (rowCount > 5) { foundData = true; break; }
        }
        if (!foundData) await page.waitForTimeout(200);
      }
      console.log(`[⚡] Tables found: ${foundData} at ${Date.now() - t0}ms`);

      // Step 4: Extract data from the frame that has tables
      let rawRows = [];
      for (const f of page.frames()) {
        const rows = await extractAllTableData(f).catch(() => []);
        if (rows.length > rawRows.length) rawRows = rows;
      }
      console.log(`[⚡] Extracted ${rawRows.length} rows at ${Date.now() - t0}ms`);

      // Step 5: Parse
      const { student, attendance, marks } = parseAttendanceData(rawRows);
      console.log(`[⚡] Parsed: ${student.name} | ${attendance.subjects.length} subjects | ${marks.length} marks`);

      // Schedule
      const schedule = [];
      const slotTimeMap = {
        A: "08:00 - 08:50 AM", B: "09:00 - 09:50 AM", C: "10:00 - 10:50 AM",
        D: "11:00 - 11:50 AM", E: "12:00 - 12:50 PM", F: "01:40 - 02:30 PM",
        G: "02:30 - 03:20 PM", LAB: "Varies",
      };
      for (const subj of attendance.subjects) {
        if (subj.category === "Theory") {
          schedule.push({ time: slotTimeMap[subj.slot] || subj.slot, name: subj.title, room: subj.room });
        }
      }

      await context.close();
      const totalMs = Date.now() - t0;
      console.log(`[⚡] ✅ Complete: ${totalMs}ms (~${Math.round(totalMs / 1000)}s)`);

      const result = {
        authenticated: true,
        scrapeTimeMs: totalMs,
        data: {
          student: {
            name: student.name, regNumber: student.regNumber,
            course: `${student.program} - ${student.specialization}`,
            department: student.department, semester: student.semester,
            batch: student.batch, feedbackStatus: student.feedbackStatus,
            enrollmentStatus: student.enrollmentStatus,
          },
          attendance: {
            overall: attendance.overall,
            subjects: attendance.subjects.map((s) => ({
              code: s.code, name: s.title, category: s.category,
              faculty: s.faculty, slot: s.slot, room: s.room, percentage: s.percentage,
            })),
          },
          marks: marks.map((m) => ({ code: m.code, courseType: m.courseType, tests: m.marks })),
          grades: marks.filter((m) => m.marks.length > 0).map((m) => {
            const total = m.marks.reduce((sum, t) => sum + t.scored, 0);
            const max = m.marks.reduce((sum, t) => sum + t.maxMarks, 0);
            const pct = max > 0 ? Math.round((total / max) * 100) : 0;
            return {
              subject: m.code, courseType: m.courseType,
              totalScored: parseFloat(total.toFixed(2)), totalMax: parseFloat(max.toFixed(2)),
              percentage: pct,
              grade: pct >= 90 ? "O" : pct >= 80 ? "A+" : pct >= 70 ? "A" : pct >= 60 ? "B+" : pct >= 50 ? "B" : "C",
            };
          }),
          schedule,
        },
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      await context.close();
      throw err;
    }
  } catch (err) {
    console.error("[⚡] ERROR:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message || "Scraping failed" }));
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Scraper server running on http://localhost:${PORT}/scrape\n`);
});
