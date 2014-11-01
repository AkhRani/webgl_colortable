// Given a native-endian value, extract the bits of interest
function getStoredBits(value, bits_stored, high_bit) {
  var mask = (1 << bits_stored) - 1;
  var shift = (high_bit + 1 - bits_stored);
  if (shift >= 0) {
    return (value >> shift) & mask;
  }
  return 0;
}

// Given a Uint8Array, index, and endianness, return the 16-bit value
// starting at that index
//
// @parameter array Uint8Array
// @parameter index 0-based index of the first byte of the value
// @parameter little_endian true for little-endian values, false for big
// @parameter representation
function getEndianValue(array, index, little_endian) {
  first_byte = array[index];
  second_byte = array[index+1];
  if (little_endian) {
    return (second_byte << 8) | first_byte;
  }
  else {
    return (first_byte << 8) | second_byte;
  }
}

// Convert stored value to output units
function rescaleValue(stored_value, rescale_slope, rescale_intercept) {
  return stored_value * rescale_slope + rescale_intercept;
}

// TODO:  Photometric Interpretation
function importPixelData(pixel_data, samples_per_pixel, rows, columns, frames, planar_configuration, bits_allocated, bits_stored, high_bit, representation) {
  // We only handle 8 and 16-bit allocations
  if (bits_allocated != 8 && bits_allocated != 16) {
    // TODO:  Report reason for failure somehow
    return null;
  }
  // 
  var input_bytes_per_sample = bits_allocated / 8;
  var input_bytes_per_frame = bytes_per_sample * samples_per_pixel * pixels_per_frame;

  var output_bytes_per_frame = 2 * samples_per_pixel * pixels_per_frame;
  var output_buffer = new ArrayBuffer(output_bytes_per_frame * frames);

  var frame;
  for (frame = 0; frame < frames; frame++) {

  }

}
