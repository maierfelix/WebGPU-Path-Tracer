#version 450
#pragma shader_stage(fragment)

layout (location = 0) in vec2 uv;
layout (location = 0) out vec4 outColor;

layout(binding = 0, std140) buffer PixelBuffer {
  vec4 pixels[];
} pixelBuffer;

layout(binding = 1) uniform SettingsBuffer {
  uint sampleCount;
  uint totalSampleCount;
  uint lightCount;
  uint screenWidth;
  uint screenHeight;
  uint pad_0;
  uint pad_1;
  uint pad_2;
} Settings;

void main() {
  const vec2 resolution = vec2(Settings.screenWidth, Settings.screenHeight);
  const ivec2 bufferCoord = ivec2(floor(uv * resolution));
  const vec2 fragCoord = (uv * resolution);
  const uint pixelIndex = bufferCoord.y * uint(resolution.x) + bufferCoord.x;

  vec4 pixelColor = pixelBuffer.pixels[pixelIndex];
  outColor = pixelColor;
}
