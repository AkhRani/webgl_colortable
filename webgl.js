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
    uniform sampler2D uWindowSampler;\n\
\
    void main(void) {\n\
      vec4 data = texture2D(uDataSampler, vTextureCoord);\n\
      /* Use the 4-bit color components of the data sample to generate */\n\
      /* a texture coordinate in our color lookup table.  This would be */\n\
      /* simpler if webgl supported 3D textures */\n\
        \
      /* I don't like the .01 in the 273.01 below.  There's something I'm */\n\
      /* missing about the component value scaling, and without the .01 a */\n\
      /* fully saturated value overruns the color lookup texture */\n\
      gl_FragColor = texture2D(uWindowSampler, \n\
          vec2((data.w +                \n\
               (data.z * 16.0) +      \n\
               (data.y * 256.0)) / 273.01, .5));\n\
    }\n\
";


var gl = null;
var vertexPositionAttribute;
var textureCoordAttribute;
var dataSamplerUniform;
var squareVerticesBuffer;
var textureCoordBuffer;
var squareArray;
var dataTexture;
var windowTexture;

function initWebGL(canvas) {
  try {
    // Try to grab the standard context. If it fails, fallback to experimental.
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  }
  catch(e) {}

  // If we don't have a GL context, give up now
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
  }
}

function initBuffers(gl)
{
  // Create GL buffer to hold vertex screen coordinates
  squareVerticesBuffer = gl.createBuffer();

  // Create JS array to hold vertex screen coordinates
  // Default GL screen coordinate system.  [-1,1] in each dimension
  var square = [
    -1.0, -1.0, 0.0,      // bottom left
    -1.0, 1.0, 0.0,       // top left
    1.0, -1.0, 0.0,       // bottom right
    1.0, 1.0, 0.0         // top right
  ]
  squareArray = new Float32Array(square);


  // Create GL buffer to hold vertex texture coordinates
  textureCoordBuffer = gl.createBuffer();

  // Create JS array to hold vertex texture coordinates
  // GL Texture coordinate system, [0,1] in each dimension.
  var textureCoords = [
    0.0, 0.0,         // bottom left
    0.0, 1.0,       // top left
    1.0, 0.0,       // bottom right
    1.0, 1.0      // top right
  ];
  textureArray = new Float32Array(textureCoords);
}

function initTextures(gl) {
  // This is the simulated image data.
  var data = new Uint16Array(4096);
  for (i = 0; i < 4096; i++) {
    data[i] = i;
  }
  dataTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, dataTexture);
  // Note:  This is raw data, so we have to supply width and height (64)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA,
      gl.UNSIGNED_SHORT_4_4_4_4, data);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);


  // This is the color lookup table, which translates the 12-bit image
  // colors to screen colors.  
  var data = new Uint8Array(4096 * 3);
  for (i = 0; i < 4096; i++) {
    var scaledValue = i/16;
    data[i*3+0] = scaledValue;
    data[i*3+1] = scaledValue;
    data[i*3+2] = scaledValue;
  }

  windowTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, windowTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 4096, 1, 0, gl.RGB,
      gl.UNSIGNED_BYTE, data);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
}


function initShaders(gl) {
  var fragmentShader = compileShader(gl, g_fragmentShader, gl.FRAGMENT_SHADER);
  var vertexShader = compileShader(gl, g_vertexShader, gl.VERTEX_SHADER);

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
  vertexPositionAttribute = gl.getAttribLocation(program, "aVertexPosition");
  gl.enableVertexAttribArray(vertexPositionAttribute);
  textureCoordAttribute = gl.getAttribLocation(program, "aTextureCoord");
  gl.enableVertexAttribArray(textureCoordAttribute);
  dataSamplerUniform = gl.getUniformLocation(program, "uDataSampler");
  windowSamplerUniform = gl.getUniformLocation(program, "uWindowSampler");
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

function onWindowChanged(evt) {
  var windowControl = document.getElementById("windowControl");
  var levelControl =  document.getElementById("levelControl");

  // Rescale window range from 256 to 4095
  var range = windowControl.value * 16;
  var level = levelControl.value / 256.0;
  var start = (4096 - range) * level;

  var data = new Uint8Array(4096 * 3);
  var i;
  for (i = 0; i < start; i++) {
    data[i*3+0] = 0;
    data[i*3+1] = 0;
    data[i*3+2] = 0;
  }
  for (; i < start+range; i++) {
    var scaledValue = (i - start) * 255.0 / range;
    data[i*3+0] = scaledValue;
    data[i*3+1] = scaledValue;
    data[i*3+2] = scaledValue;
  }
  for (; i < 4096; i++) {
    data[i*3+0] = 255;
    data[i*3+1] = 255;
    data[i*3+2] = 255;
  }

  gl.bindTexture(gl.TEXTURE_2D, windowTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 4096, 1, 0, gl.RGB,
      gl.UNSIGNED_BYTE, data);

  drawFrame(gl);
}

function drawFrame(gl) {
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Copy screen coordinates to GL
  gl.bindBuffer(gl.ARRAY_BUFFER, squareVerticesBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, squareArray, gl.STATIC_DRAW);
  gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

  // Copy texture coordinates to GL
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, textureArray, gl.STATIC_DRAW);
  gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, dataTexture);
  gl.uniform1i(dataSamplerUniform, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, windowTexture);
  gl.uniform1i(windowSamplerUniform, 1);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}


function start() {
  var canvas = document.getElementById("glcanvas");

  initWebGL(canvas);

  if (gl) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    initShaders(gl);
    initBuffers(gl);
    initTextures(gl);
    drawFrame(gl);
  }

  document.getElementById("windowControl").
    addEventListener("input", onWindowChanged, false);
  document.getElementById("levelControl").
    addEventListener("input", onWindowChanged, false);
}
