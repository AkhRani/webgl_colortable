"use strict";
function IdentityMatrix() {
  return new Float32Array([
      1., 0., 0., 0.,           // column 1
      0., 1., 0., 0.,           // column 2
      0., 0., 1., 0.,           // column 3
      0., 0., 0., 1.]);         // column 4 (translate)
}

function MatrixMult(a, b) {
  var c = new Float32Array(16);
  for (var crow = 0; crow < 4; crow++) {
    for (var ccol = 0; ccol < 4; ccol++) {
      // Multiply row in a by column in b
      var aidx = crow;
      var bidx = ccol * 4;
      var sum = a[aidx] * b[bidx];
      sum += a[aidx+4] * b[bidx+1];
      sum += a[aidx+8] * b[bidx+2];
      sum += a[aidx+12] * b[bidx+3];
      c[ccol*4 + crow] = sum;
    }
  }
  return c;
}

function ScaleMatrix(x, y) {
  return new Float32Array([
      x,  0., 0., 0.,
      0., y,  0., 0.,
      0., 0., 1., 0.,
      0., 0., 0., 1.]);
}

function TranslateMatrix(x, y) {
  return new Float32Array([
      1., 0., 0., 0.,
      0., 1., 0., 0.,
      0., 0., 1., 0.,
      x,  y,  0., 1.]);
}
