function ColorAdjuster() {
  this.gl = null;
  this.vertexPositionAttribute = null;
  this.textureCoordAttribute = null;
  this.dataSamplerUniform = null;
  this.windowSamplerUniform = null;
  this.squareVerticesBuffer = null;
  this.textureCoordBuffer = null;
  this.squareArray = null;
  this.textureArray = null;
  this.dataTexture = null;
  this.windowTexture = null;
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
    }
  }

  this.setImageData = function(data, width, height) {
    var gl = this.gl;
    if (!gl)
      return;

    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA,
        gl.UNSIGNED_SHORT_4_4_4_4, data);
  }

  /* This is the most general-purpose way to set the mapping from
   * 12-bit grayscale to 8-bit color.  The data argument must be a Uint8Array,
   * with length equal to 4096*3.  Element 0 is the output red component
   * for 12-bit value 0x000.  Element 1 is the green component, etc. */
  this.setColorTable = function(data) {
    var gl = this.gl;
    if (!gl)
      return;

    gl.bindTexture(gl.TEXTURE_2D, this.windowTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 4096, 1, 0, gl.RGB,
        gl.UNSIGNED_BYTE, data);
  }

  /* This is a convenience function to simplify calling setColorTable */
  this.setWindow = function(width, start) {
    var i;
    for (i = 0; i < start && i < 4096; i++) {
      this.lut[i*3+0] = 0;
      this.lut[i*3+1] = 0;
      this.lut[i*3+2] = 0;
    }
    for (; i < start+width && i < 4096; i++) {
      var scaledValue = (i - start) * 255.0 / width;
      this.lut[i*3+0] = scaledValue;
      this.lut[i*3+1] = scaledValue;
      this.lut[i*3+2] = scaledValue;
    }
    for (; i < 4096; i++) {
      this.lut[i*3+0] = 255;
      this.lut[i*3+1] = 255;
      this.lut[i*3+2] = 255;
    }
    this.setColorTable(this.lut);
  }

  /* This is a convenience function to simplify calling setColorTable */
  this.setWindowWidthAndCenter = function(width, center) {
    this.setWindow(width, center - width/2);
  }

  /* Call this to refresh the image after setting the image data
   * or the color table */
  this.drawImage = function() {
    var gl = this.gl;
    if (!gl)
      return;

    gl.clear(gl.COLOR_BUFFER_BIT);

    // Copy screen coordinates to GL
    gl.bindBuffer(gl.ARRAY_BUFFER, this.squareVerticesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.squareArray, gl.STATIC_DRAW);
    gl.vertexAttribPointer(this.vertexPositionAttribute,
        3, gl.FLOAT, false, 0, 0);

    // Copy texture coordinates to GL
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.textureArray, gl.STATIC_DRAW);
    gl.vertexAttribPointer(this.textureCoordAttribute,
        2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
    gl.uniform1i(this.dataSamplerUniform, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.windowTexture);
    gl.uniform1i(this.windowSamplerUniform, 1);

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
    this.textureArray = new Float32Array(textureCoords);
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

    // This is the color lookup table, which translates the 12-bit image
    // colors to screen colors.
    this.lut = new Uint8Array(4096 * 3);
    for (i = 0; i < 4096; i++) {
      var scaledValue = i/16;
      this.lut[i*3+0] = scaledValue;
      this.lut[i*3+1] = scaledValue;
      this.lut[i*3+2] = scaledValue;
    }

    this.windowTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.windowTexture);

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

    var fragmentShader =
        compileShader(gl, g_fragmentShader, gl.FRAGMENT_SHADER);

    var vertexShader =
        compileShader(gl, g_vertexShader, gl.VERTEX_SHADER);

    var program = gl.createProgram();
    gl.attachShader(program, fragmentShader);
    gl.attachShader(program, vertexShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      alert ("Unable to initialize WebGL");
    }

    // Now that we've built the shader program, we can find the IDs of the
    // shader program variables.
    gl.useProgram(program);
    this.vertexPositionAttribute =
         gl.getAttribLocation(program, "aVertexPosition");
    gl.enableVertexAttribArray(this.vertexPositionAttribute);

    this.textureCoordAttribute = gl.getAttribLocation(program, "aTextureCoord");
    gl.enableVertexAttribArray(this.textureCoordAttribute);

    this.dataSamplerUniform = gl.getUniformLocation(program, "uDataSampler");
    this.windowSamplerUniform = gl.getUniformLocation(program, "uColorSampler");
  }

  /* Shader Programs */
  var g_vertexShader = "\
    attribute vec3 aVertexPosition;\n\
    attribute vec2 aTextureCoord;\n\
  \
    varying highp vec2 vTextureCoord;\n\
  \
    void main(void) {\n\
      gl_Position = vec4(aVertexPosition, 1.0);\n\
      vTextureCoord = aTextureCoord;\n\
    }\n\
    ";


  var g_fragmentShader = "\
      precision highp float;\n\
      varying highp vec2 vTextureCoord;\n\
      uniform sampler2D uDataSampler;\n\
      uniform sampler2D uColorSampler;\n\
  \
      void main(void) {\n\
        vec4 data = texture2D(uDataSampler, vTextureCoord);\n\
        /* Use the 4-bit color components of the data sample to generate */\n\
        /* a texture coordinate in our color lookup table.  This would be */\n\
        /* simpler if webgl supported 3D textures */\n\
          \
        /* I don't like the .01 in the 273.01 below.  There's something */\n\
        /* I'm missing about the component value scaling, and without the */\n\
        /* .01 a fully saturated value overruns the color lookup texture */\n\
        gl_FragColor = texture2D(uColorSampler, \n\
            vec2((data.w +                \n\
                 (data.z * 16.0) +      \n\
                 (data.y * 256.0)) / 273.01, .5));\n\
      }\n\
  ";
}
