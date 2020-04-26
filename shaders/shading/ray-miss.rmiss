#version 460
#extension GL_EXT_ray_tracing : enable
#extension GL_EXT_nonuniform_qualifier : enable
#extension GL_GOOGLE_include_directive : enable
#pragma shader_stage(miss)

#include "utils.glsl"

layout (location = 0) rayPayloadInEXT RayPayload Ray;

void main() {
  // gradient based env
  const float t = 0.75 * (normalize(gl_WorldRayDirectionEXT).y + 1.0);
  vec3 color = mix(vec3(0.005), vec3(0.0075), t);

  Ray.throughput = vec4(0);
  Ray.radianceAndDistance = vec4(pow(color, vec3(2.2)), -1.0);
}
