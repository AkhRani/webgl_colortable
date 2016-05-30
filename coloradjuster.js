function ColorAdjuster() {
  "use strict";
  // Miscellaneous state
  this.gl = null;
  this.colorBits = 16;
  this.useLut = false;
  this.useAlpha = false;
  this.autoAlpha = false;
  this.globalAlpha = 1.;
  this.windowBegin = 0;
  this.windowEnd = 0;

  // GL Attribute IDs
  this.vertexPosition = null;
  this.textureCoord = null;

  // GL Uniform IDs
  this.imageSampler = null;
  this.lutSampler = null;
  this.uGrayscale = null;
  this.uCustomColors = null;
  this.uWindowBegin = null;
  this.uWindowEnd = null;
  this.uAutoAlpha = null;
  this.uAlpha = null;

  // Buffers and arrays
  this.squareVerticesBuffer = null;
  this.textureCoordBuffer = null;
  this.squareArray = null;
  this.normalTextureCoords = null;
  this.invertedTextureCoords = null;
  this.baseTexture = null;
  this.lutTexture = null;
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

/* Set the base image to 16-bit grayscale.
 *
 * data is 16-bit grayscale data, in a Uint16Array 
 * or a Uint8Array */
ColorAdjuster.prototype.setData = function(data, width, height) {
  var gl = this.gl;
  if (!gl)
    return;

  // Client can pass 8-bit or 16-bit buffer
  var uint8View = new Uint8Array(data.buffer);

  gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, width, height, 0,
      gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, uint8View);
  this.checkLut(16);
}

/* Set the base image to 8-bit RGB
 *
 * image is a JavaScript Image object
 */
ColorAdjuster.prototype.setImage = function(image) {
  var gl = this.gl;
  if (!gl)
    return;

  gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  this.checkLut(8);
}

/* This is the most general-purpose way to set the mapping from
 * grayscale to 8-bit color.  The data argument must be a Uint8Array,
 * with length equal to 65536*3.  Element 0 is the output red component
 * for 16-bit value 0x0000.  Element 1 is the green component, etc.
 * If the current data texture is an Image (jpg, png, etc) then only
 * the first 256 values will be used. */
ColorAdjuster.prototype.setColorTable = function(data) {
  this.useLut = true;
  this.doSetColorTable(data);
}

/* This is a convenience function to simplify calling setColorTable */
ColorAdjuster.prototype.setWindow = function(width, center, validBits, invalidColor) {
  this.useWindow = true;
  this.windowBegin = center - width / 2;
  this.windowEnd = center + width / 2;
}

/* Enable alpha blending
 *
 * @param global
 * Additional alpha factor multiplied by source alpha
 *
 * @param auto
 * This feature generates an alpha value for each pixel based on the
 * brightness of the pixel.  This can be used to overlay images that
 * lack an alpha channel, so that the underlying grayscale image will
 * show through the dark areas of the overlay image.
 *
 * If the overlay image has an alpha channel, and auto-alpha is enabled,
 * the alpha value for a pixel will be the image alpha multiplied by the
 * auto alpha.
 */
ColorAdjuster.prototype.setAlpha = function(global, auto) {
  this.useAlpha = true;
  this.globalAlpha = global;
  this.autoAlpha = auto ? 1 : 0;
}

ColorAdjuster.prototype.clear = function() {
  var gl = this.gl;
  if (!gl)
    return;

  // In case the canvas was resized
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

/* draw the image / overlay */
ColorAdjuster.prototype.draw = function(invert) {
  "use strict";
  var gl = this.gl;
  if (!gl)
    return;

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

  if (this.useAlpha) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(this.uAutoAlpha, this.autoAlpha);
    gl.uniform1f(this.uAlpha, this.globalAlpha);
  }
  else {
    gl.disable(gl.BLEND);
    gl.blendFunc(gl.SRC_COLOR, gl.ZERO);
    gl.uniform1i(this.uAutoAlpha, false);
    gl.uniform1f(this.uAlpha, 1);
  }

  gl.uniform1i(this.uGrayscale, this.colorBits === 16);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
  gl.uniform1i(this.imageSampler, 0);

  gl.uniform1i(this.uWindow, this.useWindow);
  if (this.useWindow) {
    gl.uniform1f(this.uWindowBegin, this.windowBegin);
    gl.uniform1f(this.uWindowEnd, this.windowEnd);
  }

  gl.uniform1i(this.uCustomColors, this.useLut);
  if (this.useLut) {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    gl.uniform1i(this.lutSampler, 1);
  }
  
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  this.useAlpha = false;
  this.useWindow = false;
  this.useLut = false;
}

/**********************************************/
/* Private functions, mostly initialization.
 * Client code should not need to call these. */
/**********************************************/
function initWebGL(canvas) {
  var gl = null;
  try {
    // Try to grab the standard context, fallback to experimental.
    gl = canvas.getContext("webgl", {alpha: false}) ||
      canvas.getContext("experimental-webgl", {alpha: false});
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

  // The base image texture.  In the case of a 16-bit grayscale image,
  // this texture will contain a luminance-alpha texture, with the
  // high-order data in the alpha channel, and the low order data
  // duplicated among the (identical) color values.
  // In the case of an 8-bit image, this will contain normal RGBA data.
  this.baseTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // This is the color lookup table, which translates the 16-bit image
  // colors to screen colors.
  this.lutTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);

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

  this.imageSampler = gl.getUniformLocation(program, "uImageSampler");
  this.lutSampler = gl.getUniformLocation(program, "uLutSampler");
  this.uGrayscale = gl.getUniformLocation(program, "uGrayscale");
  this.uCustomColors = gl.getUniformLocation(program, "uCustomColors");
  this.uWindow = gl.getUniformLocation(program, "uWindow");
  this.uWindowBegin = gl.getUniformLocation(program, "uWindowBegin");
  this.uWindowEnd = gl.getUniformLocation(program, "uWindowEnd");

  this.uAutoAlpha = gl.getUniformLocation(program, "uAutoAlpha");
  this.uAlpha = gl.getUniformLocation(program, "uAlpha");
}

// FIXME:  Max length 2048.  Single LUT format.
ColorAdjuster.prototype.checkLut = function(colorBits) {
  this.colorBits = colorBits;
}

// TODO:  Max length 2048.  Single LUT format.
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
    \
    uniform sampler2D uImageSampler;\
    uniform bool uGrayscale;\
    uniform bool uCustomColors;\
    uniform sampler2D uLutSampler;\
    uniform bool uWindow; \
    uniform float uWindowBegin;\
    uniform float uWindowEnd;\
    \
    uniform bool uAutoAlpha;\
    uniform float uAlpha;\
    \
    void main(void) {\
      if (uGrayscale) { \
        vec4 data = texture2D(uImageSampler, vTextureCoord); \
        if (uWindow) { \
          float value = data.a * 65280. + data.r * 255.; \
          value = smoothstep(uWindowBegin, uWindowEnd, value); \
          gl_FragColor = vec4(value, value, value, 1.); \
        } \
        /* FIXME unify lut format */ \
        if (uCustomColors) { \
          gl_FragColor = texture2D(uLutSampler, vec2(data.r, data.a) ); \
        } \
      } else { \
        vec4 color = texture2D(uImageSampler, vTextureCoord); \
        /* Remap grayscale */ \
        if (color.r == color.g && color.r == color.b) { \
          if (uWindow) { \
            float value = smoothstep(uWindowBegin, uWindowEnd, color.r * 255.); \
            color.rgb = vec3(value, value, value); \
          } \
          if (uCustomColors) { \
            color = texture2D(uLutSampler, vec2(color.r, color.a) ); \
          } \
        } \
        gl_FragColor = color; \
      } \
      float alpha = gl_FragColor.a * uAlpha; \
      if (uAutoAlpha) { \
        float brightness = (gl_FragColor.r + gl_FragColor.g + gl_FragColor.b) / 3.; \
        alpha *= brightness; \
      } \
      gl_FragColor.a = alpha; \
    }\
    ";
