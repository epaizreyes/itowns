import * as THREE from 'three';

import color_layers_pars_fragment from './Chunk/color_layers_pars_fragment.glsl';
import elevation_pars_vertex from './Chunk/elevation_pars_vertex.glsl';
import elevation_vertex from './Chunk/elevation_vertex.glsl';
import fog_fragment from './Chunk/fog_fragment.glsl';
import fog_pars_fragment from './Chunk/fog_pars_fragment.glsl';
import lighting_fragment from './Chunk/lighting_fragment.glsl';
import lighting_pars_fragment from './Chunk/lighting_pars_fragment.glsl';
import mode_pars_fragment from './Chunk/mode_pars_fragment.glsl';
import mode_depth_fragment from './Chunk/mode_depth_fragment.glsl';
import mode_id_fragment from './Chunk/mode_id_fragment.glsl';
import overlay_fragment from './Chunk/overlay_fragment.glsl';
import overlay_pars_fragment from './Chunk/overlay_pars_fragment.glsl';
import pitUV from './Chunk/pitUV.glsl';
import precision_qualifier from './Chunk/precision_qualifier.glsl';
import project_pars_vertex from './Chunk/project_pars_vertex.glsl';
import projective_texturing_vertex from './Chunk/projective_texturing_vertex.glsl';
import projective_texturing_pars_vertex from './Chunk/projective_texturing_pars_vertex.glsl';
import projective_texturing_pars_fragment from './Chunk/projective_texturing_pars_fragment.glsl';
import WebGL2_pars_vertex from './Chunk/WebGL2_pars_vertex.glsl';
import WebGL2_pars_fragment from './Chunk/WebGL2_pars_fragment.glsl';

const ShaderChunk = {
    color_layers_pars_fragment,
    elevation_pars_vertex,
    elevation_vertex,
    fog_fragment,
    fog_pars_fragment,
    lighting_fragment,
    lighting_pars_fragment,
    mode_depth_fragment,
    mode_id_fragment,
    mode_pars_fragment,
    overlay_fragment,
    overlay_pars_fragment,
    pitUV,
    precision_qualifier,
    projective_texturing_vertex,
    projective_texturing_pars_vertex,
    projective_texturing_pars_fragment,
    project_pars_vertex,
    WebGL2_pars_vertex,
    WebGL2_pars_fragment,
};

/**
 * Install chunks in a target, for example THREE.ShaderChunk, with adding an
 * optional path.
 *
 * @param {Object} target - The target to install the chunks into.
 * @param {Object} chunks - The chunks to install. The key of each chunk will be
 * the name of installation of the chunk in the target (plus an optional path).
 * @param {string} [path] - A path to add before a chunk name as a prefix.
 *
 * @return {Object} The target with installed chunks.
 */
ShaderChunk.install = function install(target, chunks, path) {
    if (!path) { return Object.assign(target, this); }
    Object.keys(chunks).forEach((key) => {
        if (key == 'install') { return; }
        target[path + key] = chunks[key];
    });

    return target;
};

// Install all default shaders under the itowns
ShaderChunk.install(THREE.ShaderChunk, ShaderChunk, 'itowns/');

const projChunks = {
    geocent: '#ifndef GEOCENT_T_GLSL\n#define GEOCENT_T_GLSL\nstruct geocent_t {\n  float a, b, e, eprime, e2;\n  vec3 p0;\n  float k0;\n};\n#endif\nvec3 proj_forward (geocent_t t, vec3 p) { // lon lat height\n  vec2 cosp = cos(p.xy);\n  vec2 sinp = sin(p.xy);\n  float N = t.a / sqrt(1.0-t.e2*sinp.y*sinp.y);\n  float Npz = N + p.z;\n  vec2 q = (Npz * cosp.y) * vec2(cosp.x, sinp.x);\n  return t.p0 + t.k0 * vec3(q, (Npz-N*t.e2)*sinp.y);\n}\nvec3 proj_forward (geocent_t t, vec2 p) {\n  return proj_forward(t,vec3(p,0));\n}\nvec3 proj_inverse (geocent_t t, vec3 p) {\n  p = (p-t.p0)/t.k0;\n  float sqp = length(p.xy);\n  float theta = atan(p.z*t.a,sqp*t.b);\n  float sintheta = sin(theta);\n  float costheta = cos(theta);\n  float lat = atan(\n    p.z+t.eprime*t.eprime*t.b*sintheta*sintheta*sintheta,\n    sqp-t.e*t.e*t.a*costheta*costheta*costheta\n  );\n  float lon = atan(p.y,p.x);\n  float sinlat = sin(lat);\n  float coslat = cos(lat);\n  float alt = (sqp/coslat)-t.a/sqrt(1.0-t.e*t.e*sinlat*sinlat);\n  return vec3(lon,lat,alt);\n}\n',
    lcc: '#ifndef LCC_T_GLSL\n#define LCC_T_GLSL\nstruct lcc_t {\n  float lon0;\n  vec3 p0;\n  float af0, e;\n  float k0, ns, rh;\n};\n#endif\n#ifndef CONSTANTS_GLSL\n#define CONSTANTS_GLSL\nconst float SPI = 3.14159265359;\nconst float TAU = 6.283185307179586;\n#ifndef PI\n#define PI 3.141592653589793\n#endif\n#ifndef EPSILON\n#define EPSILON 1.0e-10\n#endif\nconst float HALFPI = 0.5 * PI;\n#endif\n#ifndef TSFNZ_GLSL\n#define TSFNZ_GLSL\nfloat tsfnz (float eccent, float phi, float sinphi) {\n  float con = eccent * sinphi;\n  float com = 0.5 * eccent;\n  con = pow(((1.0-con)/(1.0+con)),com);\n  return tan(0.5*(HALFPI-phi))/con;\n}\n#endif\n#ifndef PHI2Z_GLSL\n#define PHI2Z_GLSL\nfloat phi2z (float eccent, float ts) {\n  float eccnth = 0.5 * eccent;\n  float con, dphi;\n  float phi = HALFPI-2.0*atan(ts);\n  for (int i = 0; i <= 15; i++) {\n    con = eccent * sin(phi);\n    dphi = PI*0.5-2.0*atan(ts*pow((1.0-con)/(1.0+con),eccnth))-phi;\n    phi += dphi;\n    if (abs(dphi) <= EPSILON) return phi;\n  }\n  return -9999.0;\n}\n#endif\n#ifndef PHI2Z_GLSL\n#define PHI2Z_GLSL\nfloat phi2z (float eccent, float ts) {\n  float eccnth = 0.5 * eccent;\n  float con, dphi;\n  float phi = HALFPI-2.0*atan(ts);\n  for (int i = 0; i <= 15; i++) {\n    con = eccent * sin(phi);\n    dphi = PI*0.5-2.0*atan(ts*pow((1.0-con)/(1.0+con),eccnth))-phi;\n    phi += dphi;\n    if (abs(dphi) <= EPSILON) return phi;\n  }\n  return -9999.0;\n}\n#endif\nvec3 proj_forward (lcc_t t, vec3 p) { // lat lon height -> x y z\n  p.x = t.ns * (p.x - t.lon0);\n  // p.y = clamp(p.y, -HALFPI, HALFPI); // optional ?\n  vec2 sintl = sin(p.xy);\n  float ts = tsfnz(t.e, p.y, sintl.y);\n  float rh1 = t.af0 * pow(ts, t.ns);\n  return t.p0 + t.k0 * vec3(\n    rh1*sintl.x,\n    t.rh-rh1*cos(p.x),\n    p.z\n  );\n}\nvec3 proj_forward (lcc_t t, vec2 p) {\n  return proj_forward(t,vec3(p.xy,0));\n}\nvec3 proj_inverse (lcc_t t, vec3 p) {\n  p = (p - t.p0) / t.k0;\n  p.y = t.rh - p.y;\n  float rh1 = length(p.xy);\n\n  float theta = rh1 > EPSILON ? atan(p.x, p.y) : 0.0;\n  if (t.ns < 0.0) {\n    rh1 = -rh1;\n    theta += PI;\n  }\n  theta = theta/t.ns + t.lon0;\n\n  float phi = -HALFPI;\n  if (abs(rh1) > EPSILON || t.ns > 0.0) {\n    float ts = pow(rh1 / t.af0, 1.0 / t.ns);\n    phi = phi2z(t.e, ts);\n  }\n\n  return vec3(theta, phi, p.z);\n}\nvec3 proj_inverse (lcc_t t, vec2 p) {\n  return proj_inverse(t,vec3(p,0));\n}\n',
};

ShaderChunk.install(THREE.ShaderChunk, projChunks, 'proj/');

export default ShaderChunk;
