const fs = require('fs');
const path = require('path');

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
    return `sampleTest${testFile}_${day}${month}${year}_${hour}${min}${sec}.txt`;
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

describe('Sample Test for Parallel Execution', () => {
    before(async () => {
        // Setup log file
        logFilePath = path.join(__dirname, getLogFileName());
        logToBoth('=== Sample Test Started ===');
        
        // Get platform info
        const platform = driver.isIOS ? 'iOS' : 'Android';
        logToBoth(`Running on platform: ${platform}`);
        
        // Get device info
        try {
            const deviceInfo = await driver.getDeviceTime();
            logToBoth(`Device time: ${deviceInfo}`);
        } catch (err) {
            logToBoth(`Could not get device time: ${err.message}`);
        }
        
        await driver.pause(1000);
    });

    it('should demonstrate parallel execution on both platforms', async function() {
        this.timeout(30000); // 30 seconds
        
        const platform = driver.isIOS ? 'iOS' : 'Android';
        const sessionId = driver.sessionId;
        
        logToBoth(`[${platform}] Test execution started - Session ID: ${sessionId}`);
        
        // Step 1: Get device capabilities
        try {
            const capabilities = await driver.getCapabilities();
            logToBoth(`[${platform}] Device name: ${capabilities.get('deviceName')}`);
            logToBoth(`[${platform}] Platform version: ${capabilities.get('platformVersion')}`);
            logToBoth(`[${platform}] Automation name: ${capabilities.get('automationName')}`);
        } catch (err) {
            logToBoth(`[${platform}] Error getting capabilities: ${err.message}`);
        }
        
        // Step 2: Simulate some work with delays
        logToBoth(`[${platform}] Step 1: Starting work...`);
        await driver.pause(2000);
        
        logToBoth(`[${platform}] Step 2: Processing data...`);
        await driver.pause(2000);
        
        logToBoth(`[${platform}] Step 3: Finalizing...`);
        await driver.pause(2000);
        
        // Step 3: Get device orientation
        try {
            const orientation = await driver.getOrientation();
            logToBoth(`[${platform}] Device orientation: ${orientation}`);
        } catch (err) {
            logToBoth(`[${platform}] Error getting orientation: ${err.message}`);
        }
        
        logToBoth(`[${platform}] Test execution completed successfully!`);
        
        // Test completed successfully
        logToBoth(`[${platform}] ✅ Test passed`);
    });

    it('should show different behavior based on platform', async function() {
        this.timeout(15000); // 15 seconds
        
        const platform = driver.isIOS ? 'iOS' : 'Android';
        
        logToBoth(`[${platform}] Platform-specific test started`);
        
        if (driver.isIOS) {
            logToBoth(`[${platform}] This is iOS - checking iOS specific features`);
            // iOS specific checks
            try {
                const isIOS = await driver.isIOS;
                logToBoth(`[${platform}] Is iOS device: ${isIOS}`);
            } catch (err) {
                logToBoth(`[${platform}] iOS check: ${err.message}`);
            }
        } else {
            logToBoth(`[${platform}] This is Android - checking Android specific features`);
            // Android specific checks
            try {
                const isAndroid = await driver.isAndroid;
                logToBoth(`[${platform}] Is Android device: ${isAndroid}`);
            } catch (err) {
                logToBoth(`[${platform}] Android check: ${err.message}`);
            }
        }
        
        // Get device size
        try {
            const windowSize = await driver.getWindowSize();
            logToBoth(`[${platform}] Window size: ${JSON.stringify(windowSize)}`);
        } catch (err) {
            logToBoth(`[${platform}] Error getting window size: ${err.message}`);
        }
        
        logToBoth(`[${platform}] Platform-specific test completed`);
        logToBoth(`[${platform}] ✅ Test passed`);
    });

    it('should perform basic device operations', async function() {
        this.timeout(20000); // 20 seconds
        
        const platform = driver.isIOS ? 'iOS' : 'Android';
        
        logToBoth(`[${platform}] Basic device operations test started`);
        
        // Get device info
        try {
            const deviceTime = await driver.getDeviceTime();
            logToBoth(`[${platform}] Device time: ${deviceTime}`);
        } catch (err) {
            logToBoth(`[${platform}] Error getting device time: ${err.message}`);
        }
        
        // Simulate some processing
        for (let i = 1; i <= 3; i++) {
            logToBoth(`[${platform}] Processing task ${i}/3...`);
            await driver.pause(1500);
        }
        
        // Get session info
        try {
            const sessionId = driver.sessionId;
            logToBoth(`[${platform}] Session ID: ${sessionId}`);
        } catch (err) {
            logToBoth(`[${platform}] Error getting session ID: ${err.message}`);
        }
        
        logToBoth(`[${platform}] Basic device operations completed`);
        logToBoth(`[${platform}] ✅ Test passed`);
    });

    after(async () => {
        const platform = driver.isIOS ? 'iOS' : 'Android';
        logToBoth(`[${platform}] Test suite completed`);
        logToBoth('=== Sample Test Finished ===');
    });
}); 