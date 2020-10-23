#include <itowns/WebGL2_pars_vertex>
#include <itowns/precision_qualifier>
#include <common>
#include <itowns/project_pars_vertex>
#include <itowns/elevation_pars_vertex>
#include <logdepthbuf_pars_vertex>
uniform vec4        extent;

uniform mat4        modelMatrix;
uniform bool        lightingEnabled;
uniform float       skirtHeight;

#if MODE == MODE_FINAL
#include <fog_pars_vertex>
varying vec3        vNormal;
#endif
varying vec2        vWgs84;
varying vec2        vPM;
varying vec2        vL93;

const float PI_OVER_4 = 0.25*PI;
const float PI_OVER_2 = 0.5*PI;
const float PI_OVER_360 = PI / 360.;
const float PM_MAX = PI * 85.0511287798066 / 90.;

#define TILE_CRS_DEFAULT 0
#define TILE_CRS_CARTESIAN 1
#define TILE_CRS_CARTOGRAPHIC 2
#define TILE_CRS TILE_CRS_CARTOGRAPHIC
uniform vec3        inv_radii_squared;

#include <proj/geocent>
#include <proj/lcc>
uniform geocent_t proj_geocent[1];
uniform lcc_t proj_lcc[1];

void main() {
        vec3 wgs84 = vec3(extent.xy + position.xy * (extent.zw - extent.xy), position.z * skirtHeight);
        vec2 l93 = vec2(0.);
        vec3 normal;
        #if TILE_CRS == TILE_CRS_DEFAULT
                normal = normalize(inv_radii_squared * position);
        #elif TILE_CRS == TILE_CRS_CARTESIAN
                normal = vec3(0., 0., 1.);
        #else // TILE_CRS == TILE_CRS_CARTOGRAPHIC
                vec3 wgs84rad = vec3(wgs84.xy * (PI / 180.), wgs84.z);
                vec2 coswgs84 = cos(wgs84rad.xy);
                vec2 sinwgs84 = sin(wgs84rad.xy);
                normal = vec3(coswgs84.y*coswgs84.x, coswgs84.y*sinwgs84.x, sinwgs84.y);

                vec3 geocent = proj_forward(proj_geocent[0], wgs84rad);
                l93 = proj_forward(proj_lcc[0], wgs84rad).xy;
        #endif
        vWgs84 = wgs84.xy;
        vPM = vec2(wgs84.x, clamp(log(abs(tan(PI_OVER_4 + PI_OVER_360 * wgs84.y))), -PM_MAX, PM_MAX));
        vL93 = l93;
        #include <begin_vertex>
        #if TILE_CRS == TILE_CRS_CARTOGRAPHIC
                transformed = geocent;
        #endif
        #include <itowns/elevation_vertex>
        #include <project_vertex>
        #include <logdepthbuf_vertex>
#if MODE == MODE_FINAL
        #include <fog_vertex>
        vNormal = normalize ( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
#endif
}