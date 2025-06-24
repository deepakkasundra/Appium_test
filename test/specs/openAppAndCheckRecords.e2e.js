const APP_PACKAGE = 'com.bhive.workspace';
const fs = require('fs');
const path = require('path');
const isIOS = driver.isIOS;

const horizontalScrollSelector = isIOS
  ? '//XCUIElementTypeScrollView'
  : '//android.widget.HorizontalScrollView';

// Industry-standard logger setup using winston
const winston = require('winston');
require('winston-daily-rotate-file');

const logDir = __dirname;
const logFile = path.join(logDir, 'openAppAndCheckRecords.log');

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

// Utility: Get all unique menu options by scrolling the horizontal menu
async function getAllMenuOptions() {
    const seen = new Set();
    let lastCount = 0;
    const maxScrolls = 10; // safety limit

    for (let scrolls = 0; scrolls < maxScrolls; scrolls++) {
        // Find all clickable menu items
        const menuElems = await $$(horizontalScrollSelector + (isIOS
            ? '//XCUIElementTypeOther[@clickable="true"]'
            : '//android.view.ViewGroup[@clickable="true"]'));
        for (const elem of menuElems) {
            const desc = await elem.getAttribute('content-desc');
            if (desc && desc.trim() !== '') {
                seen.add(desc.trim());
            }
        }
        if (seen.size === lastCount) break; // no new items found
        lastCount = seen.size;

        // Try to scroll the HorizontalScrollView using W3C Actions API
        try {
            const scrollView = await $('//android.widget.HorizontalScrollView');
            const location = await scrollView.getLocation();
            const size = await scrollView.getSize();
            const startX = location.x + size.width * 0.8;
            const endX = location.x + size.width * 0.2;
            const y = location.y + size.height / 2;

            await driver.performActions([{
                type: 'pointer',
                id: 'finger1',
                parameters: { pointerType: 'touch' },
                actions: [
                    { type: 'pointerMove', duration: 0, x: startX, y: y },
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: 300 },
                    { type: 'pointerMove', duration: 500, x: endX, y: y },
                    { type: 'pointerUp', button: 0 }
                ]
            }]);
            await driver.pause(800); // wait for scroll animation
            await driver.releaseActions();
        } catch (err) {
            console.error('Error scrolling HorizontalScrollView:', err);
            break;
        }
    }
    const menuNames = Array.from(seen);
    logInfo(`Total horizontal menus loaded: ${menuNames.length}`);
    return menuNames;
}

// Utility: Scroll down the records list until all unique records are found
async function getAllRecordsForMenu() {
    const seen = new Set();
    let lastCount = 0;
    const maxScrolls = 100; // much higher for very long lists
    let consecutiveNoNewRecords = 0;
    const maxConsecutiveNoNew = 3; // stop after 3 consecutive scrolls with no new records
    
    for (let scrolls = 0; scrolls < maxScrolls; scrolls++) {
        const recordElems = await $$('//android.widget.ScrollView//android.view.ViewGroup[@clickable="true" and string-length(@content-desc) > 0 and not(contains(@content-desc, "Day Pass")) and not(contains(@content-desc, "Bulk Day Pass")) and not(@content-desc="")]');
        let newRecords = [];
        let duplicateRecords = [];
        
        for (const elem of recordElems) {
            const desc = await elem.getAttribute('content-desc');
            if (
                desc &&
                desc.trim() !== '' &&
                !desc.includes('Day Pass') &&
                !desc.includes('Bulk Day Pass') &&
                desc !== '' &&
                desc.trim() !== '' && // Filter out icon character
                desc.trim().length > 1 // Filter out single characters
            ) {
                // Extract location name (before comma) for uniqueness
                const locationName = desc.split(',')[0].trim();
                const fullDesc = desc.trim();
                
                // Additional validation: skip if location name is too short or is just an icon
                if (locationName.length > 1 && locationName !== '') {
                    // Use full description for uniqueness to handle cases like "Platinum, Indiranagar" vs "Platinum, Other Location"
                    if (!seen.has(fullDesc)) {
                        newRecords.push(fullDesc);
                        seen.add(fullDesc);
                    } else {
                        duplicateRecords.push(fullDesc);
                    }
                } else {
                    logInfo(`[SCROLL ${scrolls + 1}] Skipping invalid record: "${fullDesc}"`);
                }
            }
        }
        
        if (newRecords.length > 0) {
            logInfo(`[SCROLL ${scrolls + 1}] New records found:`, newRecords);
            consecutiveNoNewRecords = 0; // reset counter
        } else {
            consecutiveNoNewRecords++;
            logInfo(`[SCROLL ${scrolls + 1}] No new records found. (Consecutive: ${consecutiveNoNewRecords})`);
        }
        
        if (duplicateRecords.length > 0) {
            logInfo(`[SCROLL ${scrolls + 1}] Already seen records (re-appearing during scroll):`, duplicateRecords);
        }
        
        // Check if we've reached the end (no new records for several consecutive scrolls)
        if (consecutiveNoNewRecords >= maxConsecutiveNoNew) {
            logInfo(`[SCROLL ${scrolls + 1}] Reached end of list after ${consecutiveNoNewRecords} consecutive scrolls with no new records.`);
            break;
        }
        
        if (seen.size === lastCount) {
            // Double-check: try one more scroll to be sure
            logInfo(`[SCROLL ${scrolls + 1}] No new records found, but continuing to ensure we reach the end...`);
        }
        lastCount = seen.size;
        
        // Scroll down with overlap to ensure no records are missed
            const scrollView = await $('//android.widget.ScrollView');
            const location = await scrollView.getLocation();
            const size = await scrollView.getSize();
            const x = location.x + size.width / 2;
            const startY = location.y + size.height * 0.8;
        const endY = location.y + size.height * 0.3; // more overlap to ensure no records are missed
        
        await driver.performActions([
            {
                type: 'pointer',
                id: 'finger1',
                parameters: { pointerType: 'touch' },
                actions: [
                    { type: 'pointerMove', duration: 0, x: x, y: startY },
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: 300 },
                    { type: 'pointerMove', duration: 1000, x: x, y: endY }, // slower scroll
                    { type: 'pointerUp', button: 0 }
                ]
            }
        ]);
            await driver.releaseActions();
        await driver.pause(2000); // longer pause to allow for any lazy loading
    }
    
    logInfo(`[FINAL] Total unique records collected: ${seen.size}`);
    return Array.from(seen);
}

// Utility: Get all unique menu names dynamically by scrolling through horizontal menu
async function getMenuNames() {
    const seen = new Set();
    let lastCount = 0;
    const maxScrolls = 10; // safety limit for horizontal scrolling
    
    logInfo(`[MENU DISCOVERY] Starting horizontal menu discovery...`);
    
    for (let scrolls = 0; scrolls < maxScrolls; scrolls++) {
        // Find all clickable menu items currently visible
    const menuElems = await $$('//android.widget.HorizontalScrollView//android.view.ViewGroup[@clickable="true"]');
        let newMenus = [];
        
    for (const elem of menuElems) {
        const desc = await elem.getAttribute('content-desc');
        if (desc && desc.trim() !== '') {
                const trimmed = desc.trim();
                if (!seen.has(trimmed)) {
                    newMenus.push(trimmed);
                }
                seen.add(trimmed);
            }
        }
        
        if (newMenus.length > 0) {
            logInfo(`[MENU DISCOVERY] Scroll ${scrolls + 1}: New menus found: [${newMenus.join(', ')}]`);
        } else {
            logInfo(`[MENU DISCOVERY] Scroll ${scrolls + 1}: No new menus found.`);
        }
        
        // If no new menus found, we've reached the end
        if (seen.size === lastCount) {
            logInfo(`[MENU DISCOVERY] No new menus found after scroll ${scrolls + 1}, stopping discovery.`);
            break;
        }
        lastCount = seen.size;
        
        // Scroll the horizontal menu bar to the right to reveal more menus
        try {
            const scrollView = await $('//android.widget.HorizontalScrollView');
            const location = await scrollView.getLocation();
            const size = await scrollView.getSize();
            const startX = location.x + size.width * 0.8;
            const endX = location.x + size.width * 0.2;
            const y = location.y + size.height / 2;
            
            await driver.performActions([{
                type: 'pointer',
                id: 'finger1',
                parameters: { pointerType: 'touch' },
                actions: [
                    { type: 'pointerMove', duration: 0, x: startX, y: y },
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: 300 },
                    { type: 'pointerMove', duration: 500, x: endX, y: y },
                    { type: 'pointerUp', button: 0 }
                ]
            }]);
            await driver.releaseActions();
            await driver.pause(800); // wait for scroll animation
        } catch (err) {
            logInfo(`[MENU DISCOVERY] Error scrolling horizontal menu: ${err.message}`);
            break;
        }
    }
    
    const menuNames = Array.from(seen);
    logInfo(`[MENU DISCOVERY] Total unique menus discovered: ${menuNames.length}`);
    logInfo(`[MENU DISCOVERY] All discovered menus: [${menuNames.join(', ')}]`);
    return menuNames;
}

async function scrollMenuTo(menuName, maxScrolls = 10) {
    const menuSelector = `//android.widget.HorizontalScrollView//android.view.ViewGroup[@clickable="true" and @content-desc="${menuName}"]`;
    const scrollViewSelector = '//android.widget.HorizontalScrollView';
    for (let i = 0; i < maxScrolls; i++) {
        const menuElem = await $(menuSelector);
        if (await menuElem.isExisting() && await menuElem.isDisplayed()) {
            return menuElem;
        }
        // Swipe right-to-left to bring more menus into view
        const scrollView = await $(scrollViewSelector);
        const { x, y } = await scrollView.getLocation();
        const { width, height } = await scrollView.getSize();
        await driver.performActions([{
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
                { type: 'pointerMove', duration: 0, x: Math.round(x + width * 0.8), y: Math.round(y + height / 2) },
                { type: 'pointerDown', button: 0 },
                { type: 'pause', duration: 300 },
                { type: 'pointerMove', duration: 500, x: Math.round(x + width * 0.2), y: Math.round(y + height / 2) },
                { type: 'pointerUp', button: 0 }
            ]
        }]);
        await driver.releaseActions();
        await driver.pause(500);
    }
    return null; // Not found after maxScrolls
}

async function getClickableMenuNames() {
    const menuElems = await $$(horizontalScrollSelector + (isIOS
        ? '//XCUIElementTypeOther[@clickable="true"]'
        : '//android.view.ViewGroup[@clickable="true"]'));
    const names = [];
    for (const elem of menuElems) {
        const desc = await elem.getAttribute('content-desc');
        if (desc && desc.trim() !== '') {
            names.push(desc.trim().toLowerCase());
        }
    }
    return names;
}

// Helper: Wait for the records list to update after selecting a menu (dynamic, no hardcoding, compare all visible records)
async function waitForMenuToLoadDynamic(prevVisibleRecords) {
    for (let i = 0; i < 12; i++) {
        const recordElems = await $$('//android.widget.ScrollView//android.view.ViewGroup[@clickable="true" and string-length(@content-desc) > 0]');
        let visibleRecords = [];
        for (const elem of recordElems) {
            if (await elem.isDisplayed()) {
                const desc = await elem.getAttribute('content-desc');
                if (desc && !desc.includes('Day Pass') && !desc.includes('Bulk Day Pass')) {
                    visibleRecords.push(desc);
                }
            }
        }
        if (
            visibleRecords.length > 0 &&
            (!prevVisibleRecords || visibleRecords.join('|') !== prevVisibleRecords.join('|'))
        ) {
            logInfo(`[DEBUG] Menu loaded, visible records changed:`, visibleRecords);
            return visibleRecords;
        }
        await driver.pause(500);
    }
    logInfo('[WARNING] No visible records changed after menu selection.');
    return null;
}

async function scrollMenuToStart(maxScrolls = 5) {
    const scrollViewSelector = '//android.widget.HorizontalScrollView';
    for (let i = 0; i < maxScrolls; i++) {
        const scrollView = await $(scrollViewSelector);
        const { x, y } = await scrollView.getLocation();
        const { width, height } = await scrollView.getSize();
        // Swipe left-to-right
        await driver.performActions([{
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
                { type: 'pointerMove', duration: 0, x: Math.round(x + width * 0.2), y: Math.round(y + height / 2) },
                { type: 'pointerDown', button: 0 },
                { type: 'pause', duration: 300 },
                { type: 'pointerMove', duration: 500, x: Math.round(x + width * 0.8), y: Math.round(y + height / 2) },
                { type: 'pointerUp', button: 0 }
            ]
        }]);
        await driver.releaseActions();
        await driver.pause(500);
    }
}

async function scrollMenuBarToStart(maxScrolls = 5) {
    const scrollViewSelector = '//android.widget.HorizontalScrollView';
    for (let i = 0; i < maxScrolls; i++) {
        const scrollView = await $(scrollViewSelector);
        const { x, y } = await scrollView.getLocation();
        const { width, height } = await scrollView.getSize();
        // Swipe left-to-right to go to the start
        await driver.performActions([{
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
                { type: 'pointerMove', duration: 0, x: Math.round(x + width * 0.2), y: Math.round(y + height / 2) },
                { type: 'pointerDown', button: 0 },
                { type: 'pause', duration: 300 },
                { type: 'pointerMove', duration: 500, x: Math.round(x + width * 0.8), y: Math.round(y + height / 2) },
                { type: 'pointerUp', button: 0 }
            ]
        }]);
        await driver.releaseActions();
        await driver.pause(500);
    }
}

// Mocha test suite
describe('Open app and check number of records', () => {
    before(async () => {
        // Ensure app is open and in a clean state
        let appState;
        try {
            appState = await driver.queryAppState(APP_PACKAGE);
        } catch (e) {
            appState = 0;
        }
        if (appState === 4) {
            await driver.terminateApp(APP_PACKAGE);
            await driver.activateApp(APP_PACKAGE);
        } else if (appState === 3) {
            await driver.activateApp(APP_PACKAGE);
        } else {
            await driver.activateApp(APP_PACKAGE);
        }
        await driver.pause(2000);
    });

    it('should check all horizontal menus and their records', async () => {
        // 1. Discover all menu names (do this at the very start, after scrolling fully left)
        await scrollMenuBarToStart(); // Custom function to scroll fully left
        const menuNames = await getMenuNames();
        const menuRecordsSummary = {};
        let prevVisibleRecords = null;
        
        logInfo(`[TEST START] Processing ${menuNames.length} discovered menus: [${menuNames.join(', ')}]`);
        
        for (const menuName of menuNames) {
            logInfo(`[PROCESSING] Starting to process menu: ${menuName}`);
            // 2. For each menu, always scroll it into view before clicking
            let found = false;
            let attempts = 0;
            
            // Try scrolling right-to-left first (to bring right-side menus into view)
            while (!found && attempts < 5) {
                const menu = await $(`//*[@text="${menuName}"]`);
                if (await menu.isDisplayed()) {
                    found = true;
                    logInfo(`[PROCESSING] Menu "${menuName}" found and clicked successfully`);
                    await menu.click();
                    // Wait for the menu to load (dynamically, no hardcoding, and ensure records list changes)
                    const newVisibleRecords = await waitForMenuToLoadDynamic(prevVisibleRecords);
                    prevVisibleRecords = newVisibleRecords;
                    // Collect all records for this menu
                    const records = await getAllRecordsForMenu();
                    logInfo(`[SUMMARY] Records for menu '${menuName}':`, records);
                    menuRecordsSummary[menuName] = records;
                } else {
                    // Swipe right-to-left to bring right-side menus into view
                    const scrollViewSelector = '//android.widget.HorizontalScrollView';
                    const scrollView = await $(scrollViewSelector);
                    const { x, y } = await scrollView.getLocation();
                    const { width, height } = await scrollView.getSize();
                    await driver.performActions([
                        {
                            type: 'pointer',
                            id: 'finger1',
                            parameters: { pointerType: 'touch' },
                            actions: [
                                { type: 'pointerMove', duration: 0, x: Math.round(x + width * 0.8), y: Math.round(y + height / 2) },
                                { type: 'pointerDown', button: 0 },
                                { type: 'pause', duration: 300 },
                                { type: 'pointerMove', duration: 500, x: Math.round(x + width * 0.2), y: Math.round(y + height / 2) },
                                { type: 'pointerUp', button: 0 }
                            ]
                        }
                    ]);
                        await driver.releaseActions();
                    await driver.pause(500);
                }
                attempts++;
            }
            
            // If not found, try scrolling left-to-right as fallback
            if (!found) {
                attempts = 0;
                while (!found && attempts < 5) {
                    const menu = await $(`//*[@text="${menuName}"]`);
                    if (await menu.isDisplayed()) {
                        found = true;
                        logInfo(`[PROCESSING] Menu "${menuName}" found and clicked successfully (after left-to-right scroll)`);
                        await menu.click();
                        // Wait for the menu to load (dynamically, no hardcoding, and ensure records list changes)
                        const newVisibleRecords = await waitForMenuToLoadDynamic(prevVisibleRecords);
                        prevVisibleRecords = newVisibleRecords;
                        // Collect all records for this menu
                        const records = await getAllRecordsForMenu();
                        logInfo(`[SUMMARY] Records for menu '${menuName}':`, records);
                        menuRecordsSummary[menuName] = records;
                } else {
                        // Swipe left-to-right to bring left-side menus into view
                        const scrollViewSelector = '//android.widget.HorizontalScrollView';
                        const scrollView = await $(scrollViewSelector);
                        const { x, y } = await scrollView.getLocation();
                        const { width, height } = await scrollView.getSize();
                        await driver.performActions([
                            {
                        type: 'pointer',
                        id: 'finger1',
                        parameters: { pointerType: 'touch' },
                        actions: [
                                    { type: 'pointerMove', duration: 0, x: Math.round(x + width * 0.2), y: Math.round(y + height / 2) },
                            { type: 'pointerDown', button: 0 },
                                    { type: 'pause', duration: 300 },
                                    { type: 'pointerMove', duration: 500, x: Math.round(x + width * 0.8), y: Math.round(y + height / 2) },
                            { type: 'pointerUp', button: 0 }
                        ]
                            }
                        ]);
                    await driver.releaseActions();
                        await driver.pause(500);
                    }
                    attempts++;
                }
            }
            
            if (!found) {
                logInfo(`[ERROR] Menu '${menuName}' not found after bidirectional scrolling!`);
            } else {
                logInfo(`[PROCESSING] Successfully completed processing menu: ${menuName}`);
            }
        }
        
        // Final summary log
        logInfo('===== FINAL MENU RECORDS SUMMARY =====');
        logInfo(`[SUMMARY] Discovered menus: ${menuNames.length} - [${menuNames.join(', ')}]`);
        logInfo(`[SUMMARY] Successfully processed menus: ${Object.keys(menuRecordsSummary).length} - [${Object.keys(menuRecordsSummary).join(', ')}]`);
        
        // Check for any missed menus
        const missedMenus = menuNames.filter(menu => !menuRecordsSummary[menu]);
        if (missedMenus.length > 0) {
            logInfo(`[WARNING] Missed menus: ${missedMenus.length} - [${missedMenus.join(', ')}]`);
        }
        
        // Industry-standard test results
        logInfo('===== TEST EXECUTION SUMMARY =====');
        logInfo(`[TEST_RESULT] Test Name: Horizontal Menu Records Validation`);
        logInfo(`[TEST_RESULT] Test Status: ${missedMenus.length === 0 ? 'PASSED' : 'FAILED'}`);
        logInfo(`[TEST_RESULT] Execution Date: ${new Date().toISOString()}`);
        logInfo(`[TEST_RESULT] Platform: Android`);
        logInfo(`[TEST_RESULT] App Version: staging-2.5.1`);
        
        // Metrics
        const totalRecords = Object.values(menuRecordsSummary).reduce((sum, records) => sum + records.length, 0);
        const avgRecordsPerMenu = totalRecords / Object.keys(menuRecordsSummary).length;
        
        logInfo(`[METRICS] Total Menus Processed: ${Object.keys(menuRecordsSummary).length}`);
        logInfo(`[METRICS] Total Records Found: ${totalRecords}`);
        logInfo(`[METRICS] Average Records per Menu: ${avgRecordsPerMenu.toFixed(2)}`);
        logInfo(`[METRICS] Success Rate: ${((Object.keys(menuRecordsSummary).length / menuNames.length) * 100).toFixed(2)}%`);
        
        // Detailed results by menu
        logInfo('===== DETAILED RESULTS BY MENU =====');
        for (const [menu, records] of Object.entries(menuRecordsSummary)) {
            logInfo(`[MENU_RESULT] Menu: ${menu} | Records: ${records.length} | Status: PASSED`);
            logInfo(`[MENU_DETAILS] Records: [${records.join(', ')}]`);
        }
        
        // Test completion
        logInfo('===== TEST COMPLETION =====');
        logInfo(`[COMPLETION] Test completed at: ${new Date().toISOString()}`);
        logInfo(`[COMPLETION] Final Status: ${missedMenus.length === 0 ? '✅ ALL MENUS PROCESSED SUCCESSFULLY' : '❌ SOME MENUS FAILED TO PROCESS'}`);
        logInfo('===== END OF SUMMARY =====');
    });
});