const fs = require('fs');
const path = require('path');

const file = 'c:\\Users\\Administrator\\CANVA PRO\\PAYMENTS\\.orders.json';

try {
  const content = fs.readFileSync(file, 'utf-8');
  const data = JSON.parse(content);
  const cleanJson = JSON.stringify(data, null, 2);
  fs.writeFileSync(file, cleanJson, 'utf-8');
  console.log('✅ Database file fixed successfully');
  process.exit(0);
} catch(e) {
  console.error('❌ Error:', e.message);
  process.exit(1);
}
