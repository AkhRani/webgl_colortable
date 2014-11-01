// Usage:  node test_dicom_utils.js
var assert = require('assert');

// Do some hackery-pokery to pseudo-import a non-node JS file
var fs = require('fs');
eval(fs.readFileSync('dicom_utils.js')+'');

function testGetStoredBits() {
  console.log("testGetStoredBits");
  // Test basic functionality
  assert.equal(getStoredBits(0x80, 8, 7), 128);
  assert.equal(getStoredBits(0x80, 8, 8), 64);
  assert.equal(getStoredBits(0x80, 8, 9), 32);
  assert.equal(getStoredBits(0x80, 8, 10), 16);
  assert.equal(getStoredBits(0x80, 8, 11), 8);

  assert.equal(getStoredBits(0x80, 12, 11), 128);
  assert.equal(getStoredBits(0x80, 12, 12), 64);
  assert.equal(getStoredBits(0x80, 12, 13), 32);
  assert.equal(getStoredBits(0x80, 12, 14), 16);
  assert.equal(getStoredBits(0x80, 12, 15), 8);

  // Test exclusion of bits outside of stored area
  assert.equal(getStoredBits(0xFFFF, 8, 8), 255);
  assert.equal(getStoredBits(0xFE01, 8, 8), 0);

  assert.equal(getStoredBits(0xFFFF, 12, 12), 4095);
  assert.equal(getStoredBits(0xE001, 12, 12), 0);

  // Test bogus input
  var i;
  for (i = 0; i < 7; i++) {
    assert.equal(getStoredBits(0xFFFF, 8, i), 0);
  }

  for (i = 0; i < 11; i++) {
    assert.equal(getStoredBits(0xFFFF, 12, i), 0);
  }
}

function testGetEndianValue() {
  console.log("testGetEndianValue");
  var buff = new ArrayBuffer(16);
  buff[0] = 1;
  buff[1] = 2;
  buff[2] = 3;
  buff[3] = 4;

  var a = new Uint8Array(buff);

  assert.equal(getEndianValue(buff, 0, true), 0x0201);
  assert.equal(getEndianValue(buff, 1, true), 0x0302);
  assert.equal(getEndianValue(buff, 2, true), 0x0403);

  assert.equal(getEndianValue(buff, 0, false), 0x0102);
  assert.equal(getEndianValue(buff, 1, false), 0x0203);
  assert.equal(getEndianValue(buff, 2, false), 0x0304);
}

testGetStoredBits();
testGetEndianValue();
