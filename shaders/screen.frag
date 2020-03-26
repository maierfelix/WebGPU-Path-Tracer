#version 450
#pragma shader_stage(fragment)

layout (location = 0) in vec2 uv;
layout (location = 0) out vec4 outColor;

layout(binding = 0, std140) buffer PixelBuffer {
  vec4 pixels[];
} pixelBuffer;

void main() {
  const vec2 resolution = vec2(1280, 768);
  const ivec2 bufferCoord = ivec2(floor(uv * resolution));
  const vec2 fragCoord = (uv * resolution);
  const uint pixelIndex = bufferCoord.y * uint(resolution.x) + bufferCoord.x;

  vec4 pixelColor = pixelBuffer.pixels[pixelIndex];
  outColor = pixelColor;
}
