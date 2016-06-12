"use strict";

function checkMatrix(assert, actual, expected, description) {
  for (var i = 0; i < 16; i++) {
    assert.equal(actual[i], expected[i], description);
  }
}

QUnit.test( "matrix multiply", function(assert) {
  var scale = ScaleMatrix(2., 3.);
  var xlate = TranslateMatrix(1., 1.);
  var ident = IdentityMatrix();
  var xform;

  /* test identity multiply */
  xform = MatrixMult(ident, ident);
  checkMatrix(assert, xform, ident, "ident x ident");

  xform = MatrixMult(ident, scale);
  checkMatrix(assert, xform, scale, "ident x scale");

  xform = MatrixMult(xlate, ident);
  checkMatrix(assert, xform, xlate, "ident x translate");

  /* test other multiplies */
  xform = MatrixMult(scale, xlate);
  checkMatrix(assert, xform, [
      2., 0., 0., 0.,
      0., 3., 0., 0.,
      0., 0., 1., 0.,
      2,  3,  0., 1.],
      "scale x translate");

  xform = MatrixMult(xlate, scale);
  checkMatrix(assert, xform, [
      2., 0., 0., 0.,
      0., 3., 0., 0.,
      0., 0., 1., 0.,
      1., 1., 0., 1.],
      "translate x scale");
});

