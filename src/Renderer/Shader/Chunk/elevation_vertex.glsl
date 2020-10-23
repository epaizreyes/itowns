#if NUM_VS_TEXTURES > 0
    if(elevationTextureCount > 0) {
        vec3 uv = wgs84; // TODO
        float elevation = uv.z + getElevation(uv.yx, elevationTextures[0], elevationExtents[0], elevationLayers[0]);
        transformed += elevation * normal;
    }
#endif
