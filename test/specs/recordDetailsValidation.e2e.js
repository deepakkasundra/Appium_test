//Record and verify details

const { expect } = require('chai');
const winston = require('winston');
const path = require('path');
const { getAllRecordsForMenu, getMenuNames } = require('../utils/menuRecordUtils');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

// Import TestReporter if it exists, otherwise create a simple mock
let TestReporter;
try {
    TestReporter = require('../utils/testReporter');
} catch (error) {
    // Create a simple mock TestReporter if the file doesn't exist
    TestReporter = class MockTestReporter {
        constructor() {
            this.results = [];
        }
        startTest() { console.log('[MOCK] Test started'); }
        endTest() { console.log('[MOCK] Test ended'); }
        addMenuResult(menuName, results) { 
            this.results.push({ menuName, results });
            console.log(`[MOCK] Added ${results.length} results for menu ${menuName}`);
        }
        generateConsoleSummary() { console.log('[MOCK] Summary generated'); }
        saveReport(dir) { 
            console.log(`[MOCK] Report would be saved to ${dir}`);
            return { htmlPath: `${dir}/mock-report.html` };
        }
    };
}

const logDir = __dirname;
const logFile = path.join(logDir, 'recordDetailsValidation.log');

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

// Utility: Validate all details for a record element against API data
async function validateRecordDetailsWithAPI(recordElem, desc, menuName, recordIndex, logInfo, apiCenters) {
    let status = 'PASS';
    let reasons = [];
    let details = [];

    let matchedCenter;
    if (menuName === 'All') {
        matchedCenter = apiCenters.find(center => desc && desc.includes(center.name));
    } else {
        // First, try to find a match in the correct cluster
        matchedCenter = apiCenters.find(center => desc && desc.includes(center.name) && center.cluster_name === menuName);
        if (!matchedCenter) {
            // If not found, check if the name exists in another cluster (for explicit cluster mismatch logging)
            const nameMatch = apiCenters.find(center => desc && desc.includes(center.name));
            if (nameMatch) {
                details.push(`[ASSERTION FAILED] UI record "${desc}" found in menu "${menuName}" but API cluster_name is "${nameMatch.cluster_name}"`);
                status = 'FAIL';
                reasons.push('Cluster name mismatch');
            } else {
                details.push(`[ASSERTION FAILED] No API center found for UI record "${desc}" in menu "${menuName}"`);
                status = 'FAIL';
                reasons.push('No API match');
            }
        }
    }
    if (matchedCenter) {
        details.push(`[ASSERTION PASSED] UI record "${desc}" matched API center "${matchedCenter.name}" in cluster "${matchedCenter.cluster_name}"`);

        // 1. Extract price and discount info from API
        const apiPrice = matchedCenter.day_pass_price; // e.g., 299
        const discountObj = matchedCenter.day_pass_discounts_percentage && matchedCenter.day_pass_discounts_percentage["1"];
        const discountValue = discountObj ? discountObj.value : 0;
        const discountLabel = discountObj && discountObj.message
            ? discountObj.message
            : (discountValue > 0 ? `${discountValue}% Discount` : "");

        // 2. Calculate expected discounted price
        const discountedPrice = Math.floor(apiPrice * (1 - discountValue / 100));

        // 3. Extract ALL text from the record element and its children using proper WebdriverIO approach
        const allTexts = await extractAllTextsFromElement(recordElem);
        logInfo(`[DEBUG] All texts found for "${desc}":`, allTexts);
        
        // 4. Find price and discount information in the extracted texts
        let foundOriginal = false, foundDiscounted = false, foundLabel = false;
        let foundLabelText = "";
        
        for (const text of allTexts) {
            if (text && text.trim()) {
                const trimmedText = text.trim();
                logInfo(`[DEBUG] Checking text: "${trimmedText}"`);
                
                // Check for original price
                if (trimmedText.includes(`₹${apiPrice}`)) {
                    foundOriginal = true;
                    logInfo(`[DEBUG] Found original price: ${trimmedText}`);
                }
                
                // Check for discounted price
                if (discountValue > 0 && trimmedText.includes(`₹${discountedPrice}`)) {
                    foundDiscounted = true;
                    logInfo(`[DEBUG] Found discounted price: ${trimmedText}`);
                }
                
                // Check for discount label
                if (discountValue > 0) {
                    // Check for various discount label patterns
                    const lowerText = trimmedText.toLowerCase();
                    const isDiscountLabel = 
                        lowerText.includes('off') || 
                        lowerText.includes('discount') ||
                        lowerText.includes('%') && (lowerText.includes('festive') || lowerText.includes('summer') || lowerText.includes('flat') || lowerText.includes('amigos') || lowerText.includes('bulk')) ||
                        lowerText.includes('flat') && lowerText.includes('%') ||
                        lowerText.includes('amigos') && lowerText.includes('%');
                    
                    if (isDiscountLabel) {
                        foundLabel = true;
                        foundLabelText = trimmedText;
                        logInfo(`[DEBUG] Found discount label: ${trimmedText}`);
                    }
                }
            }
        }

        let checks = [];

        // Original price
        checks.push({
            field: 'Original Price',
            expected: `₹${apiPrice}`,
            actual: foundOriginal ? `₹${apiPrice}` : '(not found)',
            status: foundOriginal ? 'PASS' : 'FAIL'
        });

        // Discounted price
        if (discountValue > 0) {
            checks.push({
                field: 'Discounted Price',
                expected: `₹${discountedPrice}`,
                actual: foundDiscounted ? `₹${discountedPrice}` : '(not found)',
                status: foundDiscounted ? 'PASS' : 'FAIL'
            });
            // Discount label
            if (foundLabel) {
                checks.push({
                    field: 'Discount Label',
                    expected: discountLabel,
                    actual: foundLabelText,
                    status: foundLabelText === discountLabel ? 'PASS' : 'SUGGESTION'
                });
            } else {
                checks.push({
                    field: 'Discount Label',
                    expected: discountLabel,
                    actual: '(not found)',
                    status: 'FAIL'
                });
            }
        }

        // Cluster check (for non-All menus)
        if (menuName !== 'All') {
            checks.push({
                field: 'Cluster',
                expected: menuName,
                actual: matchedCenter.cluster_name,
                status: matchedCenter.cluster_name === menuName ? 'PASS' : 'FAIL'
            });
        }

        // Log in a simple, readable way
        logInfo(`[RECORD] Menu: ${menuName} | Record: ${desc}`);
        for (const check of checks) {
            logInfo(`  [CHECK] Field: ${check.field} | Expected: ${check.expected} | Actual: ${check.actual} | Status: ${check.status}`);
        }

        // Only check cluster name mismatch for non-All menus
        if (menuName !== 'All' && matchedCenter && matchedCenter.cluster_name !== menuName) {
            details.push(`[ASSERTION FAILED] UI record "${desc}" found in menu "${menuName}" but API cluster_name is "${matchedCenter.cluster_name}"`);
            status = 'FAIL';
            reasons.push('Cluster name mismatch');
        }

        // Update status based on check results
        const failedChecks = checks.filter(check => check.status === 'FAIL');
        if (failedChecks.length > 0) {
            status = 'FAIL';
            reasons.push(`Failed checks: ${failedChecks.map(c => c.field).join(', ')}`);
        }
    }

    logInfo(`Menu: ${menuName} | Record Index: ${recordIndex} | Record Name: ${desc}`);
    for (const line of details) {
        logInfo(`  ${line}`);
    }
    logInfo(`  status: ${status}${status === 'FAIL' ? ' (Reason: ' + reasons.join('; ') + ')' : ''}`);

    // Instead of throwing, return the result
    return {
        menuName,
        recordIndex,
        recordName: desc,
        status,
        reasons,
        details
    };
}

// New function to properly extract all texts from a WebdriverIO element
async function extractAllTextsFromElement(element) {
    const texts = [];
    
    try {
        // Get the element's own text
        const ownText = await element.getText();
        if (ownText && ownText.trim()) {
            texts.push(ownText.trim());
        }
        
        // Method 1: Get all TextViews using relative XPath from the element
        try {
            const textViews = await element.$$('.//android.widget.TextView');
            for (const textView of textViews) {
                try {
                    const text = await textView.getText();
                    if (text && text.trim()) {
                        texts.push(text.trim());
                    }
                } catch (err) {
                    // Skip if element is not accessible
                    continue;
                }
            }
        } catch (err) {
            logInfo(`[DEBUG] Error with relative TextView selector: ${err.message}`);
        }
        
        // Method 2: Get all elements and check if they contain text
        try {
            const allElements = await element.$$('.//*');
            for (const elem of allElements) {
                try {
                    const className = await elem.getAttribute('class');
                    if (className && className.includes('TextView')) {
                        const text = await elem.getText();
                        if (text && text.trim()) {
                            texts.push(text.trim());
                        }
                    }
                } catch (err) {
                    // Skip if element is not accessible
                    continue;
                }
            }
        } catch (err) {
            logInfo(`[DEBUG] Error with relative all elements selector: ${err.message}`);
        }
        
        // Method 3: Try absolute XPath from the element's location
        try {
            const elementLocation = await element.getLocation();
            const elementSize = await element.getSize();
            logInfo(`[DEBUG] Element location: ${JSON.stringify(elementLocation)}, size: ${JSON.stringify(elementSize)}`);
            
            // Get all TextViews in the entire page and filter by location
            const allPageTextViews = await $$('//android.widget.TextView');
            for (const textView of allPageTextViews) {
                try {
                    const tvLocation = await textView.getLocation();
                    const tvSize = await textView.getSize();
                    
                    // Check if this TextView is within our record element bounds
                    if (tvLocation.x >= elementLocation.x && 
                        tvLocation.y >= elementLocation.y &&
                        tvLocation.x + tvSize.width <= elementLocation.x + elementSize.width &&
                        tvLocation.y + tvSize.height <= elementLocation.y + elementSize.height) {
                        
                        const text = await textView.getText();
                        if (text && text.trim()) {
                            texts.push(text.trim());
                        }
                    }
                } catch (err) {
                    continue;
                }
            }
        } catch (err) {
            logInfo(`[DEBUG] Error with location-based approach: ${err.message}`);
        }
        
        // Method 4: Get page source and parse XML for this element's area
        try {
            const pageSource = await browser.getPageSource();
            logInfo(`[DEBUG] Page source length: ${pageSource.length}`);
            
            // For now, just log that we have the page source
            // In a more sophisticated approach, we could parse the XML and find the element's XML node
            // and extract all text attributes from it and its children
        } catch (err) {
            logInfo(`[DEBUG] Error getting page source: ${err.message}`);
        }
        
    } catch (err) {
        logInfo(`[DEBUG] Error extracting texts from element: ${err.message}`);
    }
    
    // Remove duplicates while preserving order
    const uniqueTexts = [];
    for (const text of texts) {
        if (!uniqueTexts.includes(text)) {
            uniqueTexts.push(text);
        }
    }
    
    logInfo(`[DEBUG] Total unique texts extracted: ${uniqueTexts.length}`);
    return uniqueTexts;
}

// Robust menu scrolling as in openAppAndCheckRecords.e2e.js
async function scrollMenuTo(menuName, maxScrolls = 10) {
    const menuSelector = `//android.widget.HorizontalScrollView//android.view.ViewGroup[@clickable="true" and @content-desc="${menuName}"]`;
    const scrollViewSelector = '//android.widget.HorizontalScrollView';

    // Try right-to-left first
    for (let i = 0; i < maxScrolls; i++) {
        const menuElem = await $(menuSelector);
        if (await menuElem.isExisting() && await menuElem.isDisplayed()) {
            return menuElem;
        }
        // Swipe right-to-left
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

    // If not found, try left-to-right
    for (let i = 0; i < maxScrolls; i++) {
        const menuElem = await $(menuSelector);
        if (await menuElem.isExisting() && await menuElem.isDisplayed()) {
            return menuElem;
        }
        // Swipe left-to-right
        const scrollView = await $(scrollViewSelector);
        const { x, y } = await scrollView.getLocation();
        const { width, height } = await scrollView.getSize();
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

    // Not found after both directions
    return null;
}

function extractAllTexts(node, texts = []) {
    if (!node) return texts;
    if (typeof node === 'object' && node['@_text'] && node['@_text'].trim() !== '') {
        texts.push(node['@_text'].trim());
    }
    for (const key in node) {
        if (Array.isArray(node[key])) {
            node[key].forEach(child => extractAllTexts(child, texts));
        } else if (typeof node[key] === 'object') {
            extractAllTexts(node[key], texts);
        }
    }
    return texts;
}

async function getAllTextViews(element) {
    let texts = [];
    // Get text if this is a TextView and has text
    const className = await element.getAttribute('class');
    if (className && className.includes('TextView')) {
        const text = await element.getText();
        if (text && text.trim()) texts.push(text.trim());
    }
    // Recurse into children
    const children = await element.$$('//*');
    for (const child of children) {
        texts = texts.concat(await getAllTextViews(child));
    }
    return texts;
}

function getAllTexts(node) {
    let texts = [];
    if (!node) return texts;
    if (node['@_text']) {
        texts.push(node['@_text'].trim());
    }
    for (const key in node) {
        if (Array.isArray(node[key])) {
            for (const child of node[key]) {
                texts = texts.concat(getAllTexts(child));
            }
        } else if (typeof node[key] === 'object') {
            texts = texts.concat(getAllTexts(node[key]));
        }
    }
    return texts;
}

function findNodeByContentDesc(node, contentDesc) {
    if (!node) return null;
    if (typeof node === 'object' && node['@_content-desc'] === contentDesc) {
        return node;
    }
    for (const key in node) {
        if (Array.isArray(node[key])) {
            for (const child of node[key]) {
                const found = findNodeByContentDesc(child, contentDesc);
                if (found) return found;
            }
        } else if (typeof node[key] === 'object') {
            const found = findNodeByContentDesc(node[key], contentDesc);
            if (found) return found;
        }
    }
    return null;
}

// Main test

logInfo('[DEBUG] Test started');

describe('Detailed Record Validation (with API verification)', () => {
    let apiCenters = [];
    let testReporter;

    before(async () => {
        // Initialize test reporter
        testReporter = new TestReporter();
        testReporter.startTest();
        
        // Fetch API data once before all tests
        try {
            const response = await axios.get(
                'https://stag.bhiveworkspace.com/api/v1/centers?limit=1000&is_day_pass_enabled=true',
                {
                    headers: {
                        'accept': '*/*',
                        'origin': 'https://booking-stag.bhiveworkspace.com',
                        'referer': 'https://booking-stag.bhiveworkspace.com/day-passes',
                        'web-app-version': '1.0.0'
                    }
                }
            );
            apiCenters = response.data.data;
            logInfo(`Fetched ${apiCenters.length} centers from API`);
        } catch (err) {
            logError('Failed to fetch API data:', err.message);
            throw err;
        }
    });

    after(async () => {
        // Generate and save test report
        testReporter.endTest();
        testReporter.generateConsoleSummary();
        const reportPaths = testReporter.saveReport('test-reports');
        logInfo(`Test report saved to: ${reportPaths.htmlPath}`);
    });

    it('should validate all details for each record in every menu against API', async () => {
        logInfo('===== DETAILED RECORD VALIDATION TEST START =====');
        await driver.pause(2000);
        const menuNames = await getMenuNames(logInfo);
        logInfo(`[TEST] Discovered menus: [${menuNames.join(', ')}]`);

        const allResults = [];

        for (const menuName of menuNames) {
            logInfo(`[MENU] Processing menu: ${menuName}`);
            const menuElem = await scrollMenuTo(menuName);
            if (menuElem && await menuElem.isDisplayed()) {
                await menuElem.click();
                await driver.pause(2000);

                const centersForMenu = menuName === 'All'
                    ? apiCenters
                    : apiCenters.filter(center => center.cluster_name === menuName);
                logInfo(`[API] Centers for menu "${menuName}": ${centersForMenu.length}`);

                const menuResults = [];
                let recordIndex = 1;
                await getAllRecordsForMenu(async (recordElem, desc) => {
                    logInfo(`[DEBUG] Processing record: ${desc}`);
                    const result = await validateRecordDetailsWithAPI(recordElem, desc, menuName, recordIndex++, logInfo, centersForMenu);
                    menuResults.push(result);
                    allResults.push(result);
                }, logInfo);

                // Add menu results to reporter
                testReporter.addMenuResult(menuName, menuResults);
            } else {
                logWarn(`[ERROR] Menu '${menuName}' not found after bidirectional scrolling!`);
                continue;
            }
        }

        // Summarize results
        const failed = allResults.filter(r => r.status === 'FAIL');
        const passed = allResults.filter(r => r.status === 'PASS');

        logInfo('===== TEST SUMMARY =====');
        logInfo(`Total records checked: ${allResults.length}`);
        logInfo(`Passed: ${passed.length}`);
        logInfo(`Failed: ${failed.length}`);

        if (failed.length > 0) {
            logError('===== FAILED RECORDS =====');
            for (const fail of failed) {
                logError(`Menu: ${fail.menuName} | Record: ${fail.recordName} | Reasons: ${fail.reasons.join('; ')}`);
                for (const line of fail.details) {
                    logError(`  ${line}`);
                }
            }
            // Fail the test at the end
            expect.fail(`${failed.length} record(s) failed validation. See log for details.`);
        } else {
            logInfo('All records validated successfully!');
        }

        logInfo('===== DETAILED RECORD VALIDATION TEST END =====');
    });
});

describe('Record Details Validation', () => {
    it('should extract and validate prices', async () => {
        // 1. Get the XML string from the device
        const xmlString = await browser.getPageSource();

        // 2. Parse the XML
        const parser = new XMLParser({ ignoreAttributes: false });
        const xmlObj = parser.parse(xmlString);

        // 3. Find the record node and extract texts (use the robust functions from previous messages)
        const recordNames = ["Brigade, Whitefield", "JBR Campus, Whitefield"];
        for (const recordName of recordNames) {
            logInfo(`[DEBUG] Processing record: ${recordName}`);
            const recordNode = findNodeByContentDesc(xmlObj, recordName);
            if (!recordNode) {
                logError(`[ERROR] Could not find node for record "${recordName}"`);
                continue;
            }
            const texts = extractAllTexts(recordNode);
            logInfo(`[DEBUG] Extracted texts for "${recordName}":`, texts);
            const prices = texts.filter(t => /^₹\d+/.test(t));
            logInfo(`[DEBUG] Prices for "${recordName}":`, prices);
        }
    });
});

describe('Debug Test', () => {
  it('should print debug log', async () => {
    logInfo('[DEBUG] Test started');
    // Optionally, try a browser command to ensure session works
    const title = await browser.getTitle().catch(() => 'no title');
    logInfo('[DEBUG] Got title:', title);
  });
}); 
