'use strict';

const cp = require('child_process');

const diff = cp.execSync('git diff --cached', { encoding: 'utf8' });
const suspicious = diff.match(/(api[_-]?key|secret|token|password|auth)[\s:=]+['"][a-zA-Z0-9_\-]{20,}['"]/gi);

if (suspicious) {
  console.error('SUSPICIOUS SECRETS FOUND:', suspicious);
  process.exit(1);
} else {
  console.log('Secret scan passed: No hardcoded secrets or tokens detected in staged files.');
}
