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

function ScaleMatrix(x, y, z) {
  // optional z argument
  z = typeof(z) === "number" ? z:1.;
  return new Float32Array([
      x,  0., 0., 0.,
      0., y,  0., 0.,
      0., 0., z,  0.,
      0., 0., 0., 1.]);
}

function TranslateMatrix(x, y, z) {
  // optional z argument
  z = typeof(z) === "number" ? z:0.;
  return new Float32Array([
      1., 0., 0., 0.,
      0., 1., 0., 0.,
      0., 0., 1., 0.,
      x,  y,  z,  1.]);
}

function SimpleFrustum(width, height, z_near, z_far) {
  return new Float32Array([
      z_near/(width/2),  0., 0., 0.,
      0., z_near/(height/2), 0., 0.,
      0., 0., -(z_far + z_near) / (z_far - z_near), -1.0,
      0., 0., 2*z_near*z_far / (z_far-z_near), 0.
      ]);
}

function Frustum(x_left, x_right, y_bottom, y_top, z_near, z_far) {
  var width = x_right - x_left;
  var height = y_top - y_bottom;
  return new Float32Array([
      z_near/(width/2),  0., 0., 0.,
      0., z_near/(height/2), 0., 0.,
      (x_left + x_right) / (width/2), (y_top + y_bottom) / (height/2), -(z_far+z_near)/(z_far-z_near), -1.0,
      0., 0., 2*z_near*z_far / (z_far-z_near), 0.
      ]);
}
