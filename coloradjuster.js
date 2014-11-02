function ColorAdjuster() {
  // Miscellaneous state
  this.gl = null;
  this.externalColorTable = false;
  this.colorBits = 16;
  this.overlayEnabled = false;
  this.overlayAutoAlphaEnabled = false;
  this.overlayAlpha = 1.;

  // GL Attribute IDs
  this.vertexPosition = null;
  this.textureCoord = null;

  // GL Uniform IDs
  this.dataSampler = null;
  this.windowSampler = null;
  this.overlaySampler = null;
  this.uOverlayFlag = null;
  this.uOverlayAutoAlphaFlag = null;
  this.uOverlayAlpha = null;

  // Buffers and arrays
  this.squareVerticesBuffer = null;
  this.textureCoordBuffer = null;
  this.squareArray = null;
  this.normalTextureCoords = null;
  this.invertedTextureCoords = null;
  this.dataTexture = null;
  this.overlayTexture = null;
  this.lutTexture = null;
  this.lut = null;
}

/*************************************************************/
/* Public interface.  Client code should use these functions */
/*************************************************************/

/* Call this function once after creating the ColorAdjuster object,
 * passing in a canvas element to display the image on.
 * This function must be called before the other functions. */
ColorAdjuster.prototype.init = function(canvas) {
  this.gl = initWebGL(canvas);
  if (this.gl) {
    this.initShaders();
    this.initBuffers();
    this.initTextures();
    return true;
  }
  return false;
}

/* Call this function to set the grayscale image.
 * data is 16-bit grayscale data, in a Uint16Array 
 * or a Uint8Array */
ColorAdjuster.prototype.setImageData = function(data, width, height) {
  var gl = this.gl;
  if (!gl)
    return;

  // Client can pass 8-bit or 16-bit buffer
  var uint8View = new Uint8Array(data.buffer);

  gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, width, height, 0,
      gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, uint8View);
  this.checkLut(16);
}

// image is an HTMLImageElement
ColorAdjuster.prototype.setImage = function(image) {
  var gl = this.gl;
  if (!gl)
    return;

  gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  this.checkLut(8);
}

/* This is the most general-purpose way to set the mapping from
 * 16-bit grayscale to 8-bit color.  The data argument must be a Uint8Array,
 * with length equal to 65536*3.  Element 0 is the output red component
 * for 16-bit value 0x0000.  Element 1 is the green component, etc.
 * If the current data texture is an Image (jpg, png, etc) then only
 * the first 256 values will be used. */
ColorAdjuster.prototype.setColorTable = function(data) {
  this.externalColorTable = true;
  this.doSetColorTable(data);
}

/* This is a convenience function to simplify calling setColorTable */
ColorAdjuster.prototype.setWindow = function(width, center, validBits, invalidColor) {
  var gl = this.gl;
  if (!gl || validBits < 1 || validBits > 16)
    return;

  var start = center - width / 2;
  var validColors = 1 << validBits;
  var i;
  for (i = 0; i < start && i < validColors; i++) {
    this.lut[i*3 + 0] = 0;
    this.lut[i*3 + 1] = 0;
    this.lut[i*3 + 2] = 0;
  }
  for (; i < start + width && i < validColors; i++) {
    var scaledValue = (i - start) * 255.0 / width;
    this.lut[i*3 + 0] = scaledValue;
    this.lut[i*3 + 1] = scaledValue;
    this.lut[i*3 + 2] = scaledValue;
  }
  for (; i < validColors; i++) {
    this.lut[i*3 + 0] = 255;
    this.lut[i*3 + 1] = 255;
    this.lut[i*3 + 2] = 255;
  }
  for (; i < 65536; i++) {
    this.lut[i*3+0] = invalidColor[0];
    this.lut[i*3+1] = invalidColor[1];
    this.lut[i*3+2] = invalidColor[2];
  }
  this.doSetColorTable(this.lut);
  this.externalColorTable = false;
}

/* Set an overlay image
 * image is a JavaScript Image object (color or grayscale, with optional alpha)
 * The given image will be drawn on top of the primary grayscale image when
 * drawImage is called, if the overlay is enabled.  The overlay image is not
 * affected by the window / level values.
 *
 * Notes:
 * Call enableOverlay(true/false) to enable disable drawing the overlay.
 *      (enableOverlay can be called before or after setOverlayImage)
 * Call setOverlayAlpha([0. ,1. ]) to modify the transparrency of the overlay
 * Call enableOverlayAutoAlpha to add alpha blending based on pixel brighness
 */
ColorAdjuster.prototype.setOverlayImage = function(image) {
  var gl = this.gl;
  if (!gl)
    return;

  this.overlayImageSet = (image != null);
  gl.bindTexture(gl.TEXTURE_2D, this.overlayTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
}

/* Enable or disable the overlay image
 *
 * This method can be called before an overlay image is set, but will
 * not take effect until a non-null image is passed to setOverlayImage().
 */
ColorAdjuster.prototype.enableOverlay = function(enable) {
  this.overlayEnabled = enable ? 1 : 0;
}

/* Enable or disable auto-alpha
 *
 * This feature generates an alpha value for each pixel based on the
 * brightness of the pixel.  This can be used to overlay images that
 * lack an alpha channel, so that the underlying grayscale image will
 * show through the dark areas of the overlay image.
 *
 * If the overlay image has an alpha channel, and auto-alpha is enabled,
 * the alpha value for a pixel will be the image alpha multiplied by the
 * auto alpha.
 */
ColorAdjuster.prototype.enableOverlayAutoAlpha = function(enable) {
  this.overlayAutoAlphaEnabled = enable ? 1 : 0;
}

/* Modify the alpha of the overlay image
 *
 * The given alpha [0. , 1.] will be multiplied by the image alpha value
 * for each pixel.  Note that for images without an alpha channel, the alpha
 * value is 1.
 */
ColorAdjuster.prototype.setOverlayAlpha = function(alpha) {
  this.overlayAlpha = alpha;
}

/* Redraw the image / overlay with the current settings */
ColorAdjuster.prototype.drawImage = function(invert) {
  var gl = this.gl;
  if (!gl)
    return;

  // In case the canvas was resized
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Copy screen coordinates to GL
  gl.bindBuffer(gl.ARRAY_BUFFER, this.squareVerticesBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, this.squareArray, gl.STATIC_DRAW);
  gl.vertexAttribPointer(this.vertexPosition, 3, gl.FLOAT, false, 0, 0);

  // Copy texture coordinates to GL
  gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordBuffer);
  if (invert) {
    gl.bufferData(gl.ARRAY_BUFFER, this.invertedTextureCoords, gl.STATIC_DRAW);
  }
  else {
    gl.bufferData(gl.ARRAY_BUFFER, this.normalTextureCoords, gl.STATIC_DRAW);
  }
  gl.vertexAttribPointer(this.textureCoord, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
  gl.uniform1i(this.dataSampler, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
  gl.uniform1i(this.windowSampler, 1);

  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, this.overlayTexture);
  gl.uniform1i(this.overlaySampler, 2);

  if (this.overlayEnabled && this.overlayImageSet) {
    gl.uniform1i(this.uOverlayFlag, true);
    gl.uniform1i(this.uOverlayAutoAlphaFlag, this.overlayAutoAlphaEnabled);
    gl.uniform1f(this.uOverlayAlpha, this.overlayAlpha);
  }
  else {
    gl.uniform1i(this.uOverlayFlag, false);
  }


  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/**********************************************/
/* Private functions, mostly initialization.
 * Client code should not need to call these. */
/**********************************************/
function initWebGL(canvas) {
  var gl = null;
  try {
    // Try to grab the standard context, fallback to experimental.
    gl = canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 2);
  }
  catch(e) {}

  // If we don't have a GL context, give up now
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
  }
  return gl;
}

ColorAdjuster.prototype.initBuffers = function()
{
  var gl = this.gl;
  if (!gl)
    return;

  // Create GL buffer to hold vertex screen coordinates
  this.squareVerticesBuffer = gl.createBuffer();

  // Create JS array to hold vertex screen coordinates
  // Default GL screen coordinate system.  [-1,1] in each dimension
  var square = [
    -1.0, -1.0, 0.0,      // bottom left
    -1.0, 1.0, 0.0,       // top left
    1.0, -1.0, 0.0,       // bottom right
    1.0, 1.0, 0.0         // top right
      ]
      this.squareArray = new Float32Array(square);

  // Create GL buffer to hold vertex texture coordinates
  this.textureCoordBuffer = gl.createBuffer();

  // Create JS array to hold vertex texture coordinates
  // GL Texture coordinate system, [0,1] in each dimension.
  var textureCoords = [
    0.0, 0.0,         // bottom left
    0.0, 1.0,       // top left
    1.0, 0.0,       // bottom right
    1.0, 1.0      // top right
      ];
  this.normalTextureCoords = new Float32Array(textureCoords);

  var textureCoords = [
    0.0, 1.0,         // bottom left
    0.0, 0.0,       // top left
    1.0, 1.0,       // bottom right
    1.0, 0.0      // top right
      ];
  this.invertedTextureCoords = new Float32Array(textureCoords);
}


ColorAdjuster.prototype.initTextures = function() {
  var gl = this.gl;
  if (!gl)
    return;

  // The data "texture", which is a grayscale image interpreted as a
  // series of offsets into the lookup table.
  this.dataTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // This is the color lookup table, which translates the 16-bit image
  // colors to screen colors.
  this.lut = new Uint8Array(65536 * 3);
  this.lutTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // This is the optional overlay image
  this.overlayTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, this.overlayTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}


function compileShader(gl, shaderSource, type) {
  // Create a shader
  var shader = gl.createShader(type);
  if (shader) {
    // Compile the source
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    // See if it compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert("An error occurred compiling a shader: " +
          gl.getShaderInfoLog(shader));
      shader = null;
    }
  }
  else {
    alert ("Failed to create shader");
  }
  return shader;
}

ColorAdjuster.prototype.initShaders = function() {
  var gl = this.gl;
  if (!gl)
    return;

  var frag = compileShader(gl, g_fragmentShader, gl.FRAGMENT_SHADER);
  var vert = compileShader(gl, g_vertexShader, gl.VERTEX_SHADER);
  var program = gl.createProgram();
  gl.attachShader(program, frag);
  gl.attachShader(program, vert);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    alert ("Unable to initialize WebGL");
  }

  // Now that we've built the shader program, we can find the IDs of the
  // shader program variables.
  gl.useProgram(program);
  this.vertexPosition = gl.getAttribLocation(program, "aVertexPosition");
  gl.enableVertexAttribArray(this.vertexPosition);

  this.textureCoord = gl.getAttribLocation(program, "aTextureCoord");
  gl.enableVertexAttribArray(this.textureCoord);

  this.dataSampler = gl.getUniformLocation(program, "uDataSampler");
  this.windowSampler = gl.getUniformLocation(program, "uColorSampler");
  this.overlaySampler = gl.getUniformLocation(program, "uOverlaySampler");
  this.uOverlayFlag = gl.getUniformLocation(program, "uOverlayFlag");
  this.uOverlayAutoAlphaFlag = gl.getUniformLocation(program, "uOverlayAutoAlphaFlag");
  this.uOverlayAlpha = gl.getUniformLocation(program, "uOverlayAlpha");
}

ColorAdjuster.prototype.checkLut = function(colorBits) {
  if (this.colorBits != colorBits && !this.externalColorTable) {
    this.colorBits = colorBits;
    this.doSetColorTable(this.lut);
  }
}

ColorAdjuster.prototype.doSetColorTable = function (data) {
  var gl = this.gl;
  if (!gl)
    return;

  gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
  if (this.colorBits === 16) {
    // 16-bit grayscale
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 256, 256, 0, gl.RGB,
        gl.UNSIGNED_BYTE, data);
  }
  else {
    // 8-bit grayscale
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 256, 1, 0, gl.RGB,
        gl.UNSIGNED_BYTE, data);
  }
}

/*******************/
/* Shader Programs */
/*******************/
var g_vertexShader = "\
    #version 100\n\
    attribute vec3 aVertexPosition;\
    attribute vec2 aTextureCoord;\
    varying highp vec2 vTextureCoord;\
    \
    void main(void) {\
      gl_Position = vec4(aVertexPosition, 1.0);\
      vTextureCoord = aTextureCoord;\
    }\
    ";

var g_fragmentShader = "\
    #version 100\n\
    precision highp float;\
    varying highp vec2 vTextureCoord;\
    uniform sampler2D uDataSampler;\
    uniform sampler2D uColorSampler;\
    uniform sampler2D uOverlaySampler;\
    uniform int uOverlayFlag;\
    uniform int uOverlayAutoAlphaFlag;\
    uniform float uOverlayAlpha;\
    \
    void main(void) {\
      vec4 data = texture2D(uDataSampler, vTextureCoord);\
      gl_FragColor = texture2D(uColorSampler, vec2(data.r,data.a) );\
      \
      if (uOverlayFlag != 0) { \
        vec4 overlay = texture2D(uOverlaySampler, vTextureCoord);\
        float alpha = overlay.a * uOverlayAlpha;\
        if (uOverlayAutoAlphaFlag != 0) { \
          float brightness = (overlay.r + overlay.g + overlay.b) / 3.; \
          alpha *= brightness; \
        } \
        gl_FragColor.rgb = gl_FragColor.rgb * (1. - alpha) + \
            overlay.rgb * alpha; \
      } \
    }\
    ";
