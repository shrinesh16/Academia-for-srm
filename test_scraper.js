const { chromium } = require("playwright");

async function scrapeAcademia() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log("Navigating to Academia SRM...");
    await page.goto("https://academia.srmist.edu.in/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    
    // Find the login iframe
    let loginFrame = null;
    for (const frame of page.frames()) {
        if (frame.url().includes("signin")) {
            loginFrame = frame;
            break;
        }
    }
    
    if (!loginFrame) {
        console.log("Could not find login iframe. Exiting.");
        return;
    }
    
    console.log("Filling credentials in iframe...");
    const emailInput = loginFrame.locator("input[name='login_id'], input[id='login_id']").first();
    await emailInput.fill("sm8149@srmist.edu.in");
    
    const nextBtn1 = loginFrame.locator("button#nextbtn, button#login_btn").first();
    await nextBtn1.click();
    await page.waitForTimeout(1500);
    
    const passInput = loginFrame.locator("input[name='password'], input[id='password']").first();
    await passInput.fill("Parotta#17");
    
    const nextBtn2 = loginFrame.locator("button#nextbtn, button#login_btn").first();
    await nextBtn2.click();
    console.log("Clicked login in iframe.");
    
    // Wait for either the dashboard or the session limit screen
    await page.waitForTimeout(5000);
    console.log("Current URL after login:", page.url());
    
    // The session limit might ALSO be in an iframe, or it redirects the top page!
    // Let's check top page text
        const topText = await page.innerText("body").catch(() => "");
    if (topText.includes("Active Sessions") || topText.includes("session limit") || topText.toLowerCase().includes("session") || topText.toLowerCase().includes("terminate all sessions")) {
        console.log("Session limit detected on TOP page!");
        // Look for skip/continue/terminate button
        const skipBtn = page.locator("button:has-text('Skip'), button:has-text('Continue'), button:has-text('Terminate All Sessions')").first();
        if (await skipBtn.isVisible()) {
            await skipBtn.click();
            console.log("Clicked Terminate/Skip.");
        }
    }
    
    // Check if it's in an iframe
    for (const frame of page.frames()) {
        const text = await frame.innerText("body").catch(() => "");
        if (text.includes("Active Sessions") || text.includes("session limit") || text.toLowerCase().includes("session") || text.toLowerCase().includes("terminate all sessions")) {
            console.log("Session limit detected in IFRAME!");
            const skipBtn = frame.locator("#continue_button, div.btn:has-text('Terminate All Sessions'), .btn:has-text('Skip')").first();
            if (await skipBtn.isVisible()) {
                await skipBtn.click();
                console.log("Clicked Terminate/Skip in iframe.");
            }
        }
    }
    
    await page.waitForTimeout(5000);
    console.log("Final URL:", page.url());
    
    // Dump top level content
    console.log("--- DOM TEXT SNIPPET ---");
    console.log((await page.innerText("body").catch(()=>"")).substring(0, 500));
    console.log("------------------------");
    
    let studentName = "Not found";
    // Check all frames for student name
    for (const frame of page.frames()) {
        try {
            const nameEl = frame.locator(".user-name, #user_name, .profile-name, [data-zcqa='user_name'], .zc-profile-name, #zc-profile-name").first();
            if (await nameEl.isVisible({ timeout: 1000 })) {
                studentName = await nameEl.innerText();
                console.log("Found student name in frame", frame.url(), ":", studentName);
                break;
            }
        } catch (e) {}
    }
    
    // Also try checking the general text for the name
    if (studentName === "Not found") {
        for (const frame of page.frames()) {
            const text = await frame.innerText("body").catch(()=>"");
            if (text.includes("SHRINESH") || text.includes("Shrinesh")) {
                console.log("Found Shrinesh in frame:", frame.url());
            }
        }
    }
    
  } catch (e) {
    console.error("Error during scraping:", e);
  } finally {
    await browser.close();
  }
}

scrapeAcademia();
