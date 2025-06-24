const fs = require('fs');
const path = require('path');

class TestReporter {
    constructor() {
        this.testResults = {
            summary: {
                totalTests: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                startTime: null,
                endTime: null,
                duration: 0
            },
            details: [],
            menus: {}
        };
    }

    startTest() {
        this.testResults.summary.startTime = new Date();
    }

    endTest() {
        this.testResults.summary.endTime = new Date();
        this.testResults.summary.duration = this.testResults.summary.endTime - this.testResults.summary.startTime;
    }

    addMenuResult(menuName, results) {
        if (!this.testResults.menus[menuName]) {
            this.testResults.menus[menuName] = {
                name: menuName,
                totalRecords: 0,
                passedRecords: 0,
                failedRecords: 0,
                records: []
            };
        }

        const menu = this.testResults.menus[menuName];
        menu.totalRecords += results.length;

        results.forEach(result => {
            menu.records.push(result);
            if (result.status === 'PASS') {
                menu.passedRecords++;
            } else {
                menu.failedRecords++;
            }
        });

        // Update summary
        this.testResults.summary.totalTests += results.length;
        this.testResults.summary.passed += results.filter(r => r.status === 'PASS').length;
        this.testResults.summary.failed += results.filter(r => r.status === 'FAIL').length;
    }

    generateHTMLReport() {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appium Test Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .summary-card.passed {
            border-left: 5px solid #28a745;
        }
        
        .summary-card.failed {
            border-left: 5px solid #dc3545;
        }
        
        .summary-card.total {
            border-left: 5px solid #007bff;
        }
        
        .summary-card.duration {
            border-left: 5px solid #ffc107;
        }
        
        .summary-card h3 {
            font-size: 2em;
            margin-bottom: 5px;
        }
        
        .summary-card.passed h3 {
            color: #28a745;
        }
        
        .summary-card.failed h3 {
            color: #dc3545;
        }
        
        .summary-card.total h3 {
            color: #007bff;
        }
        
        .summary-card.duration h3 {
            color: #ffc107;
        }
        
        .menu-section {
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            overflow: hidden;
        }
        
        .menu-header {
            background: #f8f9fa;
            padding: 15px 20px;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .menu-header h3 {
            color: #495057;
            font-size: 1.2em;
        }
        
        .menu-stats {
            display: flex;
            gap: 15px;
        }
        
        .stat {
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 0.9em;
            font-weight: bold;
        }
        
        .stat.passed {
            background: #d4edda;
            color: #155724;
        }
        
        .stat.failed {
            background: #f8d7da;
            color: #721c24;
        }
        
        .stat.total {
            background: #d1ecf1;
            color: #0c5460;
        }
        
        .records-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .records-table th,
        .records-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        
        .records-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }
        
        .status-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-pass {
            background: #d4edda;
            color: #155724;
        }
        
        .status-fail {
            background: #f8d7da;
            color: #721c24;
        }
        
        .status-suggestion {
            background: #fff3cd;
            color: #856404;
        }
        
        .details-cell {
            max-width: 300px;
            word-wrap: break-word;
        }
        
        .details-list {
            list-style: none;
            padding: 0;
        }
        
        .details-list li {
            padding: 2px 0;
            font-size: 0.9em;
        }
        
        .check-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 0;
            border-bottom: 1px solid #eee;
        }
        
        .check-item:last-child {
            border-bottom: none;
        }
        
        .check-field {
            font-weight: bold;
            color: #495057;
        }
        
        .check-status {
            margin-left: 10px;
        }
        
        .timestamp {
            color: #6c757d;
            font-size: 0.9em;
        }
        
        .footer {
            text-align: center;
            padding: 20px;
            color: #6c757d;
            font-size: 0.9em;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .summary-cards {
                grid-template-columns: 1fr;
            }
            
            .menu-header {
                flex-direction: column;
                gap: 10px;
            }
            
            .records-table {
                font-size: 0.9em;
            }
            
            .records-table th,
            .records-table td {
                padding: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 Appium Mobile Test Report</h1>
            <p>Record Details Validation Test Results</p>
        </div>
        
        <div class="summary-cards">
            <div class="summary-card total">
                <h3>${this.testResults.summary.totalTests}</h3>
                <p>Total Records</p>
            </div>
            <div class="summary-card passed">
                <h3>${this.testResults.summary.passed}</h3>
                <p>Passed</p>
            </div>
            <div class="summary-card failed">
                <h3>${this.testResults.summary.failed}</h3>
                <p>Failed</p>
            </div>
            <div class="summary-card duration">
                <h3>${this.formatDuration(this.testResults.summary.duration)}</h3>
                <p>Duration</p>
            </div>
        </div>
        
        ${this.generateMenuSections()}
        
        <div class="footer">
            <p>Report generated on ${new Date().toLocaleString()}</p>
            <p>Test Environment: Appium + WebdriverIO</p>
        </div>
    </div>
    
    <script>
        // Add interactivity
        document.addEventListener('DOMContentLoaded', function() {
            // Add click handlers for expandable sections
            const menuHeaders = document.querySelectorAll('.menu-header');
            menuHeaders.forEach(header => {
                header.addEventListener('click', function() {
                    const table = this.nextElementSibling;
                    if (table.style.display === 'none') {
                        table.style.display = 'table';
                        this.style.cursor = 'default';
                    } else {
                        table.style.display = 'none';
                        this.style.cursor = 'pointer';
                    }
                });
            });
        });
    </script>
</body>
</html>`;

        return html;
    }

    generateMenuSections() {
        let sections = '';
        
        Object.values(this.testResults.menus).forEach(menu => {
            const passRate = menu.totalRecords > 0 ? ((menu.passedRecords / menu.totalRecords) * 100).toFixed(1) : 0;
            
            sections += `
                <div class="menu-section">
                    <div class="menu-header">
                        <h3>${menu.name}</h3>
                        <div class="menu-stats">
                            <span class="stat total">Total: ${menu.totalRecords}</span>
                            <span class="stat passed">Passed: ${menu.passedRecords}</span>
                            <span class="stat failed">Failed: ${menu.failedRecords}</span>
                            <span class="stat">Pass Rate: ${passRate}%</span>
                        </div>
                    </div>
                    <table class="records-table">
                        <thead>
                            <tr>
                                <th>Record Name</th>
                                <th>Status</th>
                                <th>Checks</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.generateRecordRows(menu.records)}
                        </tbody>
                    </table>
                </div>
            `;
        });
        
        return sections;
    }

    generateRecordRows(records) {
        return records.map(record => {
            const statusClass = record.status === 'PASS' ? 'status-pass' : 'status-fail';
            const checks = this.formatChecks(record);
            const details = this.formatDetails(record);
            
            return `
                <tr>
                    <td><strong>${record.recordName}</strong></td>
                    <td><span class="status-badge ${statusClass}">${record.status}</span></td>
                    <td class="details-cell">${checks}</td>
                    <td class="details-cell">${details}</td>
                </tr>
            `;
        }).join('');
    }

    formatChecks(record) {
        if (!record.details || record.details.length === 0) {
            return '<em>No checks performed</em>';
        }
        
        const checkDetails = record.details.filter(detail => detail.includes('[CHECK]'));
        if (checkDetails.length === 0) {
            return '<em>No check details available</em>';
        }
        
        return `
            <ul class="details-list">
                ${checkDetails.map(check => {
                    const parts = check.split('|').map(p => p.trim());
                    if (parts.length >= 4) {
                        const field = parts[0].replace('[CHECK] Field:', '').trim();
                        const expected = parts[1].replace('Expected:', '').trim();
                        const actual = parts[2].replace('Actual:', '').trim();
                        const status = parts[3].replace('Status:', '').trim();
                        
                        const statusClass = status === 'PASS' ? 'status-pass' : 
                                          status === 'FAIL' ? 'status-fail' : 'status-suggestion';
                        
                        return `
                            <li>
                                <div class="check-item">
                                    <span class="check-field">${field}</span>
                                    <span class="check-status">
                                        <span class="status-badge ${statusClass}">${status}</span>
                                    </span>
                                </div>
                                <div style="font-size: 0.8em; color: #6c757d;">
                                    Expected: ${expected} | Actual: ${actual}
                                </div>
                            </li>
                        `;
                    }
                    return `<li>${check}</li>`;
                }).join('')}
            </ul>
        `;
    }

    formatDetails(record) {
        if (!record.details || record.details.length === 0) {
            return '<em>No details available</em>';
        }
        
        const details = record.details.filter(detail => !detail.includes('[CHECK]'));
        
        return `
            <ul class="details-list">
                ${details.map(detail => `<li>${detail}</li>`).join('')}
            </ul>
        `;
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    saveReport(outputPath = 'test-reports') {
        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const htmlPath = path.join(outputPath, `test-report-${timestamp}.html`);
        const jsonPath = path.join(outputPath, `test-results-${timestamp}.json`);

        // Save HTML report
        fs.writeFileSync(htmlPath, this.generateHTMLReport());

        // Save JSON data
        fs.writeFileSync(jsonPath, JSON.stringify(this.testResults, null, 2));

        console.log(`📊 Test report generated:`);
        console.log(`   HTML: ${htmlPath}`);
        console.log(`   JSON: ${jsonPath}`);

        return { htmlPath, jsonPath };
    }

    // Generate summary for console output
    generateConsoleSummary() {
        const summary = this.testResults.summary;
        const passRate = summary.totalTests > 0 ? ((summary.passed / summary.totalTests) * 100).toFixed(1) : 0;

        console.log('\n' + '='.repeat(60));
        console.log('📱 APPIUM TEST REPORT SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Records: ${summary.totalTests}`);
        console.log(`Passed: ${summary.passed} (${passRate}%)`);
        console.log(`Failed: ${summary.failed}`);
        console.log(`Duration: ${this.formatDuration(summary.duration)}`);
        console.log('='.repeat(60));

        // Menu-wise breakdown
        Object.values(this.testResults.menus).forEach(menu => {
            const menuPassRate = menu.totalRecords > 0 ? ((menu.passedRecords / menu.totalRecords) * 100).toFixed(1) : 0;
            console.log(`${menu.name}: ${menu.passedRecords}/${menu.totalRecords} passed (${menuPassRate}%)`);
        });

        console.log('='.repeat(60));
    }
}

module.exports = TestReporter; 