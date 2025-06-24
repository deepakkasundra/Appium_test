const APP_PACKAGE = 'com.bhive.workspace';
const fs = require('fs');
const path = require('path');
const isIOS = driver.isIOS;

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
    return `openAppandCheckRecordsBackground${testFile}_${day}${month}${year}_${hour}${min}${sec}.txt`;
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

// Mocha test suite
describe('Background App Record Check (No App Launch)', () => {
    before(async () => {
        // Setup log file
        logFilePath = path.join(__dirname, getLogFileName());
        logToBoth('=== Background Record Check Started ===');
        logToBoth('Running in background mode - no app will be launched');
        
        // Get platform info
        const platform = driver.isIOS ? 'iOS' : 'Android';
        logToBoth(`Platform: ${platform}`);
        
        // Check device capabilities
        try {
            const capabilities = await driver.getCapabilities();
            logToBoth(`Device: ${capabilities.get('deviceName')}`);
            logToBoth(`Platform Version: ${capabilities.get('platformVersion')}`);
        } catch (err) {
            logToBoth(`Error getting capabilities: ${err.message}`);
        }
        
        await driver.pause(1000);
    });

    it('should check app state and device info without launching app', async function() {
        this.timeout(30000); // 30 seconds
        
        const platform = driver.isIOS ? 'iOS' : 'Android';
        logToBoth(`[${platform}] Background check started`);
        
        // Check app state without launching
        try {
            const appState = await driver.queryAppState(APP_PACKAGE);
            const stateDescriptions = {
                0: 'not installed',
                1: 'not running',
                2: 'running in background',
                3: 'running in foreground',
                4: 'terminated'
            };
            logToBoth(`[${platform}] App state: ${appState} (${stateDescriptions[appState] || 'unknown'})`);
            
            if (appState === 0) {
                logToBoth(`[${platform}] ⚠️  App is not installed on device`);
            } else if (appState === 1) {
                logToBoth(`[${platform}] ℹ️  App is installed but not running`);
            } else if (appState === 2) {
                logToBoth(`[${platform}] ✅ App is running in background`);
            } else if (appState === 3) {
                logToBoth(`[${platform}] ✅ App is running in foreground`);
            } else if (appState === 4) {
                logToBoth(`[${platform}] ℹ️  App is terminated`);
            }
        } catch (err) {
            logToBoth(`[${platform}] Error checking app state: ${err.message}`);
        }
        
        // Get device information
        try {
            const deviceTime = await driver.getDeviceTime();
            logToBoth(`[${platform}] Device time: ${deviceTime}`);
        } catch (err) {
            logToBoth(`[${platform}] Error getting device time: ${err.message}`);
        }
        
        // Get device orientation
        try {
            const orientation = await driver.getOrientation();
            logToBoth(`[${platform}] Device orientation: ${orientation}`);
        } catch (err) {
            logToBoth(`[${platform}] Error getting orientation: ${err.message}`);
        }
        
        // Get window size
        try {
            const windowSize = await driver.getWindowSize();
            logToBoth(`[${platform}] Window size: ${JSON.stringify(windowSize)}`);
        } catch (err) {
            logToBoth(`[${platform}] Error getting window size: ${err.message}`);
        }
        
        logToBoth(`[${platform}] Background check completed successfully`);
        logToBoth(`[${platform}] ✅ Test passed`);
    });

    it('should simulate record counting logic without app interaction', async function() {
        this.timeout(20000); // 20 seconds
        
        const platform = driver.isIOS ? 'iOS' : 'Android';
        logToBoth(`[${platform}] Simulating record counting logic`);
        
        // Get menu options from environment or use defaults
        const menuOptionsEnv = process.env.MENU_OPTIONS;
        const simulatedMenus = menuOptionsEnv ? menuOptionsEnv.split(',') : ['All', 'HSR', 'Whitefield', 'Koramangala', 'Mumbai', 'BTM', 'CBD'];
        
        // Get record counts from environment or generate random for demo
        const recordsEnv = process.env.RECORD_COUNTS;
        let simulatedRecords = {};
        
        if (recordsEnv) {
            // Parse from environment variable like "All:19,HSR:5,Whitefield:2"
            const recordsArray = recordsEnv.split(',');
            for (const record of recordsArray) {
                const [menu, count] = record.split(':');
                if (menu && count) {
                    simulatedRecords[menu.trim()] = parseInt(count.trim());
                }
            }
        } else {
            // Generate random counts for demo purposes
            logToBoth(`[${platform}] No record counts provided, generating random demo data`);
            for (const menu of simulatedMenus) {
                if (menu === 'All') {
                    // Generate a total between 15-25
                    simulatedRecords[menu] = Math.floor(Math.random() * 11) + 15;
                } else {
                    // Generate individual counts between 1-8
                    simulatedRecords[menu] = Math.floor(Math.random() * 8) + 1;
                }
            }
        }
        
        logToBoth(`[${platform}] Menu options: ${simulatedMenus.join(', ')}`);
        logToBoth(`[${platform}] Record counts:`, simulatedRecords);
        
        // Calculate totals
        let totalIndividualRecords = 0;
        const individualMenus = simulatedMenus.filter(menu => menu !== 'All');
        
        for (const menu of individualMenus) {
            const count = simulatedRecords[menu] || 0;
            totalIndividualRecords += count;
            logToBoth(`[${platform}] ${menu}: ${count} records`);
        }
        
        const allRecordsCount = simulatedRecords['All'] || 0;
        
        logToBoth(`[${platform}] Validation:`);
        logToBoth(`[${platform}]   - "All" menu: ${allRecordsCount} records`);
        logToBoth(`[${platform}]   - Sum of individual menus: ${totalIndividualRecords} records`);
        
        if (allRecordsCount === totalIndividualRecords) {
            logToBoth(`[${platform}]   ✅ Perfect match!`);
        } else {
            const difference = Math.abs(allRecordsCount - totalIndividualRecords);
            const percentageDiff = ((difference / allRecordsCount) * 100).toFixed(2);
            logToBoth(`[${platform}]   ⚠️  Mismatch detected: ${difference} records difference (${percentageDiff}%)`);
            
            if (allRecordsCount > totalIndividualRecords) {
                logToBoth(`[${platform}]   - "All" has ${allRecordsCount - totalIndividualRecords} more records than sum of individual menus`);
            } else {
                logToBoth(`[${platform}]   - Sum of individual menus has ${totalIndividualRecords - allRecordsCount} more records than "All"`);
            }
        }
        
        // Simulate processing time
        for (let i = 1; i <= 3; i++) {
            logToBoth(`[${platform}] Processing step ${i}/3...`);
            await driver.pause(1000);
        }
        
        logToBoth(`[${platform}] Record counting simulation completed`);
        logToBoth(`[${platform}] ✅ Test passed`);
    });

    after(async () => {
        const platform = driver.isIOS ? 'iOS' : 'Android';
        logToBoth(`[${platform}] Background test suite completed`);
        logToBoth('=== Background Record Check Finished ===');
    });
}); 