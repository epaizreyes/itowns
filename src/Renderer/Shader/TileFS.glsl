#include <itowns/WebGL2_pars_fragment>
#include <itowns/precision_qualifier>
#include <logdepthbuf_pars_fragment>
#include <itowns/pitUV>
varying vec2        vWgs84;
varying vec2        vPM;
varying vec2        vL93;
#include <itowns/color_layers_pars_fragment>
#if MODE == MODE_FINAL
#include <itowns/fog_pars_fragment>
#include <itowns/overlay_pars_fragment>
#include <itowns/lighting_pars_fragment>
#endif
#include <itowns/mode_pars_fragment>

uniform vec3        diffuse;
uniform float       opacity;
varying vec3        vUv; // uv_0.x/uv_1.x, uv_0.y, uv_1.y

void main() {
    #include <logdepthbuf_fragment>

#if MODE == MODE_ID

    #include <itowns/mode_id_fragment>

#elif MODE == MODE_DEPTH

    #include <itowns/mode_depth_fragment>

#else

    gl_FragColor = vec4(diffuse, opacity);

    uvs[0] = vWgs84;
    uvs[1] = vPM;
    uvs[2] = vL93;

    vec4 color;
    #pragma unroll_loop
    for ( int i = 0; i < NUM_FS_TEXTURES; i ++ ) {
        color = getLayerColor( i , colorTextures[ i ], colorExtents[ i ], colorLayers[ i ]);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, color.rgb, color.a);
    }

  #if defined(DEBUG)
    if (showOutline) {
        #pragma unroll_loop
        for ( int i = 0; i < NUM_CRS; i ++) {
            color = getOutlineColor( outlineColors[ i ], uvs[ i ].xy);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, color.rgb, color.a);
        }
    }
  #endif

    #include <itowns/fog_fragment>
    #include <itowns/lighting_fragment>
    #include <itowns/overlay_fragment>
#endif
gl_FragColor.rg = mix(gl_FragColor.rg,fract(vWgs84/10.),0.1);
if (vL93.x > -357823.2365 && vL93.x < 1313632.3628 && vL93.y >  6037008.6939 && vL93.y < 7230727.3772)
       gl_FragColor.rg = mix(gl_FragColor.rg,fract(vL93/100000.),0.5);
}
