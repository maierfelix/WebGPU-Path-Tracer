#ifndef UTILS_H
#define UTILS_H

#pragma optionNV(fastmath on)
#pragma optionNV(ifcvt none)
#pragma optionNV(inline all)
#pragma optionNV(strict on)
#pragma optionNV(unroll all)

#define PI       3.141592653589793
#define HALF_PI  1.5707963267948966
#define TWO_PI   6.283185307179586
#define INV_PI   0.3183098861837907

#define GAMMA 2.2
#define INV_GAMMA 0.45454545454545453

#define EPSILON 0.001

#define LUMINANCE vec3(0.2126, 0.7152, 0.0722)

#include "structs.glsl"

vec2 blerp(vec2 b, vec2 p1, vec2 p2, vec2 p3) {
  return (1.0 - b.x - b.y) * p1 + b.x * p2 + b.y * p3;
}

vec3 blerp(vec2 b, vec3 p1, vec3 p2, vec3 p3) {
  return (1.0 - b.x - b.y) * p1 + b.x * p2 + b.y * p3;
}

vec2 SampleTriangle(vec2 u) {
  float uxsqrt = sqrt(u.x);
  return vec2(1.0 - uxsqrt, u.y * uxsqrt);
}

// rand functions taken from neo java lib and
// https://github.com/nvpro-samples/optix_advanced_samples
const uint LCG_A = 1664525u;
const uint LCG_C = 1013904223u;
const int MAX_RAND = 0x7fff;
const int IEEE_ONE = 0x3f800000;
const int IEEE_MASK = 0x007fffff;

uint Tea(uint val0, uint val1) {
  uint v0 = val0;
  uint v1 = val1;
  uint s0 = 0;
  for (uint n = 0; n < 16; n++) {
    s0 += 0x9e3779b9;
    v0 += ((v1<<4)+0xa341316c)^(v1+s0)^((v1>>5)+0xc8013ea4);
    v1 += ((v0<<4)+0xad90777d)^(v0+s0)^((v0>>5)+0x7e95761e);
  }
  return v0;
}

uint Rand(inout uint seed) { // random integer in the range [0, MAX_RAND]
  seed = 69069 * seed + 1;
  return ((seed = 69069 * seed + 1) & MAX_RAND);
}

float Randf01(inout uint seed) { // random number in the range [0.0f, 1.0f]
  seed = (LCG_A * seed + LCG_C);
  return float(seed & 0x00FFFFFF) / float(0x01000000u);
}

float Randf11(inout uint seed) { // random number in the range [-1.0f, 1.0f]
  uint i = 0;
  seed = LCG_A * seed + LCG_C;
  i = IEEE_ONE | (((Rand(seed)) & IEEE_MASK) >> 9);
  return uintBitsToFloat(i) - 1.0;
}

vec2 RandInUnitDisk(inout uint seed) {
  vec2 p = vec2(0);
  do {
    p = 2 * vec2(Randf01(seed), Randf01(seed)) - 1;
  } while (dot(p, p) >= 1);
  return p;
}

vec3 RandInUnitSphere(inout uint seed) {
  vec3 p = vec3(0);
  do {
    p = 2 * vec3(Randf01(seed), Randf01(seed), Randf01(seed)) - 1;
  } while (dot(p, p) >= 1);
  return p;
}

// source: internetz
vec3 Hash32(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975,397.2973, 491.1871));
  p3 += dot(p3, p3.yxz + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

vec3 DitherRGB(vec3 c, vec2 seed){
  return c + Hash32(seed) / 255.0;
}

float Luminance(vec3 color) {
  const vec3 luminance = { 0.30, 0.59, 0.11 };
  return dot(color, luminance);
}

vec3 SRGBToLinear(vec3 color) {
  return pow(color, vec3(INV_GAMMA));
}

vec3 Uncharted2ToneMapping(vec3 color) {
  float A = 0.15;
  float B = 0.50;
  float C = 0.10;
  float D = 0.20;
  float E = 0.02;
  float F = 0.30;
  float W = 11.2;
  float exposure = 2.0;
  color *= exposure;
  color = ((color * (A * color + C * B) + D * E) / (color * (A * color + B) + D * F)) - E / F;
  float white = ((W * (A * W + C * B) + D * E) / (W * (A * W + B) + D * F)) - E / F;
  return SRGBToLinear(color / white);
}

vec3 FilmicToneMapping(vec3 color) {
  vec3 x = max(vec3(0.0), color - 0.004);
  color = (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);
  return SRGBToLinear(color);
}

float sqr(float f) {
  return f * f;
}

const float saturation = 0.12;
vec3 ColorGrading(vec3 color) {
  vec3 gray = vec3(dot(LUMINANCE, color));
  color = vec3(mix(color, gray, -saturation)) * 1.0;
  return color;
}

vec3 CosineSampleHemisphere(float u1, float u2) {
  vec3 dir;
  float r = sqrt(u1);
  float phi = TWO_PI * u2;
  dir.x = r * cos(phi);
  dir.y = r * sin(phi);
  dir.z = sqrt(max(0.0, 1.0 - dir.x*dir.x - dir.y*dir.y));
  return dir;
}

float powerHeuristic(float a, float b) {
  float t = a * a;
  return t / (b * b + t);
}

float GTR1(float NdotH, float a) {
  if (a >= 1.0) return INV_PI;
  float a2 = a * a;
  float t = 1.0 + (a2 - 1.0) * NdotH * NdotH;
  return (a2 - 1.0) / (PI * log(a2) * t);
}

float GTR2(float NdotH, float a) {
  float a2 = a * a;
  float t = 1.0 + (a2 - 1.0) * NdotH * NdotH;
  return a2 / (PI * t * t);
}

float SmithGGX_G(float NdotV, float a) {
  float a2 = a * a;
  float b = NdotV * NdotV;
  return 1.0 / (NdotV + sqrt(a2 + b - a2 * b));
}

float SchlickFresnelReflectance(float u) {
  float m = clamp(1.0 - u, 0.0, 1.0);
  float m2 = m * m;
  return m2 * m2 * m;
}

#endif // UTILS_H
