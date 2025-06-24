#!/bin/bash
PLATFORM=android npx wdio run wdio.conf.js --spec test/specs/openAppAndCheckRecords.e2e.js > Output1.txt 2>&1
PLATFORM=android npx wdio run wdio.conf.js --spec test/specs/recordDetailsValidation.e2e.js > Output2.txt 2>&1
PLATFORM=android npx wdio run wdio.conf.js --spec test/specs/loginTest.e2e.js > Output3.txt 2>&1