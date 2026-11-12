'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const exportsDir = path.join(__dirname, '../workflows/exports');
const exportFiles = [
  '00-setup-data-tables.json',
  '01-build-team-strengths.json',
  '02-predict-upcoming-matches.json',
  '03-verify-api-access.json',
];

test('all workflow export files exist and are valid JSON', () => {
  for (const filename of exportFiles) {
    const fullPath = path.join(exportsDir, filename);
    assert.ok(fs.existsSync(fullPath), `Export file ${filename} must exist`);
    const content = fs.readFileSync(fullPath, 'utf8');
    let parsed;
    assert.doesNotThrow(() => {
      parsed = JSON.parse(content);
    }, `File ${filename} must be valid JSON`);

    assert.ok(parsed.name && typeof parsed.name === 'string', `${filename} must have a name`);
    assert.ok(Array.isArray(parsed.nodes) && parsed.nodes.length > 0, `${filename} must have nodes`);
    assert.ok(parsed.connections && typeof parsed.connections === 'object', `${filename} must have connections`);
    assert.equal(parsed.active, false, `${filename} must remain inactive by default`);

    const nodeNames = new Set();
    const nodeIds = new Set();
    for (const node of parsed.nodes) {
      assert.ok(node.name, `Every node in ${filename} must have a name`);
      assert.ok(node.type, `Every node in ${filename} must have a type`);
      assert.ok(node.id, `Every node in ${filename} must have an ID`);
      assert.ok(!nodeNames.has(node.name), `Duplicate node name "${node.name}" in ${filename}`);
      assert.ok(!nodeIds.has(node.id), `Duplicate node ID "${node.id}" in ${filename}`);
      nodeNames.add(node.name);
      nodeIds.add(node.id);
    }

    // Verify all connections point to valid node names
    for (const [sourceNode, targetGroups] of Object.entries(parsed.connections)) {
      assert.ok(nodeNames.has(sourceNode), `Connection source "${sourceNode}" in ${filename} must exist as a node`);
      if (targetGroups.main) {
        for (const branch of targetGroups.main) {
          for (const conn of branch) {
            assert.ok(
              nodeNames.has(conn.node),
              `Connection target "${conn.node}" from "${sourceNode}" in ${filename} must exist as a node`
            );
          }
        }
      }
    }
  }
});
