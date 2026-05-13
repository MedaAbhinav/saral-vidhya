/**
 * cleanup-firebase-versions.js
 * Lists and deletes old Firebase Hosting versions to free up storage quota.
 * Run: node cleanup-firebase-versions.js
 */

const { execSync } = require('child_process');
const https = require('https');

const SITE = 'ekam-expert-prod';
const KEEP = 3; // keep the most recent N versions

// Get auth token from firebase-tools
function getToken() {
  try {
    // firebase-tools stores token in config
    const result = execSync('firebase --token "" login --no-localhost 2>&1', { timeout: 3000 }).toString();
    console.log(result);
  } catch {}

  // Try reading from firebase-tools config file
  const os = require('os');
  const path = require('path');
  const fs = require('fs');

  const configPaths = [
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
    path.join(os.appDataDir || process.env.APPDATA || '', 'firebase-tools', 'config.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
  ];

  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
        const token = cfg.tokens?.access_token || cfg.token?.access_token;
        if (token) {
          console.log('✅ Found auth token from:', p);
          return token;
        }
      } catch {}
    }
  }
  return null;
}

function apiRequest(method, path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firebasehosting.googleapis.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const token = getToken();
  if (!token) {
    console.error('❌ Could not get Firebase auth token automatically.');
    console.log('\n📋 MANUAL STEPS to fix the quota issue:\n');
    console.log('1. Open: https://console.firebase.google.com/project/ekam-expert-prod/hosting/sites');
    console.log('2. Click on your site "ekam-expert-prod"');
    console.log('3. Scroll down to "Release History"');
    console.log('4. Delete all old releases EXCEPT the most recent one');
    console.log('5. Then run: firebase deploy --only hosting\n');
    console.log('OR upgrade to the Blaze (pay-as-you-go) plan for more storage.\n');
    console.log('Alternatively, run this in PowerShell to get a token:');
    console.log('  firebase login');
    console.log('  node -e "require(\'firebase-tools\').login.getAccessToken().then(t => console.log(t))"');
    return;
  }

  console.log(`\n📋 Listing versions for site: ${SITE}`);
  const listRes = await apiRequest('GET', `/v1beta1/sites/${SITE}/versions?pageSize=50`, token);

  if (listRes.status !== 200) {
    console.error('❌ Failed to list versions:', listRes.body);
    return;
  }

  const versions = listRes.body.versions || [];
  console.log(`Found ${versions.length} versions.`);

  // Sort by createTime descending (newest first)
  versions.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

  const toDelete = versions.slice(KEEP);
  console.log(`Keeping ${Math.min(KEEP, versions.length)} newest, deleting ${toDelete.length} old versions...\n`);

  for (const v of toDelete) {
    const name = v.name; // projects/-/sites/SITE/versions/VERSION_ID
    const versionId = name.split('/').pop();
    console.log(`🗑  Deleting version ${versionId} (created: ${v.createTime})`);
    const del = await apiRequest('DELETE', `/v1beta1/${name}`, token);
    if (del.status === 200 || del.status === 204) {
      console.log(`   ✅ Deleted`);
    } else {
      console.log(`   ⚠️  Status ${del.status}:`, del.body?.error?.message || del.body);
    }
  }

  console.log('\n✅ Done! Now try: firebase deploy --only hosting');
}

main().catch(console.error);
