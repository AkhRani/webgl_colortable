function ColorAdjuster() {
  this.gl = null;

  // GL Attribute IDs
  this.vertexPosition = null;
  this.textureCoord = null;

  // GL Uniform IDs
  this.dataSampler = null;
  this.windowSampler = null;

  // Buffers and arrays
  this.squareVerticesBuffer = null;
  this.textureCoordBuffer = null;
  this.squareArray = null;
  this.normalTextureCoords = null;
  this.invertedTextureCoords = null;
  this.dataTexture = null;
  this.lutTexture = null;
  this.lut = null;

  /*************************************************************/
  /* Public interface.  Client code should use these functions */
  /*************************************************************/

  /* Call this function once after creating the ColorAdjuster object,
   * passing in a canvas element to display the image on.
   * This function must be called before the other functions. */
  this.init = function(canvas) {
    this.gl = initWebGL(canvas);
    if (this.gl) {
      this.initShaders();
      this.initBuffers();
      this.initTextures();
      return true;
    }
    return false;
  }

  this.setImageData = function(data, width, height) {
    var gl = this.gl;
    if (!gl)
      return;

    // Client can pass 8-bit or 16-bit buffer
    var uint8View = new Uint8Array(data.buffer);

    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, width, height, 0,
        gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, uint8View);
  }

  /* This is the most general-purpose way to set the mapping from
   * 16-bit grayscale to 8-bit color.  The data argument must be a Uint8Array,
   * with length equal to 65536*3.  Element 0 is the output red component
   * for 16-bit value 0x0000.  Element 1 is the green component, etc. */
  this.setColorTable = function(data) {
    var gl = this.gl;
    if (!gl)
      return;

    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 256, 256, 0, gl.RGB,
        gl.UNSIGNED_BYTE, data);
  }

  /* This is a convenience function to simplify calling setColorTable */
  this.setWindow = function(width, center, validBits, invalidColor) {
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
    this.setColorTable(this.lut);
  }

  /* Call this to refresh the image after setting the image data
   * or the color table */
  this.drawImage = function(invert) {
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

  this.initBuffers = function()
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


  this.initTextures = function() {
    var gl = this.gl;
    if (!gl)
      return;

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

  this.initShaders = function() {
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
  \
    void main(void) {\
      vec4 data = texture2D(uDataSampler, vTextureCoord);\
      gl_FragColor = texture2D(uColorSampler, data.ra );\
    }\
  ";
}
