#ifndef DISNEY_H
#define DISNEY_H

#include "utils.glsl"

// based on AMD baikal's disney implementation with some edits:
// https://github.com/GPUOpen-LibrariesAndSDKs/RadeonProRender-Baikal/blob/master/Baikal/Kernels/CL/disney.cl
float DisneyPdf(in const float NdotH, in const float NdotL, in const float HdotL) {
  const float d_pdf = NdotL * (1.0 / PI);
  const float r_pdf = GTR2(NdotH, shading.roughness) * NdotH / (4.0 * HdotL);
  const float c_pdf = GTR1(NdotH, 0.001) * NdotH / (4.0 * HdotL);
  return c_pdf * 0.001 + (shading.csw * r_pdf + (1.0 - shading.csw) * d_pdf);
}

vec3 DisneyEval(in float NdotL, in const float NdotV, in const float NdotH, in const float HdotL) {
  if (NdotL <= 0.0 || NdotV <= 0.0) return vec3(0);

  const vec3 cd_lin = shading.base_color;
  const vec3 c_spec0 = mix(shading.specular * vec3(0.3), cd_lin, shading.metallic);

  // Diffuse fresnel - go from 1 at normal incidence to 0.5 at grazing
  // and mix in diffuse retro-reflection based on roughness
  const float f_wo = SchlickFresnelReflectance(NdotV);
  const float f_wi = SchlickFresnelReflectance(NdotL);

  const float fd90 = 0.5 + 2.0 * HdotL * HdotL * shading.roughness;
  const float fd = mix(1.0, fd90, f_wo) * mix(1.0, fd90, f_wi);

  // Specular
  const float ds = GTR2(NdotH, shading.roughness);
  const float fh = SchlickFresnelReflectance(HdotL);
  const vec3 fs = mix(c_spec0, vec3(1), fh);

  float gs = 0.0;
  const float ro2 = sqr(shading.roughness * 0.5 + 0.5);
  gs = SmithGGX_G(NdotV, ro2);
  gs *= SmithGGX_G(NdotL, ro2);

  // clearcoat (ior = 1.5 -> F0 = 0.04)
  const float dr = GTR1(NdotH, 0.04);
  const float fr = mix(0.04, 1.0, fh);
  const float gr = SmithGGX_G(NdotV, 0.25) * SmithGGX_G(NdotL, 0.25);

  const vec3 f = ((1.0 / PI) * fd * cd_lin) * (1.0 - shading.metallic) + gs * fs * ds + 0.001 * gr * fr * dr;
  return f * NdotL;
}

vec3 DisneySample(inout uint seed, in const vec3 V, in const vec3 N) {
  float r1 = Randf01(seed);
  float r2 = Randf01(seed);

  const vec3 U = abs(N.z) < (1.0 - EPSILON) ? vec3(0, 0, 1) : vec3(1, 0, 0);
  const vec3 T = normalize(cross(U, N));
  const vec3 B = cross(N, T);

  // specular
  if (r2 < shading.csw) {
    r2 /= shading.csw;
    const float a = shading.roughness;
    const float cosTheta = sqrt((1.0 - r2) / (1.0 + (a*a-1.0) * r2));
    const float sinTheta = sqrt(max(0.0, 1.0 - (cosTheta * cosTheta)));
    const float phi = r1 * TWO_PI;
    vec3 H = normalize(vec3(
      cos(phi) * sinTheta,
      sin(phi) * sinTheta,
      cosTheta
    ));
    H = H.x * T + H.y * B + H.z * N;
    H = dot(H, V) <= 0.0 ? H * -1.0 : H;
    return reflect(-V, H);
  }
  // diffuse
  r2 -= shading.csw;
  r2 /= (1.0 - shading.csw);
  const vec3 H = CosineSampleHemisphere(r1, r2);
  return T * H.x + B * H.y + N * H.z;
}

#endif // DISNEY_H
