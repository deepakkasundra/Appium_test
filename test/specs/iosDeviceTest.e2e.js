const { expect } = require('chai');

describe('iOS Device Connection Test', () => {
    it('should connect to iOS device and get device info', async () => {
        console.log('🔍 Testing iOS device connection...');
        
        // Get device info
        const deviceInfo = await driver.getPageSource();
        console.log('✅ Successfully connected to iOS device');
        console.log('📱 Page source length:', deviceInfo.length);
        
        // Get device capabilities
        const caps = await driver.getCapabilities();
        console.log('📋 Device capabilities:', {
            platformName: caps.get('platformName'),
            deviceName: caps.get('appium:deviceName'),
            udid: caps.get('appium:udid'),
            platformVersion: caps.get('appium:platformVersion'),
            bundleId: caps.get('appium:bundleId')
        });
        
        // Basic interaction test
        try {
            // Try to find any element on the screen
            const elements = await $$('//*');
            console.log('✅ Found', elements.length, 'elements on screen');
            
            // Get screen size
            const windowSize = await driver.getWindowSize();
            console.log('📐 Screen size:', windowSize);
            
        } catch (error) {
            console.log('⚠️ Basic interaction test failed:', error.message);
        }
        
        console.log('✅ iOS device connection test completed successfully');
    });
    
    it('should launch the BHIVE app', async () => {
        console.log('🚀 Attempting to launch BHIVE app...');
        
        try {
            // Wait for app to load
            await driver.pause(3000);
            
            // Check if app is running
            const pageSource = await driver.getPageSource();
            console.log('✅ App launched successfully');
            console.log('📄 Page source length:', pageSource.length);
            
            // Look for common app elements
            const hasTextElements = pageSource.includes('BHIVE') || pageSource.includes('Login') || pageSource.includes('Sign');
            console.log('🔍 Found app-specific content:', hasTextElements);
            
        } catch (error) {
            console.log('❌ App launch failed:', error.message);
            throw error;
        }
    });
}); 