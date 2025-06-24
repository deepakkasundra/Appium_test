// Utility functions for menu and record discovery, with robust scrolling and dynamic collection.
// These are designed to be imported and reused in any test file.

/**
 * Discover all unique horizontal menu names by scrolling the menu bar.
 * @param {function} logInfo - Logging function to use for info logs.
 * @returns {Promise<string[]>} Array of unique menu names.
 */
async function getMenuNames(logInfo = () => {}) {
    const seen = new Set();
    let lastCount = 0;
    const maxScrolls = 10;
    logInfo(`[MENU DISCOVERY] Starting horizontal menu discovery...`);
    for (let scrolls = 0; scrolls < maxScrolls; scrolls++) {
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
        if (seen.size === lastCount) {
            logInfo(`[MENU DISCOVERY] No new menus found after scroll ${scrolls + 1}, stopping discovery.`);
            break;
        }
        lastCount = seen.size;
        // Scroll the horizontal menu bar to the right
        try {
            const scrollView = await $("//android.widget.HorizontalScrollView");
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
            await driver.pause(800);
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

/**
 * Scrolls through the records list and collects all unique records for the current menu.
 * @param {function} validateRecordCallback - Callback function to validate each record.
 * @param {function} logInfo - Logging function to use for info logs.
 * @returns {Promise<void>}
 */
async function getAllRecordsForMenu(validateRecordCallback, logInfo = () => {}) {
    const seen = new Set();
    let lastCount = 0;
    const maxScrolls = 100;
    let consecutiveNoNewRecords = 0;
    const maxConsecutiveNoNew = 3;
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
                desc.trim() !== '' &&
                desc.trim().length > 1
            ) {
                const fullDesc = desc.trim();
                if (!seen.has(fullDesc)) {
                    newRecords.push(fullDesc);
                    seen.add(fullDesc);
                    await validateRecordCallback(elem, fullDesc);
                } else {
                    duplicateRecords.push(fullDesc);
                }
            }
        }
        if (newRecords.length > 0) {
            logInfo(`[SCROLL ${scrolls + 1}] New records found:`, newRecords);
            consecutiveNoNewRecords = 0;
        } else {
            consecutiveNoNewRecords++;
            logInfo(`[SCROLL ${scrolls + 1}] No new records found. (Consecutive: ${consecutiveNoNewRecords})`);
        }
        if (duplicateRecords.length > 0) {
            logInfo(`[SCROLL ${scrolls + 1}] Already seen records (re-appearing during scroll):`, duplicateRecords);
        }
        if (consecutiveNoNewRecords >= maxConsecutiveNoNew) {
            logInfo(`[SCROLL ${scrolls + 1}] Reached end of list after ${consecutiveNoNewRecords} consecutive scrolls with no new records.`);
            break;
        }
        if (seen.size === lastCount) {
            logInfo(`[SCROLL ${scrolls + 1}] No new records found, but continuing to ensure we reach the end...`);
        }
        lastCount = seen.size;
        // Scroll down with overlap
        const scrollView = await $('//android.widget.ScrollView');
        const location = await scrollView.getLocation();
        const size = await scrollView.getSize();
        const x = location.x + size.width / 2;
        const startY = location.y + size.height * 0.8;
        const endY = location.y + size.height * 0.3;
        await driver.performActions([
            {
                type: 'pointer',
                id: 'finger1',
                parameters: { pointerType: 'touch' },
                actions: [
                    { type: 'pointerMove', duration: 0, x: x, y: startY },
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: 300 },
                    { type: 'pointerMove', duration: 1000, x: x, y: endY },
                    { type: 'pointerUp', button: 0 }
                ]
            }
        ]);
        await driver.releaseActions();
        await driver.pause(2000);
    }
    logInfo(`[FINAL] Total unique records collected: ${seen.size}`);
}

/**
 * Scrolls through the records list and collects all unique record elements for the current menu.
 * @param {function} logInfo - Logging function to use for info logs.
 * @returns {Promise<Array<{desc: string, elem: WebdriverIO.Element}>>} Array of objects with content-desc and element handle.
 */
async function getAllRecordElementsForMenu(logInfo = () => {}) {
    const seen = new Set();
    const results = [];
    let lastCount = 0;
    const maxScrolls = 100;
    let consecutiveNoNewRecords = 0;
    const maxConsecutiveNoNew = 3;
    for (let scrolls = 0; scrolls < maxScrolls; scrolls++) {
        const recordElems = await $$('//android.widget.ScrollView//android.view.ViewGroup[@clickable="true" and string-length(@content-desc) > 0 and not(contains(@content-desc, "Day Pass")) and not(contains(@content-desc, "Bulk Day Pass")) and not(@content-desc="")]');
        let newRecords = [];
        for (const elem of recordElems) {
            const desc = await elem.getAttribute('content-desc');
            if (
                desc &&
                desc.trim() !== '' &&
                !desc.includes('Day Pass') &&
                !desc.includes('Bulk Day Pass') &&
                desc.trim().length > 1
            ) {
                const fullDesc = desc.trim();
                if (!seen.has(fullDesc)) {
                    newRecords.push(fullDesc);
                    seen.add(fullDesc);
                    results.push({ desc: fullDesc, elem });
                }
            }
        }
        if (newRecords.length > 0) {
            logInfo(`[SCROLL ${scrolls + 1}] New records found:`, newRecords);
            consecutiveNoNewRecords = 0;
        } else {
            consecutiveNoNewRecords++;
            logInfo(`[SCROLL ${scrolls + 1}] No new records found. (Consecutive: ${consecutiveNoNewRecords})`);
        }
        if (consecutiveNoNewRecords >= maxConsecutiveNoNew) {
            logInfo(`[SCROLL ${scrolls + 1}] Reached end of list after ${consecutiveNoNewRecords} consecutive scrolls with no new records.`);
            break;
        }
        lastCount = seen.size;
        // Scroll down with overlap
        const scrollView = await $('//android.widget.ScrollView');
        const location = await scrollView.getLocation();
        const size = await scrollView.getSize();
        const x = location.x + size.width / 2;
        const startY = location.y + size.height * 0.8;
        const endY = location.y + size.height * 0.3;
        await driver.performActions([
            {
                type: 'pointer',
                id: 'finger1',
                parameters: { pointerType: 'touch' },
                actions: [
                    { type: 'pointerMove', duration: 0, x: x, y: startY },
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: 300 },
                    { type: 'pointerMove', duration: 1000, x: x, y: endY },
                    { type: 'pointerUp', button: 0 }
                ]
            }
        ]);
        await driver.releaseActions();
        await driver.pause(2000);
    }
    logInfo(`[FINAL] Total unique records collected: ${results.length}`);
    return results;
}

module.exports = {
    getMenuNames,
    getAllRecordsForMenu,
    getAllRecordElementsForMenu
}; 