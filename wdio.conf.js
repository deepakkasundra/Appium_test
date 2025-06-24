exports.config = {
    user: process.env.BROWSERSTACK_USERNAME || 'deepak_7JKZUg',
    key: process.env.BROWSERSTACK_ACCESS_KEY || 'pg9bGgNJdyEskwseQgGU',
    services: ['browserstack'],
    runner: 'local',

    specs: [
        './test/specs/**/*.js'
    ],
    exclude: [],
    maxInstances: 1,

    capabilities: [
        {
            platformName: 'android',
            'appium:deviceName': 'Samsung Galaxy S22 Ultra',
            'appium:platformVersion': '12.0',
            'appium:automationName': 'UiAutomator2',
            'appium:app': 'bs://582b1b38cda5b551da00dce0cfd3ed3410d4dc0b',
            'bstack:options': {
                projectName: 'BrowserStack Sample',
                buildName: 'com.bhive.workspace',
                sessionName: 'Samsung S22 Ultra Test',
                debug: true,
                networkLogs: true,
                local: true,
                CUSTOM_TAG_1: 'You can set a custom Build Tag here'
            }
        },
        {
            platformName: 'android',
            'appium:deviceName': 'Google Pixel 7 Pro',
            'appium:platformVersion': '13.0',
            'appium:automationName': 'UiAutomator2',
            'appium:app': 'bs://582b1b38cda5b551da00dce0cfd3ed3410d4dc0b',
            'bstack:options': {
                projectName: 'BrowserStack Sample',
                buildName: 'com.bhive.workspace',
                sessionName: 'Pixel 7 Pro Test',
                debug: true,
                networkLogs: true,
                local: true
            }
        },
        {
            platformName: 'android',
            'appium:deviceName': 'OnePlus 9',
            'appium:platformVersion': '11.0',
            'appium:automationName': 'UiAutomator2',
            'appium:app': 'bs://582b1b38cda5b551da00dce0cfd3ed3410d4dc0b',
            'bstack:options': {
                projectName: 'BrowserStack Sample',
                buildName: 'com.bhive.workspace',
                sessionName: 'OnePlus 9 Test',
                debug: true,
                networkLogs: true,
                local: true
            }
        }
    ],

    logLevel: 'info',
    bail: 0,
    baseUrl: 'http://localhost',
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,

    framework: 'mocha',
    reporters: ['spec'],

    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    }
};
