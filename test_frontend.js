const { chromium } = require("playwright");

async function testFrontend() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log("Navigating to http://localhost:3000...");
    await page.goto("http://localhost:3000/");
    
    await page.fill("input[name='netId']", "test@test.com");
    await page.fill("input[name='password']", "password123");
    
    console.log("Clicking submit...");
    await page.click("button[type='submit']");
    
    console.log("Waiting for network response or UI change...");
    
    // Wait for the button text to change to 'Authenticating...'
    await page.waitForTimeout(1000);
    const content = await page.content();
    if (content.includes("Authenticating")) {
      console.log("UI updated to Authenticating...");
    }
    
    // Wait for error message or dashboard
    await page.waitForTimeout(15000); // the scraper takes 11s
    
    const finalContent = await page.content();
    if (finalContent.includes("Attendance Overview")) {
      console.log("SUCCESS! Dashboard loaded.");
    } else if (finalContent.includes("Invalid credentials") || finalContent.includes("Failed to authenticate")) {
      console.log("Failed to authenticate error shown.");
    } else {
      console.log("UNKNOWN STATE. Page text:");
      console.log(await page.innerText("body"));
    }
    
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await browser.close();
  }
}

testFrontend();
