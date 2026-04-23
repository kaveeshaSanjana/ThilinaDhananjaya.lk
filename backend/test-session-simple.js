/**
 * Simple Session Attendance API Test with Error Details
 */

const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:3001';

// Simple HTTP request helper
function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 3001,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            body: parsed,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n' + '═'.repeat(80));
  console.log('SESSION ATTENDANCE API - ERROR DIAGNOSTICS TEST');
  console.log('═'.repeat(80));

  // Test data with SAME times
  const TEST_TIMES = {
    checkInAt: '2026-04-22T10:15:00.000Z',
    checkOutAt: '2026-04-22T11:00:00.000Z',
  };

  console.log('\n✏️  Test Configuration:');
  console.log(`   Input checkInAt:  ${TEST_TIMES.checkInAt}`);
  console.log(`   Input checkOutAt: ${TEST_TIMES.checkOutAt}`);

  // Test 1: Single Student with minimal data
  console.log('\n' + '─'.repeat(80));
  console.log('TEST 1: Single Student Session Attendance Check');
  console.log('─'.repeat(80));

  const singleTest = {
    sessionId: 'test-session-uuid',
    instituteId: 'TD-TEST-00001',
    classId: 'test-class-uuid',
    checkInAt: TEST_TIMES.checkInAt,
    checkOutAt: TEST_TIMES.checkOutAt,
    note: 'Test request',
  };

  console.log('\n📤 Request Body:');
  console.log(JSON.stringify(singleTest, null, 2));

  try {
    const singleResponse = await makeRequest('POST', '/api/public/attendance/session/check', singleTest);
    console.log('\n📥 Response Status:', singleResponse.status);
    console.log('📥 Response Body:');
    console.log(JSON.stringify(singleResponse.body, null, 2));

    // Verify times
    if (singleResponse.status === 200 && singleResponse.body.attendance) {
      console.log('\n✅ TIME VERIFICATION:');
      console.log(`Input checkInAt:    ${TEST_TIMES.checkInAt}`);
      console.log(`Response checkInAt: ${singleResponse.body.attendance.checkInAt}`);
      console.log(`Match: ${TEST_TIMES.checkInAt === singleResponse.body.attendance.checkInAt ? '✅ YES' : '❌ NO'}`);
    }
  } catch (error) {
    console.log('\n❌ Error:', error.message);
  }

  // Test 2: Bulk with SAME times for all students
  console.log('\n' + '─'.repeat(80));
  console.log('TEST 2: Bulk Session Attendance Check (3 students with SAME times)');
  console.log('─'.repeat(80));

  const bulkTest = {
    sessionId: 'test-session-uuid',
    classId: 'test-class-uuid',
    records: [
      {
        studentInstituteId: 'TD-TEST-00001',
        checkInAt: TEST_TIMES.checkInAt,
        checkOutAt: TEST_TIMES.checkOutAt,
        note: 'Student 1',
      },
      {
        studentInstituteId: 'TD-TEST-00002',
        checkInAt: TEST_TIMES.checkInAt,  // SAME time
        checkOutAt: TEST_TIMES.checkOutAt,  // SAME time
        note: 'Student 2',
      },
      {
        studentInstituteId: 'TD-TEST-00003',
        checkInAt: TEST_TIMES.checkInAt,  // SAME time
        checkOutAt: TEST_TIMES.checkOutAt,  // SAME time
        note: 'Student 3',
      },
    ],
  };

  console.log('\n📤 Request Body:');
  console.log(JSON.stringify(bulkTest, null, 2));

  try {
    const bulkResponse = await makeRequest('POST', '/api/public/attendance/session/bulk-check', bulkTest);
    console.log('\n📥 Response Status:', bulkResponse.status);
    console.log('📥 Response Body:');
    console.log(JSON.stringify(bulkResponse.body, null, 2));

    // Verify times match for each record
    if (bulkResponse.status === 200 && bulkResponse.body.successful) {
      console.log('\n✅ TIME VERIFICATION FOR SUCCESSFUL RECORDS:');
      bulkResponse.body.successful.forEach((record, index) => {
        console.log(`\nStudent ${index + 1} (${record.studentInstituteId}):`);
        console.log(`  Input times: ${TEST_TIMES.checkInAt} / ${TEST_TIMES.checkOutAt}`);
        if (record.timeValidation) {
          console.log(`  Time Validation: isOnTime=${record.timeValidation.isOnTime}, warning=${record.timeValidation.warning || 'none'}`);
        }
      });
    }
  } catch (error) {
    console.log('\n❌ Error:', error.message);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('SUMMARY: Test endpoints and review error messages above');
  console.log('═'.repeat(80) + '\n');
}

runTests().catch(console.error);
