import { NextResponse } from "next/server";
import { chromium, Page, Frame } from "playwright";

// ──── Types ────
interface AttendanceSubject {
  code: string;
  title: string;
  category: string;
  faculty: string;
  slot: string;
  room: string;
  percentage: number;
}

interface MarkEntry {
  testName: string;
  maxMarks: number;
  scored: number;
}

interface SubjectMarks {
  code: string;
  courseType: string;
  marks: MarkEntry[];
}

interface StudentProfile {
  name: string;
  regNumber: string;
  program: string;
  department: string;
  specialization: string;
  semester: string;
  batch: string;
  feedbackStatus: string;
  enrollmentStatus: string;
}

interface ScrapedData {
  student: StudentProfile;
  attendance: {
    overall: number;
    subjects: AttendanceSubject[];
  };
  marks: SubjectMarks[];
  schedule: { time: string; name: string; room: string }[];
}

// ──── Login Helper ────
async function loginToAcademia(page: Page, netId: string, password: string): Promise<void> {
  console.log("Navigating to Academia...");
  await page.goto("https://academia.srmist.edu.in/", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  // Find the Zoho login iframe
  let loginFrame: Frame | null = null;
  for (const frame of page.frames()) {
    const url = frame.url();
    if (url.includes("signin") || url.includes("accounts.zoho")) {
      loginFrame = frame;
      break;
    }
  }

  if (!loginFrame) {
    throw new Error("Could not find the Zoho login portal. Academia might be down.");
  }

  // Enter email
  const emailInput = loginFrame.locator("input[id='login_id']").first();
  await emailInput.waitFor({ state: "visible", timeout: 5000 });
  await emailInput.fill(netId);

  // Click Next
  const nextBtn = loginFrame.locator("button#nextbtn").first();
  await nextBtn.click();
  await page.waitForTimeout(2000);

  // Enter password
  const passInput = loginFrame.locator("input[id='password']").first();
  await passInput.waitFor({ state: "visible", timeout: 5000 });
  await passInput.fill(password);

  // Click Sign In
  await nextBtn.click();
  console.log("Credentials submitted, waiting for authentication...");
  await page.waitForTimeout(8000);

  // Handle session limit (Zoho "Terminate All Sessions" dialog)
  const bodyText = await page.innerText("body").catch(() => "");
  if (
    bodyText.toLowerCase().includes("active sessions") ||
    bodyText.toLowerCase().includes("session limit") ||
    bodyText.toLowerCase().includes("terminate")
  ) {
    console.log("Session limit detected, terminating old sessions...");
    const continueBtn = page.locator("#continue_button").first();
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  // Also check iframes for session limit
  for (const frame of page.frames()) {
    try {
      const frameText = await frame.innerText("body").catch(() => "");
      if (frameText.toLowerCase().includes("terminate all sessions")) {
        const btn = frame
          .locator("#continue_button, div.btn:has-text('Terminate All Sessions')")
          .first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(5000);
        }
      }
    } catch (_e) {}
  }

  // Wait for redirect to dashboard
  await page.waitForTimeout(3000);
  const currentUrl = page.url();
  console.log("Post-login URL:", currentUrl);

  // Verify we're past login
  if (currentUrl.includes("signin") && !currentUrl.includes("sessions-reminder")) {
    throw new Error("Invalid credentials or login failed.");
  }
}

// ──── Parse Attendance + Profile from #Page:My_Attendance ────
function parseAttendanceData(rawRows: string[][]): {
  student: StudentProfile;
  attendance: { overall: number; subjects: AttendanceSubject[] };
  marks: SubjectMarks[];
} {
  const student: StudentProfile = {
    name: "Student",
    regNumber: "",
    program: "",
    department: "",
    specialization: "",
    semester: "",
    batch: "",
    feedbackStatus: "",
    enrollmentStatus: "",
  };

  const subjects: AttendanceSubject[] = [];
  const marks: SubjectMarks[] = [];

  // Parse student profile from key-value rows
  for (const row of rawRows) {
    if (row.length >= 2) {
      const key = row[0]?.trim();
      const val = row[1]?.trim();

      if (key === "Registration Number:") student.regNumber = val;
      else if (key === "Name:") student.name = val;
      else if (key === "Program:") student.program = val;
      else if (key === "Department:") student.department = val;
      else if (key === "Specialization:") student.specialization = val;
      else if (key === "Semester:") {
        student.semester = val;
        if (row.length >= 5) student.batch = row[4]?.trim();
      } else if (key === "Feedback Status") {
        student.feedbackStatus = row[2]?.trim() || val;
      } else if (key === "Enrollment Status / DOE:") {
        student.enrollmentStatus = val;
      }
    }
  }

  // Parse attendance table rows (7 columns: Code, Title, Category, Faculty, Slot, Room, Attn%)
  // Skip header row
  let inAttendance = false;
  let inMarks = false;

  for (const row of rawRows) {
    // Detect attendance header
    if (
      row.length >= 7 &&
      row[0] === "Course Code" &&
      row[1] === "Course Title" &&
      row[6] === "Attn %"
    ) {
      inAttendance = true;
      inMarks = false;
      continue;
    }

    // Detect marks header
    if (
      row.length >= 3 &&
      row[0] === "Course Code" &&
      row[1] === "Course Type" &&
      row[2] === "Test Performance"
    ) {
      inAttendance = false;
      inMarks = true;
      continue;
    }

    // Parse attendance data rows
    if (inAttendance && row.length >= 7) {
      const codeRaw = row[0] || "";
      const code = codeRaw.split("\n")[0].trim(); // Remove "Regular" suffix
      const title = row[1]?.trim() || "";
      const category = row[2]?.trim() || "";
      const faculty = row[3]?.trim() || "";
      const slot = row[4]?.trim() || "";
      const room = row[5]?.trim() || "";
      const attn = parseInt(row[6]?.trim() || "0", 10);

      if (code && title && !isNaN(attn)) {
        subjects.push({
          code,
          title,
          category,
          faculty,
          slot,
          room,
          percentage: attn,
        });
      }
    }

    // Parse marks data rows
    if (inMarks && row.length >= 3) {
      const code = row[0]?.trim() || "";
      const courseType = row[1]?.trim() || "";

      // Skip duplicate sub-rows (rows that only have test scores without code)
      if (!code || code.includes("/")) continue;

      // Parse test performance from remaining columns
      const testEntries: MarkEntry[] = [];
      for (let c = 3; c < row.length; c++) {
        const cell = row[c]?.trim();
        if (cell && cell.includes("/") && cell.includes("\n")) {
          // Format: "TestName/MaxMarks\nScoredMarks"
          const parts = cell.split("\n");
          const headerParts = parts[0].split("/");
          const testName = headerParts[0]?.trim() || "";
          const maxMarks = parseFloat(headerParts[1]?.trim() || "0");
          const scored = parseFloat(parts[1]?.trim() || "0");

          if (testName && !isNaN(maxMarks) && !isNaN(scored)) {
            testEntries.push({ testName, maxMarks, scored });
          }
        }
      }

      if (code && courseType) {
        marks.push({
          code,
          courseType,
          marks: testEntries,
        });
      }
    }
  }

  // Calculate overall attendance
  const totalAttn = subjects.reduce((sum, s) => sum + s.percentage, 0);
  const overall = subjects.length > 0 ? Math.round(totalAttn / subjects.length) : 0;

  return {
    student,
    attendance: { overall, subjects },
    marks,
  };
}

// ──── Main API Route ────
export async function POST(req: Request) {
  try {
    const { netId, password } = await req.json();

    if (!netId || !password) {
      return NextResponse.json(
        { error: "NetID and password are required." },
        { status: 400 }
      );
    }

    console.log("Starting Academia scrape for:", netId);

    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    try {
      // Step 1: Login
      await loginToAcademia(page, netId, password);

      // Step 2: Navigate to attendance page (this has attendance + marks + profile)
      console.log("Navigating to My Attendance page...");
      await page.goto("https://academia.srmist.edu.in/#Page:My_Attendance", {
        waitUntil: "networkidle",
        timeout: 20000,
      });
      await page.waitForTimeout(5000);

      // Step 3: Extract table data from the main frame
      const rawRows: string[][] = [];
      const mainFrame = page.frames()[0];

      const tables = await mainFrame.locator("table").all();
      console.log(`Found ${tables.length} tables on attendance page`);

      // The main data table is usually the second table (index 1) — it contains everything
      for (const table of tables) {
        const rows = await table.locator("tr").all();
        for (const row of rows) {
          const cells = await row.locator("td, th").all();
          const rowData: string[] = [];
          for (const cell of cells) {
            rowData.push(await cell.innerText().catch(() => ""));
          }
          if (rowData.length > 0 && rowData.some((c) => c.trim())) {
            rawRows.push(rowData);
          }
        }
      }

      console.log(`Extracted ${rawRows.length} raw table rows`);

      // Step 4: Parse the data
      const { student, attendance, marks } = parseAttendanceData(rawRows);

      console.log(
        `Parsed: ${student.name}, ${attendance.subjects.length} subjects, ${marks.length} mark entries`
      );

      // Step 5: Build schedule from day order info
      // (The timetable pages had "Page not found" for direct URLs,
      //  but the dashboard shows today's day order info)
      const schedule: { time: string; name: string; room: string }[] = [];
      
      // Build schedule from attendance subjects (based on slot assignment)
      const slotTimeMap: Record<string, string> = {
        A: "08:00 - 08:50 AM",
        B: "09:00 - 09:50 AM",
        C: "10:00 - 10:50 AM",
        D: "11:00 - 11:50 AM",
        E: "12:00 - 12:50 PM",
        F: "01:40 - 02:30 PM",
        G: "02:30 - 03:20 PM",
        LAB: "Varies",
      };

      for (const subj of attendance.subjects) {
        if (subj.category === "Theory") {
          schedule.push({
            time: slotTimeMap[subj.slot] || subj.slot,
            name: subj.title,
            room: subj.room,
          });
        }
      }

      await browser.close();

      // Return the fully scraped data
      return NextResponse.json({
        authenticated: true,
        message: "Login successful. Real data scraped from Academia.",
        data: {
          student: {
            name: student.name,
            regNumber: student.regNumber,
            course: `${student.program} - ${student.specialization}`,
            department: student.department,
            semester: student.semester,
            batch: student.batch,
            feedbackStatus: student.feedbackStatus,
            enrollmentStatus: student.enrollmentStatus,
          },
          attendance: {
            overall: attendance.overall,
            subjects: attendance.subjects.map((s) => ({
              code: s.code,
              name: s.title,
              category: s.category,
              faculty: s.faculty,
              slot: s.slot,
              room: s.room,
              percentage: s.percentage,
            })),
          },
          marks: marks.map((m) => ({
            code: m.code,
            courseType: m.courseType,
            tests: m.marks,
          })),
          grades: marks
            .filter((m) => m.marks.length > 0)
            .map((m) => {
              const total = m.marks.reduce((sum, t) => sum + t.scored, 0);
              const max = m.marks.reduce((sum, t) => sum + t.maxMarks, 0);
              const pct = max > 0 ? Math.round((total / max) * 100) : 0;
              return {
                subject: m.code,
                courseType: m.courseType,
                totalScored: parseFloat(total.toFixed(2)),
                totalMax: parseFloat(max.toFixed(2)),
                percentage: pct,
                grade: pct >= 90 ? "O" : pct >= 80 ? "A+" : pct >= 70 ? "A" : pct >= 60 ? "B+" : pct >= 50 ? "B" : "C",
              };
            }),
          schedule,
        },
      });
    } catch (scrapeError: unknown) {
      await browser.close();
      throw scrapeError;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to connect to Academia.";
    console.error("Login Error:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
