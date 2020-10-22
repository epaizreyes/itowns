#if NUM_VS_TEXTURES > 0
    if(elevationTextureCount > 0) {
        vec2 uv = wgs84; // TODO
        float elevation = getElevation(uv, elevationTextures[0], elevationExtents[0], elevationLayers[0]);
        transformed += elevation * normal;
    }
#endif
