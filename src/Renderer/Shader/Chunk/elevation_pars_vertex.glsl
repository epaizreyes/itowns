#if NUM_VS_TEXTURES > 0
    struct Layer {
        float scale;
        float bias;
        int mode;
        float zmin;
        float zmax;
    };

    uniform Layer       elevationLayers[NUM_VS_TEXTURES];
    uniform sampler2D   elevationTextures[NUM_VS_TEXTURES];
    uniform vec4        elevationExtents[NUM_VS_TEXTURES];
    uniform int         elevationTextureCount;

    highp float decode32(highp vec4 rgba) {
        highp float Sign = 1.0 - step(128.0,rgba[0])*2.0;
        highp float Exponent = 2.0 * mod(rgba[0],128.0) + step(128.0,rgba[1]) - 127.0;
        highp float Mantissa = mod(rgba[1],128.0)*65536.0 + rgba[2]*256.0 +rgba[3] + float(0x800000);
        highp float Result =  Sign * exp2(Exponent) * (Mantissa * exp2(-23.0 ));
        return Result;
    }

    float getElevationMode(vec2 uv, sampler2D tex, int mode) {
        float res = 0.;
        vec4 color = texture2D( tex, uv );
        if (mode == ELEVATION_RGBA)
            res = decode32(color.abgr * 255.0);
        if (mode == ELEVATION_DATA || mode == ELEVATION_COLOR)
        #if defined(WEBGL2)
            res = color.r;
        #else
            res = color.w;
        #endif
        return res;
    }

    float getElevation(vec2 uv, sampler2D tex, vec4 extent, Layer layer) {
        vec4 uvuv = vec4(uv, extent.zw) - extent.xyxy;
        uv = uvuv.xy/uvuv.zw;
        uv.y = 1.-uv.y;
        float d = getElevationMode(uv, tex, layer.mode);
        if (d < layer.zmin || d > layer.zmax) d = 0.;
        return d * layer.scale + layer.bias;
    }
#endif
