#include <itowns/WebGL2_pars_vertex>
#include <itowns/precision_qualifier>
#include <common>
#include <itowns/project_pars_vertex>
#include <itowns/elevation_pars_vertex>
#include <logdepthbuf_pars_vertex>
attribute vec3      normal;
attribute vec2      wgs84;
attribute vec2      l93;

uniform mat4 modelMatrix;
uniform bool lightingEnabled;

#if MODE == MODE_FINAL
#include <fog_pars_vertex>
varying vec3        vNormal;
#endif
varying vec2        vWgs84;
varying vec2        vPM;
varying vec2        vL93;

const float PI_OVER_4 = 0.25*PI;
const float PI_OVER_360 = PI / 360.;
const float PM_MAX = PI * 85.0511287798066 / 90.;

void main() {
        vWgs84 = wgs84;
        vPM = vec2(wgs84.x, clamp(log(tan(PI_OVER_4 + PI_OVER_360 * wgs84.y)), -PM_MAX, PM_MAX));
        vL93 = l93;
        vec2 uv = wgs84;
        #include <begin_vertex>
        #include <itowns/elevation_vertex>
        #include <project_vertex>
        #include <logdepthbuf_vertex>
#if MODE == MODE_FINAL
        #include <fog_vertex>
        vNormal = normalize ( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
#endif
}