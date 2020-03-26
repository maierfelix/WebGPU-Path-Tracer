#ifndef DISNEY_H
#define DISNEY_H

#include "utils.glsl"

// based on AMD baikal's disney implementation with some edits:
// https://github.com/GPUOpen-LibrariesAndSDKs/RadeonProRender-Baikal/blob/master/Baikal/Kernels/CL/disney.cl
float DisneyPdf(in const float NdotH, in const float NdotL, in const float HdotL) {
  const float d_pdf = NdotL * (1.0 / PI);
  const float r_pdf = GTR2(NdotH, max(0.001, max(0.001, shading.roughness))) * NdotH / (4.0 * HdotL);
  const float c_pdf = GTR1(NdotH, mix(0.1, 0.001, mix(0.1, 0.001, shading.clearcoat_gloss))) * NdotH / (4.0 * HdotL);

  const float cs_w = shading.csw;

  return c_pdf * shading.clearcoat + (1.0 - shading.clearcoat) * (cs_w * r_pdf + (1.0 - cs_w) * d_pdf);
}

vec3 DisneyEval(in float NdotL, in const float NdotV, in const float NdotH, in const float HdotL) {
  if (NdotL <= 0.0 || NdotV <= 0.0) return vec3(0);

  const vec3 cd_lin = shading.base_color;
  const float cd_lum = dot(cd_lin, vec3(0.3, 0.6, 0.1));
  const vec3 c_tint = cd_lum > 0.0 ? (cd_lin / cd_lum) : vec3(1);
  const vec3 c_spec0 = mix(shading.specular * 0.3 * mix(vec3(1), c_tint, shading.specular_tint), cd_lin, shading.metallic);
  const vec3 c_sheen = mix(vec3(1), c_tint, shading.sheen_tint);

  // Diffuse fresnel - go from 1 at normal incidence to 0.5 at grazing
  // and mix in diffuse retro-reflection based on roughness
  const float f_wo = SchlickFresnelReflectance(NdotV);
  const float f_wi = SchlickFresnelReflectance(NdotL);

  const float fd90 = 0.5 + 2.0 * HdotL * HdotL * shading.roughness;
  const float fd = mix(1.0, fd90, f_wo) * mix(1.0, fd90, f_wi);

  // Based on Hanrahan-Krueger brdf approximation of isotropic bssrdf
  // 1.25 scale is used to (roughly) preserve albedo
  // fss90 used to "flatten" retroreflection based on roughness
  const float fss90 = HdotL * HdotL * shading.roughness;
  const float fss = mix(1.0, fss90, f_wo) * mix(1.0, fss90, f_wi);
  const float ss = 1.25 * (fss * (1.0 / (NdotV + NdotL) - 0.5) + 0.5);

  // Specular
  //float ax = max(0.001, roughness * roughness * (1.0 + anisotropy));
  //float ay = max(0.001, roughness * roughness * (1.0 - anisotropy));
  const float ro = max(0.001, shading.roughness);
  const float ds = GTR2(NdotH, ro);
  const float fh = SchlickFresnelReflectance(HdotL);
  const vec3 fs = mix(c_spec0, vec3(1), fh);

  float gs = 0.0;
  const float ro2 = sqr(shading.roughness * 0.5 + 0.5);
  gs = SmithGGX_G(NdotV, ro2);
  gs *= SmithGGX_G(NdotL, ro2);

  // Sheen
  const vec3 f_sheen = fh * shading.sheen * c_sheen;

  // clearcoat (ior = 1.5 -> F0 = 0.04)
  const float dr = GTR1(NdotH, mix(0.1, 0.001, shading.clearcoat_gloss));
  const float fr = mix(0.04, 1.0, fh);
  const float gr = SmithGGX_G(NdotV, 0.25) * SmithGGX_G(NdotL, 0.25);

  const vec3 f = ((1.0 / PI) * mix(fd, ss, shading.subsurface) * cd_lin + f_sheen) * (1.0 - shading.metallic) + gs * fs * ds + (0.25 * shading.clearcoat) * gr * fr * dr;
  return f * NdotL;
}

vec3 DisneySample(inout uint seed, in const vec3 V, in const vec3 N) {
  float r1 = Randf01(seed);
  float r2 = Randf01(seed);

  const vec3 U = abs(N.z) < (1.0 - EPSILON) ? vec3(0, 0, 1) : vec3(1, 0, 0);
  const vec3 T = normalize(cross(U, N));
  const vec3 B = cross(N, T);

  // clearcoat
  if (r1 < shading.clearcoat) {
    r1 /= (shading.clearcoat);
    const float a = mix(0.1, 0.001, shading.clearcoat_gloss);
    const float cosTheta = sqrt((1.0 - pow(a*a, 1.0 - r2)) / (1.0 - a*a));
    const float sinTheta = sqrt(max(0.0, 1.0 - (cosTheta * cosTheta)));
    const float phi = r1 * TWO_PI;
    vec3 H = normalize(vec3(
      cos(phi) * sinTheta,
      sin(phi) * sinTheta,
      cosTheta
    ));
    H = H.x * T + H.y * B + H.z * N;
    if (dot(H, V) <= 0.0) H = H * -1.0;
    return reflect(-V, H);
  }
  r1 -= (shading.clearcoat);
  r1 /= (1.0 - shading.clearcoat);
  // specular
  if (r2 < shading.csw) {
    r2 /= shading.csw;
    const float a = max(0.001, shading.roughness);
    const float cosTheta = sqrt((1.0 - r2) / (1.0 + (a*a-1.0) * r2));
    const float sinTheta = sqrt(max(0.0, 1.0 - (cosTheta * cosTheta)));
    const float phi = r1 * TWO_PI;
    vec3 H = normalize(vec3(
      cos(phi) * sinTheta,
      sin(phi) * sinTheta,
      cosTheta
    ));
    H = H.x * T + H.y * B + H.z * N;
    if (dot(H, V) <= 0.0) H = H * -1.0;
    return reflect(-V, H);
  }
  // diffuse
  r2 -= shading.csw;
  r2 /= (1.0 - shading.csw);
  const vec3 H = CosineSampleHemisphere(r1, r2);
  return T * H.x + B * H.y + N * H.z;
}

#endif // DISNEY_H
