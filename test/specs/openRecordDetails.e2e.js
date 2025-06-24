const winston = require('winston');
const path = require('path');
const { getMenuNames } = require('../utils/menuRecordUtils');

const logDir = __dirname;
const logFile = path.join(logDir, 'openRecordDetails.log');

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
    return null;
}

describe('Open Specific Record Details', () => {
    it('should open a specific record in a specific menu', async () => {
        // Hardcoded menu and record description (content-desc)

        // HardCD name to test
        const menuName = 'HSR';
        const recordDesc = 'HSR Campus';

        logInfo('===== OPEN SPECIFIC RECORD DETAILS TEST START =====');
        await driver.pause(2000);
        logInfo(`[INFO] Scrolling to menu: ${menuName}`);
        const menuElem = await scrollMenuTo(menuName);
        if (!menuElem) {
            logWarn(`[ERROR] Menu '${menuName}' not found after bidirectional scrolling!`);
            return;
        }
        await menuElem.click();
        await driver.pause(2000);
        logInfo(`[INFO] Clicked menu: ${menuName}`);

        // Scroll to the record by accessibility id
        logInfo(`[INFO] Scrolling to record: ${recordDesc}`);
        await driver.execute('mobile: scroll', {strategy: 'accessibility id', selector: 'Day Pass, 0, ₹299/Day, , , '});
        await driver.pause(1000);

        // Try to find and click the record (try accessibility id, uiautomator, xpath)
        let recordElem = await $(`~Day Pass, 0, ₹299/Day, , , `);
        if (!(await recordElem.isExisting() && await recordElem.isDisplayed())) {
            recordElem = await $(`android=new UiSelector().description("Day Pass, 0, ₹299/Day, , , ").clickable(true)`);
        }
        if (!(await recordElem.isExisting() && await recordElem.isDisplayed())) {
            recordElem = await $(`//android.view.ViewGroup[@clickable="true" and @content-desc="Day Pass, 0, ₹299/Day, , , "]`);
        }
        if (recordElem && await recordElem.isExisting() && await recordElem.isDisplayed() && await recordElem.isEnabled()) {
            await recordElem.click();
            logInfo(`[SUCCESS] Clicked record: ${recordDesc}`);
            return;
        } else {
            logWarn(`[ERROR] Record '${recordDesc}' not found or not clickable!`);
        }

        const allRecords = await $$('//android.view.ViewGroup[@clickable="true" and string-length(@content-desc) > 0]');
        for (const elem of allRecords) {
            const desc = await elem.getAttribute('content-desc');
            logInfo(`Found clickable record: ${desc}`);
        }
    });
});