import proj4 from 'proj4';

proj4.defs('EPSG:2154', '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

export default function computeBuffers(params) {
    // Create output buffers.
    const outBuffers = {
        index: null,
        position: null,
    };

    const builder = params.builder;
    const nSeg = params.segment || 8;
    // segments count :
    // Tile : (nSeg + 1) * (nSeg + 1)
    // Skirt : 8 * (nSeg - 1)
    const nVertex = (nSeg + 1) * (nSeg + 1) + (params.disableSkirt ? 0 : 4 * nSeg);
    if (nVertex > 2 ** 32) {
        throw new Error('Tile segments count is too big');
    }

    const triangles = (nSeg) * (nSeg) * 2 + (params.disableSkirt ? 0 : 4 * nSeg * 2);

    outBuffers.position = new Float32Array(nVertex * 3);

    if (params.buildIndex) {
        if (nVertex < 2 ** 8) {
            outBuffers.index = new Uint8Array(triangles * 3);
        } else if (nVertex < 2 ** 16) {
            outBuffers.index = new Uint16Array(triangles * 3);
        } else if (nVertex < 2 ** 32) {
            outBuffers.index = new Uint32Array(triangles * 3);
        }
    }
    const widthSegments = Math.max(2, Math.floor(nSeg) || 2);
    const heightSegments = Math.max(2, Math.floor(nSeg) || 2);

    let idVertex = 0;
    const vertices = [];
    let skirt = [];
    const skirtEnd = [];

    builder.prepare(params);

    for (let y = 0; y <= heightSegments; y++) {
        const verticesRow = [];
        const v = y / heightSegments;

        builder.vProjecte(v, params);

        for (let x = 0; x <= widthSegments; x++) {
            const u = x / widthSegments;
            const id_m3 = idVertex * 3;

            builder.uProjecte(u, params);

            builder.vertexPosition(params, params.projected);

            outBuffers.position[id_m3 + 0] = u;
            outBuffers.position[id_m3 + 1] = v;
            outBuffers.position[id_m3 + 2] = 0;

            if (!params.disableSkirt) {
                if (y !== 0 && y !== heightSegments) {
                    if (x === widthSegments) {
                        skirt.push(idVertex);
                    } else if (x === 0) {
                        skirtEnd.push(idVertex);
                    }
                }
            }

            verticesRow.push(idVertex);

            idVertex++;
        }

        vertices.push(verticesRow);

        if (y === 0) {
            skirt = skirt.concat(verticesRow);
        } else if (y === heightSegments) {
            skirt = skirt.concat(verticesRow.slice().reverse());
        }
    }

    if (!params.disableSkirt) {
        skirt = skirt.concat(skirtEnd.reverse());
    }

    function bufferize(va, vb, vc, idVertex) {
        outBuffers.index[idVertex + 0] = va;
        outBuffers.index[idVertex + 1] = vb;
        outBuffers.index[idVertex + 2] = vc;
        return idVertex + 3;
    }

    let idVertex2 = 0;

    if (params.buildIndex) {
        for (let y = 0; y < heightSegments; y++) {
            for (let x = 0; x < widthSegments; x++) {
                const v1 = vertices[y][x + 1];
                const v2 = vertices[y][x];
                const v3 = vertices[y + 1][x];
                const v4 = vertices[y + 1][x + 1];

                idVertex2 = bufferize(v4, v2, v1, idVertex2);
                idVertex2 = bufferize(v4, v3, v2, idVertex2);
            }
        }
    }

    const iStart = idVertex;

    // TODO: WARNING beware skirt's size influences performance
    // The size of the skirt is now a ratio of the size of the tile.
    // To be perfect it should depend on the real elevation delta but too heavy to compute
    if (!params.disableSkirt) {
        let buildIndexSkirt = function buildIndexSkirt() { };

        if (params.buildIndex) {
            buildIndexSkirt = function buildIndexSkirt(id, v1, v2, v3, v4) {
                id = bufferize(v1, v2, v3, id);
                id = bufferize(v1, v3, v4, id);
                return id;
            };
        }

        for (let i = 0; i < skirt.length; i++) {
            const id = skirt[i];
            const id_m3 = idVertex * 3;
            const id2_m3 = id * 3;

            outBuffers.position[id_m3 + 0] = outBuffers.position[id2_m3 + 0];
            outBuffers.position[id_m3 + 1] = outBuffers.position[id2_m3 + 1];
            outBuffers.position[id_m3 + 2] = -1;

            const idf = (i + 1) % skirt.length;

            const v1 = id;
            const v2 = idVertex;
            const v3 = (idf === 0) ? iStart : idVertex + 1;
            const v4 = skirt[idf];

            idVertex2 = buildIndexSkirt(idVertex2, v1, v2, v3, v4);

            idVertex++;
        }
    }

    return outBuffers;
}
