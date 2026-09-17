const fs = require('fs');
const path = require('path');

const evidenceDir = path.join(__dirname, '..', 'evidence');
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

const images = [
  {
    src: 'C:/Users/USER/.gemini/antigravity-ide/brain/ff5acb6c-d673-4fbf-9f4c-53e24adddb0c/audit_log_after_deletion_1789619822202.jpg',
    dest: 'audit_log_after_deletion.png',
  },
  {
    src: 'C:/Users/USER/.gemini/antigravity-ide/brain/ff5acb6c-d673-4fbf-9f4c-53e24adddb0c/url_public_identifier_idor_prevention_1789619842417.jpg',
    dest: 'url_public_identifier_idor_prevention.png',
  },
  {
    src: 'C:/Users/USER/.gemini/antigravity-ide/brain/ff5acb6c-d673-4fbf-9f4c-53e24adddb0c/access_denied_403_idor_attack_1789619866568.jpg',
    dest: 'access_denied_403_idor_attack.png',
  },
  {
    src: 'C:/Users/USER/.gemini/antigravity-ide/brain/ff5acb6c-d673-4fbf-9f4c-53e24adddb0c/empty_state_and_records_view_1789619889423.jpg',
    dest: 'empty_state_and_records_view.png',
  },
];

for (const img of images) {
  const destPath = path.join(evidenceDir, img.dest);
  try {
    const data = fs.readFileSync(img.src);
    fs.writeFileSync(destPath, data);
    console.log(`Copied ${img.dest} (${data.length} bytes)`);
  } catch (err) {
    console.error(`Error copying ${img.dest}:`, err.message);
  }
}
