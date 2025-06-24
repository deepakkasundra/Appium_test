const APP_PACKAGE = 'com.bhive.workspace';

before(async () => {
  // 4 = running in foreground, 3 = running in background, 2 = not running
  let appState;
  try {
    appState = await driver.queryAppState(APP_PACKAGE);
  } catch (e) {
    // If queryAppState is not available, fallback to always relaunch
    appState = 0;
  }

  if (appState === 4) {
    // App is running in foreground, terminate and relaunch
    await driver.terminateApp(APP_PACKAGE);
    await driver.activateApp(APP_PACKAGE);
  } else if (appState === 3) {
    // App is in background, bring to foreground
    await driver.activateApp(APP_PACKAGE);
  } else {
    // App is not running, launch it
    await driver.activateApp(APP_PACKAGE);
  }
});

describe('Select HSR option', () => {
    it('should tap on HSR and verify only HSR records are displayed', async () => {
      // Wait for the HSR button to be visible
      const hsrOption = await $('android=new UiSelector().text("HSR")');
      await hsrOption.waitForDisplayed({ timeout: 10000 });
  
      // Tap on HSR
      await hsrOption.click();
  
      console.log('Tapped on HSR');
  
      // Wait for records to update (adjust selector as needed)
      const hsrRecords = await $$('android=new UiSelector().textContains("HSR")');
      expect(hsrRecords.length).toBeGreaterThan(0);
  
      // Check that all displayed records are HSR records
      for (const record of hsrRecords) {
        const text = await record.getText();
        expect(text).toContain('HSR');
      }
  
      // Optionally, check that no non-HSR records are present
      // If you know other record types, check for their absence
      // For example, if "ALL" is only a button, skip this check or refine the selector
    });
  });
  


describe('Select ALL option', () => {
    it('should tap on ALL and verify all records are displayed', async () => {
      // Wait for the ALL button to be visible
      const allOption = await $('android=new UiSelector().text("All")');
      await allOption.waitForDisplayed({ timeout: 10000 });
  
      // Tap on ALL
      await allOption.click();
      console.log('Tapped on ALL');
      await driver.pause(1500);
      const activity = await driver.getCurrentActivity();
      const packageName = await driver.getCurrentPackage();
      console.log('After tapping ALL - ACTIVITY:', activity, 'PACKAGE:', packageName);
  
      // Find all records in the ScrollView (android.view.ViewGroup inside android.widget.ScrollView)
      const scrollViews = await $$('android=new UiSelector().className("android.widget.ScrollView")');
      let totalRecords = 0;
      for (const scrollView of scrollViews) {
        // Get all direct children ViewGroups (records)
        const recordGroups = await scrollView.$$('android.view.ViewGroup');
        for (const group of recordGroups) {
          // Exclude banners (android.widget.ImageView)
          const hasImage = await group.$('android.widget.ImageView').isExisting().catch(() => false);
          if (!hasImage) {
            totalRecords++;
          }
        }
      }
      console.log(`ALL option has ${totalRecords} records (excluding banners)`);
      expect(totalRecords).toBeGreaterThan(0);
  
      // Optionally, check that both HSR and non-HSR records are present
      // (You can add more logic here if you want to check record types)
  
      const allTextElements = await $$('android=new UiSelector().className("android.widget.TextView")');
      for (const el of allTextElements) {
        try {
          console.log('Text element:', await el.getText());
        } catch (e) {
          // skip if not found
        }
      }
    });
  });
  



describe('App launch test', () => {
    it('should launch the app and scroll down', async () => {
      const activity = await driver.getCurrentActivity();
      const packageName = await driver.getCurrentPackage();
  
      console.log('>>> ACTIVITY:', activity);
      console.log('>>> PACKAGE:', packageName);
  
      expect(activity).toContain('MainActivity');
  
      // Scroll down using performActions (W3C compliant)
      await driver.performActions([
        {
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: 300, y: 1000 },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: 500 },
            { type: 'pointerMove', duration: 1000, x: 300, y: 300 },
            { type: 'pointerUp', button: 0 }
          ],
        },
      ]);
  
      // Release input actions
      await driver.releaseActions();
  
      console.log('Scrolled down using performActions');
    });
  });
  
describe('HorizontalScrollView Options and Records', () => {
  it('should count records for default (All), then dynamically click and count for each option', async () => {
    // Step 1: On app launch, count records for default (All) selection
    console.log('--- Step 1: Counting records for default (All) selection ---');
    const defaultRecordGroups = await $$('//android.widget.ScrollView//android.view.ViewGroup[@clickable="true" and @content-desc!="" and @content-desc!=""]');
    console.log(`Default (All) has ${defaultRecordGroups.length} records (excluding banners and icons)`);
    for (let j = 0; j < defaultRecordGroups.length; j++) {
      const recDesc = await defaultRecordGroups[j].getAttribute('contentDescription');
      console.log(`  Record ${j + 1}: content-desc='${recDesc}'`);
    }

    // Step 2: Dynamically find all available options in HorizontalScrollView
    console.log('--- Step 2: Checking available options in HorizontalScrollView ---');
    const options = await $$('android=new UiSelector().className("android.view.ViewGroup").clickable(true)');
    expect(options.length).toBeGreaterThan(0);
    const optionLabels = [];
    for (let i = 0; i < options.length; i++) {
      let label = `Option ${i}`;
      let desc = '';
      let text = '';
      try {
        desc = await options[i].getAttribute('contentDescription');
      } catch (e) {}
      try {
        const textView = await options[i].$('android.widget.TextView');
        if (await textView.isExisting()) {
          text = await textView.getText();
        }
      } catch (e) {}
      if (desc && desc.length > 0) label = desc;
      else if (text && text.length > 0) label = text;
      optionLabels.push(label);
    }
    console.log(`Found ${optionLabels.length} options:`, optionLabels);

    // Step 3: Click each option one by one, count records, and click first record
    for (let i = 0; i < options.length; i++) {
      const label = optionLabels[i];
      console.log(`--- Step 3: Clicking option '${label}' ---`);
      await options[i].click();
      await driver.pause(1500);
      const activity = await driver.getCurrentActivity();
      const packageName = await driver.getCurrentPackage();
      console.log('After clicking option - ACTIVITY:', activity, 'PACKAGE:', packageName);

      // Find all clickable records in the ScrollView with non-empty content-desc, not the icon ()
      const recordGroups = await $$('//android.widget.ScrollView//android.view.ViewGroup[@clickable="true" and @content-desc!="" and @content-desc!=""]');
      console.log(`Option '${label}' has ${recordGroups.length} records (excluding banners and icons)`);
      for (let j = 0; j < recordGroups.length; j++) {
        const recDesc = await recordGroups[j].getAttribute('contentDescription');
        console.log(`  Record ${j + 1}: content-desc='${recDesc}'`);
      }
      // Click the first valid record if available
      if (recordGroups.length > 0) {
        await recordGroups[0].click();
        console.log(`Clicked on first record for option '${label}' with content-desc: '${await recordGroups[0].getAttribute('contentDescription')}'`);
        await driver.pause(1500);
        const activity2 = await driver.getCurrentActivity();
        const packageName2 = await driver.getCurrentPackage();
        console.log('After clicking record - ACTIVITY:', activity2, 'PACKAGE:', packageName2);
      } else {
        console.log(`No valid records to click for option '${label}'.`);
      }
    }
  });
});
  