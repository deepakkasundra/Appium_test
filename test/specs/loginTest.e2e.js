// Login and check

const APP_PACKAGE = 'com.bhive.workspace';
const fs = require('fs');
const path = require('path');

// Add platform detection
const isIOS = driver.isIOS;

// Platform-specific selectors
const getMobileInputSelectors = () => {
    if (isIOS) {
        return [
            '//XCUIElementTypeTextField[@name="Mobile Number"]',
            '//XCUIElementTypeTextField[@label="Mobile Number"]',
            '//XCUIElementTypeTextField[contains(@name, "mobile")]'
        ];
    } else {
        return [
            '//android.widget.EditText[@hint="Mobile Number"]',
            '//android.widget.EditText[@hint="Phone Number"]',
            '//android.widget.EditText[contains(@content-desc, "mobile")]'
        ];
    }
};

// Industry-standard logger setup using winston
const winston = require('winston');
require('winston-daily-rotate-file');

const logDir = __dirname;
const logFile = path.join(logDir, 'loginTest.log');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => `[${info.timestamp}] [${info.level.toUpperCase()}] ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: logFile, maxsize: 1048576, maxFiles: 5 })
    ]
});

function logInfo(...args) {
    logger.info(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' '));
}
function logWarn(...args) {
    logger.warn(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' '));
}
function logError(...args) {
    logger.error(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' '));
}

// Utility to get timestamped log file name
function getLogFileName() {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const day = pad(now.getDate());
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const hour = pad(now.getHours());
    const min = pad(now.getMinutes());
    const sec = pad(now.getSeconds());
    const testFile = path.basename(__filename, '.js');
    return `loginTest${testFile}_${day}${month}${year}_${hour}${min}${sec}.txt`;
}

// Utility to log to both console and file
let logFilePath;
function logToBoth(...args) {
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' ');
    console.log(msg);
    if (logFilePath) {
        fs.appendFileSync(logFilePath, msg + '\n');
    }
}

// Utility to wait for element with timeout
async function waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            const element = await $(selector);
            if (await element.isDisplayed()) {
                return element;
            }
        } catch (err) {
            // Element not found, continue waiting
        }
        await driver.pause(500);
    }
    return null;
}

// Utility to wait for element by ID with timeout
async function waitForElementById(elementId, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            const element = await $(`id=${elementId}`);
            if (await element.isDisplayed()) {
                return element;
            }
        } catch (err) {
            // Element not found, continue waiting
        }
        await driver.pause(500);
    }
    return null;
}

async function findAndClickLoginTrigger(triggers) {
    for (const selector of triggers) {
        try {
            const element = await $(selector);
            if (await element.isDisplayed()) {
                logToBoth(`✅ Found login trigger: "${await element.getText()}" with selector: ${selector}`);
                await element.click();
                await driver.pause(2000);
                logToBoth('✅ Login trigger clicked');
                return true;
            }
        } catch (err) { /* continue */ }
    }
    logToBoth('⚠️ No login trigger found, proceeding to check for mobile input...');
    return false;
}

// Utility to log all TextViews and their visibility
async function logAllTextViews(context = '') {
    logToBoth(`--- All android.widget.TextView elements ${context} ---`);
    const allTextViews = await $$('android.widget.TextView');
    for (const el of allTextViews) {
        try {
            const text = (await el.getText()).trim();
            const displayed = await el.isDisplayed();
            logToBoth(`  TextView: '${text}' | Displayed: ${displayed}`);
        } catch (e) { /* skip */ }
    }
    logToBoth('---------------------------------------------');
}

// Add this helper function at the top-level (outside describe)
async function loginWithMobile(mobileNumber) {
    logToBoth('🔑 [loginWithMobile] Starting login process with mobile number:', mobileNumber);
    // 1. Find and enter mobile number
    logToBoth('➡️ [loginWithMobile] Waiting for mobile input field on login page...');
    const mobileInput = await waitForElement("//android.widget.EditText[@text='Mobile' and @resource-id='text-input-outlined']", 5000);
    if (!mobileInput) throw new Error('[loginWithMobile] Mobile input field not found on login page');
    logToBoth('✅ [loginWithMobile] Mobile input field found. Pausing for 1s before entering value...');
    await driver.pause(1000);
    logToBoth('➡️ [loginWithMobile] Clicking mobile input field...');
    await mobileInput.click();
    await driver.pause(2000);
    const valueBefore = await mobileInput.getText();
    logToBoth(`[loginWithMobile] Field value before input: '${valueBefore}'`);

    logToBoth('➡️ [loginWithMobile] Clearing input field...');
    await mobileInput.clearValue();
    await driver.pause(500);

    // Try setValue first
    logToBoth('➡️ [loginWithMobile] Trying setValue for the whole mobile number...');
    await driver.setClipboard(mobileNumber);
    await mobileInput.click();
    await driver.longPressKeyCode(50); // KEYCODE_PASTE, may vary by device
    let actualMobileValue = await mobileInput.getText();
    logToBoth(`[loginWithMobile] (setValue) Mobile number entered. Input field now contains: '${actualMobileValue}'`);
    if (actualMobileValue !== mobileNumber) {
        logToBoth(`[loginWithMobile] setValue did not work as expected. Trying addValue for the whole number...`);
        await mobileInput.clearValue();
        await driver.pause(500);
        await mobileInput.addValue(mobileNumber);
        await driver.pause(1000);
        actualMobileValue = await mobileInput.getText();
        logToBoth(`[loginWithMobile] (addValue) Mobile number entered. Input field now contains: '${actualMobileValue}'`);
        if (actualMobileValue !== mobileNumber) {
            logToBoth(`[loginWithMobile] Neither setValue nor addValue worked as expected. Trying to enter number using pressKeyCode for each digit...`);
            await mobileInput.clearValue();
            await driver.pause(500);
            await mobileInput.click();
            await driver.pause(500);
            for (const digit of mobileNumber) {
                const keyCode = 7 + Number(digit); // KEYCODE_0 is 7
                logToBoth(`[loginWithMobile] Sending keycode for digit '${digit}' (keyCode: ${keyCode})`);
                await driver.pressKeyCode(keyCode);
                await driver.pause(300);
            }
            await driver.pause(1000);
            actualMobileValue = await mobileInput.getText();
            logToBoth(`[loginWithMobile] (pressKeyCode) Mobile number entered. Input field now contains: '${actualMobileValue}'`);
            if (actualMobileValue !== mobileNumber) {
                logToBoth(`[loginWithMobile] Even pressKeyCode did not work. Please check for app-side restrictions, masking, or overlays.`);
            }
        }
    }
    // 2. Find and click login button
    logToBoth('➡️ [loginWithMobile] Waiting for login button...');
    const loginButton = await waitForElement("//android.view.ViewGroup[@content-desc='Log In']", 5000);
    if (!loginButton) throw new Error('[loginWithMobile] Login button not found on login page');
    logToBoth('✅ [loginWithMobile] Login button found. Clicking...');
    await loginButton.click();
    logToBoth('✅ [loginWithMobile] Login button clicked, waiting for OTP page...');
    await driver.pause(2000);
    await logAllTextViews('[loginWithMobile] after clicking Login (before OTP)');
    const pageSourceAfterLogin = await driver.getPageSource();
    logToBoth('[loginWithMobile] --- Page source after clicking Login (before OTP) ---');
    logToBoth(pageSourceAfterLogin);
    // 3. Wait for OTP input
    logToBoth('➡️ [loginWithMobile] Waiting for OTP input field...');
    let otpInput = await waitForElement("//android.widget.EditText[@resource-id='text-input-outlined']", 5000);
    if (!otpInput) {
        logToBoth('[loginWithMobile] OTP input not found with strict selector, trying relaxed selector for any displayed and enabled EditText...');
        const allEditTexts = await $$('android.widget.EditText');
        let candidateIndex = -1;
        for (let i = 0; i < allEditTexts.length; i++) {
            const el = allEditTexts[i];
            const displayed = await el.isDisplayed();
            const enabled = await el.isEnabled();
            const bounds = await el.getAttribute('bounds');
            logToBoth(`[loginWithMobile] EditText[${i}]: displayed=${displayed}, enabled=${enabled}, bounds=${bounds}`);
            if (displayed && enabled && otpInput == null) {
                otpInput = el;
                candidateIndex = i;
            }
        }
        if (otpInput) {
            logToBoth(`[loginWithMobile] Found OTP input with relaxed selector at index ${candidateIndex}.`);
        } else {
            logToBoth('[loginWithMobile] No OTP input found. Logging all EditText elements and dumping page source:');
            for (let i = 0; i < allEditTexts.length; i++) {
                const el = allEditTexts[i];
                const displayed = await el.isDisplayed();
                const enabled = await el.isEnabled();
                const text = await el.getText();
                const bounds = await el.getAttribute('bounds');
                logToBoth(`[loginWithMobile] EditText[${i}]: text='${text}', displayed=${displayed}, enabled=${enabled}, bounds=${bounds}`);
            }
            const pageSource = await driver.getPageSource();
            logToBoth('[loginWithMobile] --- Page source when OTP input not found ---');
            logToBoth(pageSource);
            throw new Error('[loginWithMobile] OTP input field not found on OTP page');
        }
    }

    const otp = mobileNumber.substring(0, 4);
    logToBoth(`[loginWithMobile] Entering OTP: ${otp}`);
    await otpInput.clearValue();
    await otpInput.setValue(otp);
    logToBoth(`[loginWithMobile] OTP entered. Checking if Profile page is loaded...`);
    const profileHeading = await waitForElement("//android.view.View[@text='Profile']", 5000);
    if (profileHeading) {
        logToBoth('[loginWithMobile] Profile page detected after OTP entry. Skipping Submit button wait.');
        return;
    }
    // Fallback: wait for Submit button (legacy flow)
    const submitButton = await waitForElement("//android.widget.Button[@content-desc='Submit']", 5000);
    if (!submitButton) throw new Error('[loginWithMobile] Submit button not found on OTP page');

    logToBoth(`[loginWithMobile] OTP entered. Skipping getText() to avoid stale element error.`);
    await logAllTextViews('[loginWithMobile] after entering OTP');
    const pageSourceAfterOtp = await driver.getPageSource();
    logToBoth('[loginWithMobile] --- Page source after entering OTP ---');
    logToBoth(pageSourceAfterOtp);
    // 4. Find and click submit button
    logToBoth('➡️ [loginWithMobile] Waiting for submit button...');
    await submitButton.click();
    logToBoth('✅ [loginWithMobile] Submit button clicked, waiting for profile page...');
    await driver.pause(2000);

    logToBoth('[loginWithMobile] Waiting for profile page after OTP...');
    const profileContainer = await waitForElement("//android.view.ViewGroup[contains(@content-desc, 'Profile')]", 10000);
    if (!profileContainer) {
        logToBoth('[loginWithMobile] Profile page not detected after OTP. Dumping page source...');
        const pageSource = await driver.getPageSource();
        logToBoth(pageSource);
        throw new Error('[loginWithMobile] Profile page not detected after OTP');
    }
    logToBoth('[loginWithMobile] Profile page detected after OTP.');

    // After successful profile verification
    const profilePageSource = await driver.getPageSource();
    logToBoth('[loginWithMobile] --- Profile details page source ---');
    logToBoth(profilePageSource);
    logToBoth('✅ [loginWithMobile] Login with mobile completed.');
}

// Add this helper function at the top-level (outside describe)
async function verifyProfilePage(mobileNumber = '9870501985') {
    logToBoth('🔎 [verifyProfilePage] Verifying profile page...');
    await logAllTextViews('[verifyProfilePage] at start of profile verification');
    // Wait for user info (longer timeout after login)
    let foundText = '';
    let userInfo = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        logToBoth(`[verifyProfilePage] Attempt ${attempt}: Checking for user info with strict selector...`);
        let userInfoSelector = `//android.widget.TextView[contains(@text, '${mobileNumber}') and contains(@text, '@')]`;
        userInfo = await waitForElement(userInfoSelector, 3000);
        if (!userInfo) {
            logToBoth(`[verifyProfilePage] Attempt ${attempt}: Strict selector did not match. Trying relaxed selector...`);
            userInfoSelector = `//android.widget.TextView[contains(@text, '${mobileNumber}') or contains(@text, '@')]`;
            userInfo = await waitForElement(userInfoSelector, 2000);
        }
        if (userInfo) {
            foundText = (await userInfo.getText()).trim();
            logToBoth(`[verifyProfilePage] User info found with selector [${userInfoSelector}]: '${foundText}'`);
            break;
        } else {
            // Fetch all TextViews and log their texts and visibility
            logToBoth(`[verifyProfilePage] Attempt ${attempt}: User info not found, logging all TextViews for debugging...`);
            await logAllTextViews('[verifyProfilePage] during user info check');
            const allTextViews = await $$('android.widget.TextView');
            for (const el of allTextViews) {
                try {
                    const text = (await el.getText()).trim();
                    const displayed = await el.isDisplayed();
                    if (displayed && (text.includes(mobileNumber) || text.includes('@'))) {
                        userInfo = el;
                        foundText = text;
                        logToBoth(`[verifyProfilePage] User info found by manual scan: '${foundText}'`);
                        break;
                    }
                } catch (e) { /* skip */ }
            }
            if (userInfo) break;
            await driver.pause(2000);
        }
    }
    if (!userInfo) {
        logToBoth('[verifyProfilePage] User info not found on profile page after retries. Dumping page source for debugging...');
        const pageSource = await driver.getPageSource();
        logToBoth(pageSource);
        throw new Error('[verifyProfilePage] User info not found on profile page');
    }
    logToBoth(`[verifyProfilePage] Profile element: User Info = '${foundText}'`);

    // Booking History
    logToBoth('[verifyProfilePage] Checking for Booking History...');
    const bookingHistoryMatches = await $$('//android.widget.TextView[@text="Booking History"]');
    logToBoth(`[verifyProfilePage] Found ${bookingHistoryMatches.length} elements for Booking History.`);
    let bookingHistoryAvailable = false;
    for (const el of bookingHistoryMatches) {
        const displayed = await el.isDisplayed();
        logToBoth(`[verifyProfilePage] Booking History Displayed: ${displayed}`);
        if (displayed) bookingHistoryAvailable = true;
    }
    if (bookingHistoryAvailable) {
        logToBoth('[verifyProfilePage] Booking History is available (displayed).');
    } else {
        logToBoth('[verifyProfilePage] Booking History is NOT available (not displayed).');
        throw new Error('[verifyProfilePage] Booking History section not found');
    }

    // Company / GSTIN
    logToBoth('[verifyProfilePage] Checking for Company / GSTIN...');
    const companyGstinMatches = await $$('//android.widget.TextView[@text="Company / GSTIN"]');
    logToBoth(`[verifyProfilePage] Found ${companyGstinMatches.length} elements for Company / GSTIN.`);
    let companyGstinAvailable = false;
    for (const el of companyGstinMatches) {
        const displayed = await el.isDisplayed();
        logToBoth(`[verifyProfilePage] Company / GSTIN Displayed: ${displayed}`);
        if (displayed) companyGstinAvailable = true;
    }
    if (companyGstinAvailable) {
        logToBoth('[verifyProfilePage] Company / GSTIN is available (displayed).');
    } else {
        logToBoth('[verifyProfilePage] Company / GSTIN is NOT available (not displayed).');
        throw new Error('[verifyProfilePage] Company / GSTIN section not found');
    }

    // Refer & Win
    logToBoth('[verifyProfilePage] Checking for Refer & Win...');
    const referWinMatches = await $$('//android.widget.TextView[@text="Refer & Win"]');
    logToBoth(`[verifyProfilePage] Found ${referWinMatches.length} elements for Refer & Win.`);
    let referWinAvailable = false;
    for (const el of referWinMatches) {
        const displayed = await el.isDisplayed();
        logToBoth(`[verifyProfilePage] Refer & Win Displayed: ${displayed}`);
        if (displayed) referWinAvailable = true;
    }
    if (referWinAvailable) {
        logToBoth('[verifyProfilePage] Refer & Win is available (displayed).');
    } else {
        logToBoth('[verifyProfilePage] Refer & Win is NOT available (not displayed).');
        throw new Error('[verifyProfilePage] Refer & Win section not found');
    }

    // Invite
    logToBoth('[verifyProfilePage] Checking for Invite...');
    const inviteMatches = await $$('//android.widget.TextView[@text="Invite"]');
    logToBoth(`[verifyProfilePage] Found ${inviteMatches.length} elements for Invite.`);
    let inviteAvailable = false;
    for (const el of inviteMatches) {
        const displayed = await el.isDisplayed();
        logToBoth(`[verifyProfilePage] Invite Displayed: ${displayed}`);
        if (displayed) inviteAvailable = true;
    }
    if (inviteAvailable) {
        logToBoth('[verifyProfilePage] Invite is available (displayed).');
    } else {
        logToBoth('[verifyProfilePage] Invite is NOT available (not displayed).');
        throw new Error('[verifyProfilePage] Invite section not found');
    }

    // View Center Locations on Map
    logToBoth('[verifyProfilePage] Checking for View Center Locations on Map...');
    const viewCenterMatches = await $$('//android.widget.TextView[@text="View Center Locations on Map"]');
    logToBoth(`[verifyProfilePage] Found ${viewCenterMatches.length} elements for View Center Locations on Map.`);
    let viewCenterAvailable = false;
    for (const el of viewCenterMatches) {
        const displayed = await el.isDisplayed();
        logToBoth(`[verifyProfilePage] View Center Locations on Map Displayed: ${displayed}`);
        if (displayed) viewCenterAvailable = true;
    }
    if (viewCenterAvailable) {
        logToBoth('[verifyProfilePage] View Center Locations on Map is available (displayed).');
    } else {
        logToBoth('[verifyProfilePage] View Center Locations on Map is NOT available (not displayed).');
        throw new Error('[verifyProfilePage] View Center Locations on Map section not found');
    }

    // Settings
    logToBoth('[verifyProfilePage] Checking for Settings...');
    const settingsMatches = await $$('//android.widget.TextView[@text="Settings"]');
    logToBoth(`[verifyProfilePage] Found ${settingsMatches.length} elements for Settings.`);
    let settingsAvailable = false;
    for (const el of settingsMatches) {
        const displayed = await el.isDisplayed();
        logToBoth(`[verifyProfilePage] Settings Displayed: ${displayed}`);
        if (displayed) settingsAvailable = true;
    }
    if (settingsAvailable) {
        logToBoth('[verifyProfilePage] Settings is available (displayed).');
    } else {
        logToBoth('[verifyProfilePage] Settings is NOT available (not displayed).');
        throw new Error('[verifyProfilePage] Settings section not found');
    }

    // Logout button
    logToBoth('[verifyProfilePage] Checking for Logout button...');
    const logoutButtonMatches = await $$('//android.widget.Button[@content-desc="Log out"]');
    logToBoth(`[verifyProfilePage] Found ${logoutButtonMatches.length} elements for Logout button.`);
    let logoutButtonAvailable = false;
    for (const el of logoutButtonMatches) {
        const displayed = await el.isDisplayed();
        logToBoth(`[verifyProfilePage] Logout Button Displayed: ${displayed}`);
        if (displayed) logoutButtonAvailable = true;
    }
    if (logoutButtonAvailable) {
        logToBoth('[verifyProfilePage] Logout Button is available (displayed).');
    } else {
        logToBoth('[verifyProfilePage] Logout Button is NOT available (not displayed).');
        throw new Error('[verifyProfilePage] Logout button not found');
    }

    // After successful profile verification
    const profilePageSource = await driver.getPageSource();
    logToBoth('[verifyProfilePage] --- Profile details page source ---');
    logToBoth(profilePageSource);
    logToBoth('[verifyProfilePage] Profile verification completed.');
}

// Mocha test suite
describe('Login Test Suite', () => {
    before(async () => {
        logInfo('[TestSuite] Before hook: Ensuring app is open and in a clean state...');
        let appState;
        try {
            appState = await driver.queryAppState(APP_PACKAGE);
            logInfo(`[TestSuite] App state: ${appState}`);
        } catch (e) {
            logInfo('[TestSuite] Error querying app state, defaulting to 0.');
            appState = 0;
        }
        if (appState === 4) {
            logInfo('[TestSuite] App is running in background, terminating and re-activating...');
            await driver.terminateApp(APP_PACKAGE);
            await driver.activateApp(APP_PACKAGE);
        } else if (appState === 3) {
            logInfo('[TestSuite] App is running in foreground, activating...');
            await driver.activateApp(APP_PACKAGE);
        } else {
            logInfo('[TestSuite] App is not running, activating...');
            await driver.activateApp(APP_PACKAGE);
        }
        await driver.pause(2000);
        logInfo('[TestSuite] Before hook completed.');
    });

    it('should perform login flow from launch screen', async function() {
        this.timeout(60000);
        logFilePath = path.join(__dirname, getLogFileName());
        logInfo('===== LOGIN FLOW VALIDATION TEST START =====');
        
        // Test execution tracking
        const testExecution = {
            startTime: new Date().toISOString(),
            endTime: null,
            duration: null,
            testName: 'Login Flow Validation',
            testVersion: '2.0.0',
            platform: isIOS ? 'iOS' : 'Android',
            appVersion: 'staging-2.5.1',
            steps: [],
            errors: [],
            warnings: [],
            metrics: {
                totalSteps: 0,
                passedSteps: 0,
                failedSteps: 0,
                skippedSteps: 0,
                elementWaitTime: 0,
                totalWaitTime: 0
            },
            environment: {
                platform: isIOS ? 'iOS' : 'Android',
                device: null,
                osVersion: null,
                appPackage: APP_PACKAGE
            }
        };

        try {
            // Get device information
            const capabilities = await driver.capabilities;
            testExecution.environment.device = capabilities.deviceName || 'Unknown Device';
            testExecution.environment.osVersion = capabilities.platformVersion || 'Unknown Version';
            
            logInfo(`[TEST] Device: ${testExecution.environment.device}`);
            logInfo(`[TEST] OS Version: ${testExecution.environment.osVersion}`);

            // Step 1: Wait for and click the profile icon
            logInfo('[Test] Step 1: Waiting for profile icon () on launch screen...');
            
            // Try multiple selectors to find the profile icon
            let profileIcon = null;
            const profileIconSelectors = [
                "//android.widget.TextView[@bounds='[774,2095][846,2168]']",
                "//android.widget.TextView[@text='' and @bounds='[774,2095][846,2168]']",
                "//android.widget.TextView[contains(@content-desc, 'profile') or contains(@content-desc, 'Profile')]",
                "//android.widget.TextView[@bounds='[774,2095][846,2168]' and @clickable='true']"
            ];
            
            for (const selector of profileIconSelectors) {
                logInfo(`[Test] Trying profile icon selector: ${selector}`);
                profileIcon = await waitForElement(selector, 3000);
                if (profileIcon) {
                    logInfo(`[Test] ✅ Profile icon found with selector: ${selector}`);
                    break;
                }
            }
            
            if (!profileIcon) throw new Error('[Test] Profile icon not found on launch screen');
            await profileIcon.click();
            logInfo('[Test] ✅ Profile icon clicked, should open profile/login page.');
            testExecution.steps.push({ step: 1, status: 'PASSED', message: 'Profile icon clicked' });
            testExecution.metrics.totalSteps++;
            testExecution.metrics.passedSteps++;
            await driver.pause(2000);

            // Step 2: Detect login state
            logInfo('[Test] Step 2: Detecting if user is already logged in or not...');
            let isLoggedIn = false;
            let isLoginPage = false;

            // Check for login page (EditText for mobile and login button)
            logInfo('[Test] Checking for login page elements...');
            const mobileInput = await waitForElement("//android.widget.EditText[@text='Mobile' and @resource-id='text-input-outlined']", 3000);
            const loginButton = await waitForElement("//android.view.ViewGroup[@content-desc='Log In']", 3000);
            if (mobileInput && loginButton) {
                isLoginPage = true;
                logInfo('[Test] 🔒 User is NOT logged in: Login page detected.');
                testExecution.steps.push({ step: 2, status: 'PASSED', message: 'Login page detected (user not logged in)' });
                testExecution.metrics.totalSteps++;
                testExecution.metrics.passedSteps++;
                
                // Call loginWithMobile helper
                await loginWithMobile('9870501985');
                logInfo('[Test] ✅ Login process completed. Waiting for Profile heading...');
                
                // Wait for Profile heading before verifying profile page
                const profileHeading = await waitForElement("//android.view.View[@text='Profile']", 10000);
                if (!profileHeading) throw new Error('[Test] Profile heading not found after login');
                logInfo('[Test] ✅ Profile heading found. Verifying profile page...');
                testExecution.steps.push({ step: 3, status: 'PASSED', message: 'Login process completed' });
                testExecution.metrics.totalSteps++;
                testExecution.metrics.passedSteps++;

                // Step 4: Verify profile page
                logInfo('[Test] Step 4: Verifying profile page after login...');
                await verifyProfilePage('9870501985');
                testExecution.steps.push({ step: 4, status: 'PASSED', message: 'Profile page verified after login' });
                testExecution.metrics.totalSteps++;
                testExecution.metrics.passedSteps++;
            }

            // Check for logged-in state (profile info and logout button)
            logInfo('[Test] Checking for logged-in state (profile info and logout button)...');
            const profileInfo = await waitForElement("//android.widget.TextView[contains(@text, '@') or contains(@text, '|') or contains(@text, 'Log out')]", 3000);
            const logoutButton = await waitForElement("//android.widget.Button[@content-desc='Log out']", 3000);
            if (profileInfo && logoutButton) {
                isLoggedIn = true;
                logInfo('[Test] 🔓 User IS logged in: Profile and logout button detected.');
                testExecution.steps.push({ step: 2, status: 'PASSED', message: 'Profile page detected (user logged in)' });
                testExecution.metrics.totalSteps++;
                testExecution.metrics.passedSteps++;
                
                // Always verify profile page in this case too
                logInfo('[Test] Step 3: Verifying profile page for already logged-in user...');
                await verifyProfilePage('9870501985');
                testExecution.steps.push({ step: 3, status: 'PASSED', message: 'Profile page verified (already logged in)' });
                testExecution.metrics.totalSteps++;
                testExecution.metrics.passedSteps++;
            }

            if (!isLoginPage && !isLoggedIn) {
                testExecution.steps.push({ step: 2, status: 'FAILED', message: 'Could not determine login state' });
                testExecution.metrics.totalSteps++;
                testExecution.metrics.failedSteps++;
                throw new Error('[Test] Could not determine login state: neither login page nor profile page detected');
            }

            testExecution.endTime = new Date().toISOString();
            testExecution.duration = new Date(testExecution.endTime) - new Date(testExecution.startTime);
            
            // Industry-standard test results
            logInfo('===== TEST EXECUTION SUMMARY =====');
            logInfo(`[TEST_RESULT] Test Name: ${testExecution.testName}`);
            logInfo(`[TEST_RESULT] Test Status: ${testExecution.metrics.failedSteps === 0 ? 'PASSED' : 'FAILED'}`);
            logInfo(`[TEST_RESULT] Execution Date: ${testExecution.startTime}`);
            logInfo(`[TEST_RESULT] Platform: ${testExecution.platform}`);
            logInfo(`[TEST_RESULT] App Version: ${testExecution.appVersion}`);
            logInfo(`[TEST_RESULT] Device: ${testExecution.environment.device}`);
            logInfo(`[TEST_RESULT] OS Version: ${testExecution.environment.osVersion}`);
            
            // Metrics
            const successRate = testExecution.metrics.totalSteps > 0 
                ? (testExecution.metrics.passedSteps / testExecution.metrics.totalSteps * 100).toFixed(2)
                : 0;
            
            logInfo(`[METRICS] Total Steps: ${testExecution.metrics.totalSteps}`);
            logInfo(`[METRICS] Passed Steps: ${testExecution.metrics.passedSteps}`);
            logInfo(`[METRICS] Failed Steps: ${testExecution.metrics.failedSteps}`);
            logInfo(`[METRICS] Success Rate: ${successRate}%`);
            logInfo(`[METRICS] Execution Duration: ${testExecution.duration}ms`);
            
            // Detailed results by step
            logInfo('===== DETAILED RESULTS BY STEP =====');
            for (const step of testExecution.steps) {
                const statusIcon = step.status === 'PASSED' ? '✅' : step.status === 'SKIPPED' ? '⏭️' : '❌';
                logInfo(`[STEP_RESULT] Step ${step.step}: ${statusIcon} ${step.status} - ${step.message}`);
            }
            
            // Test completion
            logInfo('===== TEST COMPLETION =====');
            logInfo(`[COMPLETION] Test completed at: ${testExecution.endTime}`);
            logInfo(`[COMPLETION] Final Status: ${testExecution.metrics.failedSteps === 0 ? '✅ LOGIN FLOW VALIDATION PASSED' : '❌ LOGIN FLOW VALIDATION FAILED'}`);
            logInfo('===== END OF SUMMARY =====');
            
            logInfo('[Test] 🎉 LOGIN STATE DETECTION COMPLETED!');
            
        } catch (error) {
            testExecution.endTime = new Date().toISOString();
            testExecution.duration = new Date(testExecution.endTime) - new Date(testExecution.startTime);
            testExecution.errors.push(error.message);
            
            logError(`[Test] ❌ LOGIN TEST FAILED: ${error.message}`);
            logError(error.stack);
            
            // Error summary
            logInfo('===== TEST EXECUTION SUMMARY =====');
            logInfo(`[TEST_RESULT] Test Name: ${testExecution.testName}`);
            logInfo(`[TEST_RESULT] Test Status: FAILED`);
            logInfo(`[TEST_RESULT] Execution Date: ${testExecution.startTime}`);
            logInfo(`[TEST_RESULT] Platform: ${testExecution.platform}`);
            logInfo(`[TEST_RESULT] App Version: ${testExecution.appVersion}`);
            logInfo(`[TEST_RESULT] Device: ${testExecution.environment.device}`);
            logInfo(`[TEST_RESULT] OS Version: ${testExecution.environment.osVersion}`);
            
            logInfo(`[METRICS] Total Steps: ${testExecution.metrics.totalSteps}`);
            logInfo(`[METRICS] Passed Steps: ${testExecution.metrics.passedSteps}`);
            logInfo(`[METRICS] Failed Steps: ${testExecution.metrics.failedSteps}`);
            logInfo(`[METRICS] Success Rate: ${testExecution.metrics.totalSteps > 0 ? (testExecution.metrics.passedSteps / testExecution.metrics.totalSteps * 100).toFixed(2) : 0}%`);
            logInfo(`[METRICS] Execution Duration: ${testExecution.duration}ms`);
            
            logInfo('===== ERROR DETAILS =====');
            for (const errorMsg of testExecution.errors) {
                logError(`[ERROR] ${errorMsg}`);
            }
            
            logInfo('===== TEST COMPLETION =====');
            logInfo(`[COMPLETION] Test completed at: ${testExecution.endTime}`);
            logInfo(`[COMPLETION] Final Status: ❌ LOGIN FLOW VALIDATION FAILED`);
            logInfo('===== END OF SUMMARY =====');
            
            throw new Error(`[Test] Login test failed: ${testExecution.errors.join(', ')}`);
        }
    });
});

async function isUserLoggedIn() {
    // Check for user info and logout button
    const userInfo = await waitForElement("//android.widget.TextView[contains(@text, '@') or contains(@text, '|')]", 3000);
    const logoutButton = await waitForElement("//android.widget.Button[@content-desc='Log out']", 3000);
    return !!(userInfo && logoutButton);
}


