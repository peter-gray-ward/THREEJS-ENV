import { randomInRange, getInstancePosition } from '/src/util.js';

const LEVEL = [
    null,
    "Heart of the Woods"
];

class GrassPatch {
    constructor(initobject) {
        this.mesh = initobject.mesh;
        this.bladePositions = initobject.bladePositions;
    }
}

class Tree {
    constructor(trunk, foliage) {
        this.trunk = trunk;  // TubeMesh (representing the trunk)
        this.foliage = foliage;  // SphereMesh (representing the foliage)
        this.boundingBox = new THREE.Box3().setFromObject(this.trunk).union(new THREE.Box3().setFromObject(this.foliage));
    }
}

export default class Terrain {


    constructor(vm) {
        let _textures = vm.map[vm.user.level].textures;
        for (var key in _textures) {
            _textures[key] = _textures[key].map(t => new THREE.TextureLoader().load(t));
        }
        this.textures =  _textures;
        this.vertices = new Map();
        this.meshes = [];
        this.markers = {};
        this.surroundingCenters = [];
        this.currentMesh = 0;
        this.center = new THREE.Vector3(0, 0, 0);
        this.generate();
    }

    generate(centerX = 0, centerY = 0, centerZ = 0) {
        const centerKey = `${centerX}_${centerZ}`;
        this.terrainType = ['sparse', 'dense', 'half'][Math.floor(Math.random() * 3)];
        for (var i = 0; i < this.meshes.length; i++) {
            if (this.meshes[i].centerKey == centerKey) {
                debugger
            }
        }
        
        this.cliffs = [];
        this.grounds = [];
        this.grassTriangles = [];
        this.cliffMeshes = [];

        let t = VM.map[VM.user.level].quadrant;
        let center = { x: centerX, y: centerY, z: centerZ }

        let v0 = { x: center.x - t, y: center.y, z: center.z + t };
        let v1 = { x: center.x + t, y: center.y, z: center.z + t }; 
        let v2 = { x: center.x + t, y: center.y, z: center.z - t }; 
        let v3 = { x: center.x - t, y: center.y, z: center.z - t };

        let vertices = [];
        let indices = [];

        for (var key in VM.map[VM.user.level]) {
            this[key] = VM.map[VM.user.level][key];
        }

        const segmentSize = 1 / this.segments;
        this.groundColorMap = new Array(this.segments + 1).fill().map(() => new Array(this.segments + 1).fill(0));  // Initialize ground color map


        const neighbors = this.meshes.filter(mesh => this.isNeighbor(mesh.centerKey, centerKey));

        if (neighbors.length > 0) {
            var generationRootSlices = this.getRootSlices(centerKey, neighbors);
            for (var obj of generationRootSlices) {
                this.renderNoiseSlice(obj, this.width, this.height, center); 
            }
            
        }
        let perlinNoise = this.generatePerlinNoise({ center, centerKey });

        // let woodTerrain = this.generateRandomWoodsTerrain();

        // Generate vertices and initial setup
        for (let i = 0; i <= this.segments; i++) {
            for (let j = 0; j <= this.segments; j++) {
                let x = i * segmentSize;
                let y = j * segmentSize;

                let v = new THREE.Vector3();
                v.x = (1 - x) * (1 - y) * v0.x + x * (1 - y) * v1.x + x * y * v2.x + (1 - x) * y * v3.x;
                v.y = (1 - x) * (1 - y) * v0.y + x * (1 - y) * v1.y + x * y * v2.y + (1 - x) * y * v3.y;
                v.z = (1 - x) * (1 - y) * v0.z + x * (1 - y) * v1.z + x * y * v2.z + (1 - x) * y * v3.z;

                let noiseX = Math.floor(x * (this.noiseWidth - 1));
                let noiseY = Math.floor(y * (this.noiseHeight - 1));
                let variance = perlinNoise[noiseY * this.noiseWidth + noiseX] * this.altitudeVariance;
                //let variance = woodTerrain[noiseY * this.noiseWidth + noiseX] * this.altitudeVariance;;

                v.y += variance;

                if ([v.x, v.y, v.z].some(isNaN)) {
                    debugger
                }
                vertices.push(v.x, v.y, v.z);
            }
        }


        for (var m of this.meshes) {
            for (var x1 = 0; x1 < m.geometry.attributes.position.array.length; x1 += 3) { 
                for (var x2 = 0; x2 < vertices.length; x2 += 3) {
                    var sameX = m.geometry.attributes.position.array[x1] == vertices[x2];
                    var sameZ = m.geometry.attributes.position.array[x1 + 2] == vertices[x2 + 2];
                    var differentY = m.geometry.attributes.position.array[x1 + 1] == vertices[x2 + 1]

                    if (sameX && sameZ && differentY) {
                        vertices[x2 + 1] = m.geometry.attributes.position.array[x1 + 1];

                    } else if (sameX && Math.abs(m.geometry.attributes.position.array[x1 + 2] - vertices[x2 + 2]) < 2) {
                        vertices[x2 + 1] = m.geometry.attributes.position.array[x1 + 1];
                    } else if (sameZ && Math.abs(m.geometry.attributes.position.array[x1] - vertices[x2]) < 2) {
                        vertices[x2 + 1] = m.geometry.attributes.position.array[x1 + 1];
                    }
                }
            }
        }


        var grassPatches = new Array(this.segments + 1).fill().map(() => new Array(this.segments + 1).fill(false));  // Initialize an array to track grass patches
        
        
        switch (this.terrainType) {
            case 'dense':
                for (let i = 0; i < this.segments; i++) {
                    for (let j = 0; j < this.segments; j++) {
                        for (var k = 0; k < 3; k++) {
                            grassPatches[i][j] = Math.random() < 0.7;
                        }
                    }
                }
                break;
            case 'sparse':
                for (let i = 0; i < this.segments; i++) {
                    for (let j = 0; j < this.segments; j++) {
                        for (var k = 0; k < 3; k++) {
                            grassPatches[i][j] = Math.random() < 0.1;
                        }
                    }
                }
                break;
            case 'half':
                for (let i = 0; i < this.segments; i++) {
                    for (let j = 0; j < this.segments; j++) {
                        for (var k = 0; k < 3; k++) {
                            grassPatches[i][j] = Math.random() < 0.5;
                        }
                    }
                }
                break;
                        
        }
        

        var start_i = 1.0;
        // Process triangles and apply grass in defined ranges
        for (let i = 0; i < this.segments; i++) {
            if (new Number(i / this.segments).toFixed(1) != start_i) {
                start_i = new Number((i + 1) / this.segments).toFixed(2);
                console.log(start_i)
            }
            for (let j = 0; j < this.segments; j++) {
                let a = i + j * (this.segments + 1);
                let b = (i + 1) + j * (this.segments + 1);
                let c = (i + 1) + (j + 1) * (this.segments + 1);
                let d = i + (j + 1) * (this.segments + 1);

                if (a >= 0 && b >= 0 && c >= 0 && d >= 0 && a < vertices.length / 3 && b < vertices.length / 3 && c < vertices.length / 3 && d < vertices.length / 3) {
                    indices.push(a, b, d);
                    indices.push(b, c, d);
                    

                    const t1 = this.TriangleMesh(vertices, a, b, d, this.width, this.height);
                    const t2 = this.TriangleMesh(vertices, b, c, d, this.width, this.height);

                    [t1, t2].forEach((triangle) => {
                        VM.map[VM.user.level].grounds.push(triangle);

                        const normal = triangle.normal;
                        const slope = Math.atan2(normal.y, normal.x);

                        const isVertical = Math.abs(slope) > Math.PI / 2 - 0.1 && Math.abs(slope) < Math.PI / 2 + 0.1;


                        //  // Check if VM triangle is either in a grass patch or adjacent to one
                        const isNearGrassPatch = (grassPatches[i][j] || 
                                                  (i > 0 && grassPatches[i - 1][j]) ||  // Check left
                                                  (i < this.segments && grassPatches[i + 1][j]) ||  // Check right
                                                  (j > 0 && grassPatches[i][j - 1]) ||  // Check above
                                                  (j < this.segments && grassPatches[i][j + 1]) ||  // Check below
                                                  (i > 0 && j > 0 && grassPatches[i - 1][j - 1]) ||  // Check top-left diagonal
                                                  (i < this.segments && j > 0 && grassPatches[i + 1][j - 1]) ||  // Check top-right diagonal
                                                  (i > 0 && j < this.segments && grassPatches[i - 1][j + 1]) ||  // Check bottom-left diagonal
                                                  (i < this.segments && j < this.segments && grassPatches[i + 1][j + 1])  // Check bottom-right diagonal
                        );

                        const isTree = eval(this.treeCondition);
                        
                        //
                        // Grasses!
                        //
                        if (isNearGrassPatch && !isVertical) {
                            triangle.material.opacity = randomInRange(0.001, 0.5);
                            triangle.material.color.set(this.Grass[Math.floor(Math.random() * this.Grass.length)]);

                            const grassResult = this.createGrassPatch(indices, vertices, triangle);

                            VM.map[VM.user.level].grasses.push(grassResult);

                        }
                        //
                        // Trees!
                        //

                        if (isTree && !isNearGrassPatch) {
                            var tree = this.createTree(triangle.triangle.a.x, triangle.triangle.a.y, triangle.triangle.a.z, 1);
                            VM.map[VM.user.level].trees.push(tree);
                        }

                        //
                        // Cliffs!
                        //

                        // if (isCliff) {
                        //     this.cliffs.push(triangle.triangle);
                        // }
                    });

                    
                }
            }


        }

        
        // Now, let's apply the grass density in groundColorMap to color the vertices
        const colors = [];
        const gridSize = this.groundColorMap.length;  // Assuming groundColorMap is a 2D array of the grid size

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const density = this.groundColorMap[i][j];

                // Ensure that color application and grass application use the same coordinates
                const vertexIndex = i * (this.segments + 1) + j;  // Adjust based on segment count and grid

                if (vertexIndex < vertices.length / 3) {  // Ensure vertex index is within bounds
                    if (density > 0) {
                        // More grass means more green intensity
                        const greenIntensity = Math.min(0.8, Math.pow(density / 10, 0.7));  // Non-linear scaling for green intensity
                        const red = randomInRange(0, 0.2);  // Slightly larger range for red
                        const blue = randomInRange(0, 0.2);  // Slightly larger range for blue

                        colors.push(red, greenIntensity, blue);  // Push RGB color with more balanced variation

                    } else {
                        // No grass means brown soil
                        colors.push(randomInRange(0.1, 0.3), randomInRange(0.11, 0.15), randomInRange(0, 0.08));  // RGB color for dark brown soil
                    }
                }
            }
        }


        // Create red spheres at boundary positions
        const sphereGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        // ... rest of the existing code ...

        // Add this method to the Terrain class
        

        this.colors = colors;
        this.gridSize = gridSize;

        // Apply vertex colors to the geometry
        const planeGeometry = new THREE.BufferGeometry();
        planeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        planeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));  // Add vertex colors
        planeGeometry.setIndex(indices);
        planeGeometry.computeVertexNormals();
        planeGeometry.computeBoundingBox();

        // Apply the custom texture to the terrain
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,  // Enable vertex colors
            side: THREE.DoubleSide,
            transparent: false,
            opacity: 0.1
        });

        const mesh = new THREE.Mesh(planeGeometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.mesh = mesh;

        this.mesh.noise = perlinNoise;

        this.mesh.centerKey = centerKey;

        scene.add(mesh);

       
        this.meshes.push(this.mesh);




        return this;
    }

    TriangleMesh(vertices, a, b, c, terrainWidth, terrainHeight) {

        const triangleGeometry = new THREE.BufferGeometry();

        // Extract vertex positions
        const vertexPositions = [
            vertices[a * 3], vertices[a * 3 + 1], vertices[a * 3 + 2],
            vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2],
            vertices[c * 3], vertices[c * 3 + 1], vertices[c * 3 + 2]
        ];

        triangleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertexPositions, 3));
        triangleGeometry.setIndex([0, 1, 2]);
        triangleGeometry.computeVertexNormals();
        triangleGeometry.computeBoundingBox();

        // Calculate UVs (using simple planar mapping based on X and Z coordinates)
        const uvs = [
            vertexPositions[0] / terrainWidth, vertexPositions[2] / terrainHeight,  // Vertex a
            vertexPositions[3] / terrainWidth, vertexPositions[5] / terrainHeight,  // Vertex b
            vertexPositions[6] / terrainWidth, vertexPositions[8] / terrainHeight   // Vertex c
        ];

        triangleGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));  // Add UVs

        const triangleMaterial = new THREE.MeshStandardMaterial({
            transparent: false,
            wireframe: false,
            color: 'red',
            side: THREE.DoubleSide
            // color: new THREE.Color(Math.random(), Math.random(), Math.random())
        });
        

        const triangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial);
        triangleMesh.castShadow = true;
        triangleMesh.receiveShadow = true;

        // Store the triangle geometry in a THREE.Triangle object
        triangleMesh.triangle = new THREE.Triangle(
            new THREE.Vector3(vertexPositions[0], vertexPositions[1], vertexPositions[2]),
            new THREE.Vector3(vertexPositions[3], vertexPositions[4], vertexPositions[5]),
            new THREE.Vector3(vertexPositions[6], vertexPositions[7], vertexPositions[8])
        );

        // Calculate the triangle's normal and slope
        const normal = new THREE.Vector3();
        triangleMesh.triangle.getNormal(normal);
        const slope = Math.acos(normal.dot(new THREE.Vector3(0, 1, 0))) * (180 / Math.PI);

        triangleMesh.slope = slope;
        triangleMesh.normal = normal;
        triangleMesh.triangle.uvs = uvs;  // Store UVs for later use (e.g., for texture painting)

        return triangleMesh;
    }

    updateTerrain() {
        for (var center of this.surroundingCenters) {
            var centerKey = `${center.center.x}_${center.center.z}`;
            if (center.center.distanceTo(user.camera.position) < this.quadrant * 1.25) {
                center.pillar.material.color.set(0xff0000);
                var terrainCreated = false;
                for (var j = 0; j < this.meshes.length; j++) {
                    if (this.meshes[j].centerKey == centerKey) {
                        terrainCreated = true;
                    }
                }
                if (!terrainCreated) {
                    this.generate(center.center.x, center.center.y, center.center.z);
                }
            } else {
                center.pillar.material.color.set(0xffffff);
            }
        }
        
        this.updateVisibleTrianglesAndClusters(window.user.camera.position);
    
        // Update the terrain vertices
        this.v0 = { x: this.center.x - this.quadrant, y: this.center.y, z: this.center.z + this.quadrant };
        this.v1 = { x: this.center.x + this.quadrant, y: this.center.y, z: this.center.z + this.quadrant };
        this.v2 = { x: this.center.x + this.quadrant, y: this.center.y, z: this.center.z - this.quadrant };
        this.v3 = { x: this.center.x - this.quadrant, y: this.center.y, z: this.center.z - this.quadrant };
    }
    
    getRootSlices(centerKey, neighbors) {
        let q = this.quadrant * 2;
        const slices = [];
        const [currentX, currentZ] = centerKey.split("_").map(Number);
    
        neighbors.forEach(neighbor => {
            const neighborNoise = neighbor.noise; // Assuming noise is stored in a property
            const [neighborX, neighborZ] = neighbor.centerKey.split("_").map(Number);
            const width = q; 
            const height = q;
    
            if (neighborX === currentX && neighborZ === currentZ - q) { // Neighbor is above
                const slice = [];
                for (let col = 0; col < width; col++) {
                    slice.push(neighborNoise[col]); // Top row of neighbor
                }
                slices.push({ slice, direction: new THREE.Vector3(0, 0, 1) }); // Direction from neighbor to center
            } else if (neighborX === currentX && neighborZ === currentZ + q) { // Neighbor is below
                const slice = [];
                for (let col = 0; col < width; col++) {
                    slice.push(neighborNoise[(height - 1) * width + col]); // Bottom row of neighbor
                }
                slices.push({ slice, direction: new THREE.Vector3(0, 0, -1) }); // Direction from neighbor to center
            } else if (neighborX === currentX + q && neighborZ === currentZ) { // Neighbor is to the left
                const slice = [];
                for (let row = 0; row < height; row++) {
                    slice.push(neighborNoise[row * width]); // Left column of neighbor
                }
                slices.push({ slice, direction: new THREE.Vector3(1, 0, 0) }); // Direction from neighbor to center
            } else if (neighborX === currentX - q && neighborZ === currentZ) { // Neighbor is to the right
                const slice = [];
                for (let row = 0; row < height; row++) {
                    slice.push(neighborNoise[row * width + (width - 1)]); // Right column of neighbor
                }
                slices.push({ slice, direction: new THREE.Vector3(-1, 0, 0) }); // Direction from neighbor to center
            }
        });
    
        return slices;
    }
 
    renderNoiseSlice({ slice, direction }, width, height, center) {
        const segmentSize = 1; // Adjust based on your grid spacing
        const centerX = center.x;
        const centerZ = center.z;
    
        if (direction.equals(new THREE.Vector3(0, 0, -1))) { // Neighbor is below
            for (let col = 0; col < width; col++) {
                const noiseValue = slice[col];
                const x = (centerX * width + col - this.quadrant) * segmentSize;
                const y = noiseValue * this.altitudeVariance; // Assuming noiseValue represents height
                const z = centerZ + this.quadrant; // Top row
    
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.1, 32, 32),
                    new THREE.MeshBasicMaterial({ color: 0xff0000 })
                );
                console.log('neighbor below', x, y, z);
                sphere.position.set(x, y, z);
                scene.add(sphere);
            }
        } else if (direction.equals(new THREE.Vector3(0, 0, 1))) { // Neighbor is above
            for (let col = 0; col < width; col++) {
                const noiseValue = slice[col];
                const x = (centerX * width + col - this.quadrant) * segmentSize;
                const y = noiseValue * this.altitudeVariance; // Assuming noiseValue represents height
                const z = centerZ - this.quadrant; // Bottom row
    
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.1, 32, 32),
                    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
                );
    
                console.log('neighbor above', x, y, z);
                sphere.position.set(x, y, z);
                scene.add(sphere);
            }
        } else if (direction.equals(new THREE.Vector3(1, 0, 0))) { // Neighbor is to the left
            for (let row = 0; row < height; row++) {
                const noiseValue = slice[row];
                const x = (centerX + this.quadrant) * segmentSize;
                const y = noiseValue * this.altitudeVariance; // Assuming noiseValue represents height
                const z = (centerZ * height + row - this.quadrant) * segmentSize;
    
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.1, 32, 32),
                    new THREE.MeshBasicMaterial({ color: 0x0000ff })
                );
                console.log('neighbor left', x, y, z);
                sphere.position.set(x, y, z);
                scene.add(sphere);
            }
        } else if (direction.equals(new THREE.Vector3(-1, 0, 0))) { // Neighbor is to the right
            for (let row = 0; row < height; row++) {
                const noiseValue = slice[row];
                const x = (centerX - this.quadrant) * segmentSize;
                const y = noiseValue * this.altitudeVariance; // Assuming noiseValue represents height
                const z = (centerZ * height + row - this.quadrant) * segmentSize;
    
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.1, 32, 32),
                    new THREE.MeshBasicMaterial({ color: 0xffff00 })
                );
                console.log('neighbor right', x, y, z);
                sphere.position.set(x, y, z);
                scene.add(sphere);
            }
        }
    }
    
    determineGrassClusters() {
        const clusters = [];
        const visited = new Set();
    
        const shareEdge = (t1, t2) => {
            const t1Vertices = [t1.a, t1.b, t1.c];
            const t2Vertices = [t2.a, t2.b, t2.c];
            let sharedVertices = 0;
            for (let v of t1Vertices) {
                if (t2Vertices.some(v2 => v.distanceTo(v2) < 0.001)) {
                    sharedVertices++;
                }
            }
            return sharedVertices >= 2;
        };
    
        const findCluster = (startTriangle) => {
            const cluster = [];
            const queue = [startTriangle];
            
            while (queue.length > 0) {
                const currentTriangle = queue.shift();
                if (!visited.has(currentTriangle)) {
                    visited.add(currentTriangle);
                    cluster.push(currentTriangle);
    
                    for (const otherTriangle of this.grassTriangles) {
                        if (!visited.has(otherTriangle) && shareEdge(currentTriangle.triangle, otherTriangle.triangle)) {
                            queue.push(otherTriangle);
                        }
                    }
                }
            }
    
            return cluster;
        };
    
        const getPerimeterPoints = (cluster) => {
            const perimeterPoints = [];
            for (const triangle of cluster) {
                let neighborCount = 0;
                for (const otherTriangle of cluster) {
                    if (triangle !== otherTriangle && shareEdge(triangle.triangle, otherTriangle.triangle)) {
                        neighborCount++;
                    }
                }
                if (neighborCount < 3) {
                    perimeterPoints.push(triangle.triangle.a);
                    perimeterPoints.push(triangle.triangle.b);
                    perimeterPoints.push(triangle.triangle.c);
                }
            }
            return perimeterPoints;
        };
    
        for (const triangle of this.grassTriangles) {
            if (!visited.has(triangle)) {
                const newCluster = findCluster(triangle);
                if (newCluster.length > 0) {
                    const center = new THREE.Vector3(0, 0, 0);
                    let totalVertices = 0;
    
                    for (const t of newCluster) {
                        center.add(t.triangle.a);
                        center.add(t.triangle.b);
                        center.add(t.triangle.c);
                        totalVertices += 3;
                    }
    
                    if (totalVertices > 0) {
                        center.divideScalar(totalVertices);
                    }
    
                    const perimeterPoints = getPerimeterPoints(newCluster);
    
                    clusters.push({
                        center,
                        perimeterPoints
                    });
                }
            }
        }
    
        return clusters;
    }
  
    findClosestVertex(point, positionAttribute) {
        let closestIndex = -1;
        let closestDistance = Infinity;
    
        for (let i = 0; i < positionAttribute.count; i++) {
            const vertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
            const distance = point.distanceTo(vertex);
    
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
            }
        }
    
        return closestIndex;
    }

    findClosestVertex(position, vertices) {
        let closestIndex = -1;
        let closestDistance = Infinity;

        for (let i = 0; i < vertices.length / 3; i++) {
            const vertexPosition = new THREE.Vector3(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
            const distance = position.distanceTo(vertexPosition);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
            }
        }

        return closestIndex;
    }
    
    updateGroundMaterial() {
        // Implement this method to update the ground material based on the new groundColorMap values
        // This might involve updating a texture or shader parameter
    }

    setSun(sun) {
        this.sun = sun;
    }

    generateRollingPerlinNoise() {
        const map = VM.map[VM.user.level];
        let octaveCount = map.octaveCount || 4;
        let amplitude = map.amplitude || 0.003;  // Slightly higher amplitude for rolling hills
        let persistence = map.persistence || 0.15;  // Moderate persistence for rolling terrain
        let whiteNoise = this.generateWhiteNoise();

        let smoothNoiseList = new Array(octaveCount);
        for (let i = 0; i < octaveCount; ++i) {
            smoothNoiseList[i] = this.generateSmoothNoise(i, whiteNoise);
        }

        let perlinNoise = new Array(map.width * map.height);
        let totalAmplitude = 0;

        for (let i = octaveCount - 1; i >= 0; --i) {
            amplitude *= persistence;
            totalAmplitude += amplitude;

            for (let j = 0; j < perlinNoise.length; ++j) {
                perlinNoise[j] = perlinNoise[j] || 0;
                perlinNoise[j] += smoothNoiseList[i][j] * amplitude;
            }
        }

        for (let i = 0; i < perlinNoise.length; ++i) {
            perlinNoise[i] /= totalAmplitude;
        }

        return perlinNoise;
    }

    generatePerlinNoiseV1(options = {}) {
        const map = VM.map[VM.user.level];

        let octaveCount = options.octaveCount || 4;
        let amplitude = options.amplitude || 0.05;
        let persistence = options.persistence || 0.1;
        let width = map.width;
        let height = map.height;
        let offsetX = 0;
        let offsetY = 0;
        let whiteNoise = this.generateWhiteNoise(width, height, offsetX, offsetY);
        let smoothNoiseList = new Array(octaveCount);

        for (let i = 0; i < octaveCount; ++i) {
            smoothNoiseList[i] = this.generateSmoothNoise(i, whiteNoise, width, height);
        }
    
        let perlinNoise = new Array(width * height);
        let totalAmplitude = 0;
    
        for (let i = octaveCount - 1; i >= 0; --i) {
            amplitude *= persistence;
            totalAmplitude += amplitude;
    
            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x) {
                    let index = y * width + x;
                    perlinNoise[index] = perlinNoise[index] || 0;
                    perlinNoise[index] += smoothNoiseList[i][index] * amplitude;
                }
            }
        }
    
        for (let i = 0; i < perlinNoise.length; ++i) {
            perlinNoise[i] /= totalAmplitude;
        }
    
        return perlinNoise;
    }

    isNeighbor(centerKey1, centerKey2) {
        var q = this.quadrant * 2;
        const [x1, y1] = centerKey1.split("_").map(Number);
        const [x2, y2] = centerKey2.split("_").map(Number);
        return Math.abs(x1 - x2) <= q && Math.abs(y1 - y2) <= q;
    }

    generatePerlinNoise(options) {
        // Get the map for the user's level from the VM (some kind of virtual machine or game state)
        const map = VM.map[VM.user.level];

        // Define the number of octaves, which is basically how many layers of detail we'll add to the noise.
        // Each octave adds more fine detail to the noise, like going from big waves to little ripples.
        // If no value is passed in, it defaults to 4.
        let octaveCount = options.octaveCount || 5;

        // Define the initial amplitude. This controls how strong each layer (octave) of noise is.
        // The higher the amplitude, the more pronounced that layer will be.
        let amplitude = options.amplitude || 0.05;

        // Define persistence. This tells us how much the amplitude should decrease with each octave.
        // So each layer (octave) will have less and less influence as we add finer details.
        let persistence = options.persistence || 0.1;

        // Generate a "white noise" array. White noise is random, and it will be the base for all the smooth noise we generate later.
        // Think of it as the starting randomness, like rolling a dice for each pixel in the map.
        let whiteNoise = this.generateWhiteNoise();

        // Create an empty array to store the "smooth noise" layers.
        // We'll generate `octaveCount` smooth noise layers, which get finer and finer as the octaves go up.
        let smoothNoiseList = new Array(octaveCount);

        // Loop through each octave (from 0 to octaveCount-1) to generate and store smooth noise.
        for (let i = 0; i < octaveCount; ++i) {
            // Generate a smooth version of the white noise for this octave and store it.
            // Smooth noise is like white noise, but with gentler, less sharp changes between points.
            smoothNoiseList[i] = this.generateSmoothNoise(i, whiteNoise);
        }

        // Get the width and height of the map.
        // This is important because we need to generate noise that fits exactly into this map size.
        const width = map.width;
        const height = map.height;

        // Create an array to hold the final Perlin noise for the entire map.
        // We initialize it with zeros. We'll add noise from all octaves to this array.
        let perlinNoise = new Array(width * height).fill(0); // Initialize with zeros

        // This will track the total amplitude we've added across all octaves.
        // We'll use this later to normalize the noise so it's not too strong.
        let totalAmplitude = 0;

        // Now we loop through each octave in reverse order (from high to low detail).
        for (let i = octaveCount - 1; i >= 0; --i) {
            // Reduce the amplitude for this octave by multiplying by persistence.
            // This makes each finer octave contribute less to the final noise.
            amplitude *= persistence;

            // Add this octave's amplitude to the totalAmplitude, so we can normalize it later.
            totalAmplitude += amplitude;

            // Now we add this octave's smooth noise to the Perlin noise.
            // For every point in the map (represented by perlinNoise[j]), we add smooth noise from this octave.
            for (let j = 0; j < perlinNoise.length; ++j) {
                // Multiply the smooth noise value by the amplitude and add it to the Perlin noise array.
                // This makes higher octaves (bigger details) have more influence, and lower octaves (finer details) have less.
                perlinNoise[j] += smoothNoiseList[i][j] * amplitude;
            }
        }

        // After combining all the octaves, the noise values may be too large or small.
        // So, we normalize the Perlin noise by dividing by the totalAmplitude.
        // This ensures the noise stays within a reasonable range (like between 0 and 1).
        for (let j = 0; j < perlinNoise.length; ++j) {
            // Divide each point in the Perlin noise by the total amplitude, so that everything sums up nicely.
            // We also make sure we don't divide by zero, by falling back to 1 if totalAmplitude is 0 (which is unlikely).
            perlinNoise[j] /= totalAmplitude || 1; // Prevent division by zero
        }

        // Finally, we return the Perlin noise, which can be used to generate terrain, textures, or other visual patterns.
        return perlinNoise;

    }

    generateWhiteNoise() {
        const noise = new Array(VM.map[VM.user.level].width * VM.map[VM.user.level].height);
        for (let i = 0; i < noise.length; ++i) {
            noise[i] = Math.random();
        }
        return noise;
    }

    generateSmoothNoise(octave, whiteNoise) {
        const map = VM.map[VM.user.level];
        var noise = new Array(map.width * map.height);
        var samplePeriod = Math.pow(2, octave);
        var sampleFrequency = 1 / samplePeriod;
        var noiseIndex = 0;
        for (var y = 0; y < map.height; ++y) {
          var sampleY0 = Math.floor(y / samplePeriod) * samplePeriod;
          var sampleY1 = (sampleY0 + samplePeriod) % map.height;
          var vertBlend = (y - sampleY0) * sampleFrequency;
          for (var x = 0; x < map.width; ++x) {
            var sampleX0 = Math.floor(x / samplePeriod) * samplePeriod;
            var sampleX1 = (sampleX0 + samplePeriod) % map.width;
            var horizBlend = (x - sampleX0) * sampleFrequency;

            // blend top two corners
            var top = this.interpolate(whiteNoise[sampleY0 * map.width + sampleX0], whiteNoise[sampleY1 * map.width + sampleX0], vertBlend);
            // blend bottom two corners
            var bottom = this.interpolate(whiteNoise[sampleY0 * map.width + sampleX1], whiteNoise[sampleY1 * map.width + sampleX1], vertBlend);
            // final blend
            noise[noiseIndex] = this.interpolate(top, bottom, horizBlend);
            noiseIndex += 1;
          }
        }
        return noise;
    }

    lerp(a, b, t) {
        return a * (1 - t) + b * t;
    }

    generateCellularNoise() {
        const width = VM.map[VM.user.level].width;
        const height = VM.map[VM.user.level].height;
        const noise = new Array(width * height).fill(0);
        
        // Initialize with random cells
        for (let i = 0; i < noise.length; i++) {
            noise[i] = Math.random() < 0.45 ? 1 : 0;
        }
        
        // Apply cellular automaton rules
        const iterations = 4;
        for (let iter = 0; iter < iterations; iter++) {
            const newNoise = [...noise];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const neighbors = this.countNeighbors(noise, x, y, width, height);
                    const i = y * width + x;
                    if (noise[i] === 1) {
                        newNoise[i] = (neighbors < 2 || neighbors > 3) ? 0 : 1;
                    } else {
                        newNoise[i] = (neighbors === 3) ? 1 : 0;
                    }
                }
            }
            noise.splice(0, noise.length, ...newNoise);
        }
        
        // Normalize to [0, 1] range
        return noise.map(v => v * Math.random());
    }

    generateRandomWoodsTerrain() {
        const width = VM.map[VM.user.level].width;
        const height = VM.map[VM.user.level].height;
        const terrain = new Array(width * height).fill(0);
        
        // Step 1: Initialize with random seeds for groves
        const numSeeds = Math.floor(width * height * 0.005); // 0.5% of the area for fewer, larger groves
        for (let i = 0; i < numSeeds; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            terrain[y * width + x] = 1;
        }
        
        // Step 2: Grow groves using cellular automata
        const iterations = 6; // Increased iterations for larger groves
        for (let iter = 0; iter < iterations; iter++) {
            const newTerrain = [...terrain];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const neighbors = this.countNeighbors(terrain, x, y, width, height);
                    const i = y * width + x;
                    if (terrain[i] === 0 && neighbors >= 1 && Math.random() < 0.6) {
                        newTerrain[i] = 1;
                    }
                }
            }
            terrain.splice(0, terrain.length, ...newTerrain);
        }
        
        // Step 3: Create distance field for smooth transitions
        const distanceField = this.createDistanceField(terrain, width, height);
        
        // Step 4: Generate final terrain values with rolling hills
        const maxDistance = Math.max(...distanceField);
        return terrain.map((value, i) => {
            const normalizedDistance = distanceField[i] / maxDistance;
            
            // Use a sine function to create rolling hills
            const baseElevation = 0.3 + 0.4 * Math.sin(normalizedDistance * Math.PI);
            
            if (value === 1) {
                // Grove: Higher elevation with some variation
                return baseElevation + 0.2 + Math.random() * 0.1;
            } else {
                // Meadow: Lower elevation with gentle slopes
                return baseElevation + Math.random() * 0.05;
            }
        });
    }

    generateStructuredTerrain(centerX = 0, centerZ = 0, edges = null) {
        const width = VM.map[VM.user.level].width;
        const height = VM.map[VM.user.level].height;
        const terrain = new Array(width * height);
        
        // Step 1: Divide the terrain into regions
        const regions = this.divideIntoRegions(width, height);
        
        // Step 2: Assign base elevations to regions
        const baseElevations = {
            'high': 0.7,
            'medium': 0.5,
            'low': 0.3
        };
        
        // Step 3: Generate Perlin noise
        const noise = this.generatePerlinNoise(width, height);
        
        // Step 4: Combine regions with Perlin noise
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                const region = regions[y][x];
                const baseElevation = baseElevations[region];
                const noiseValue = noise[i];
                
                // Combine base elevation with noise
                terrain[i] = baseElevation + noiseValue * 0.2; // Adjust 0.2 to control noise influence
            }
        }
        
        return terrain;
    }
    
    divideIntoRegions(width, height) {
        const regions = Array(height).fill().map(() => Array(width).fill('medium'));
        
        // Simple division into three vertical strips
        const thirdWidth = Math.floor(width / 3);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (x < thirdWidth) {
                    regions[y][x] = 'low';
                } else if (x >= 2 * thirdWidth) {
                    regions[y][x] = 'high';
                }
            }
        }
        
        return regions;
    }
    
    generateValleyTerrain() {
        const width = VM.map[VM.user.level].width;
        const height = VM.map[VM.user.level].height;
        const terrain = new Array(width * height).fill(0);
        
        // Step 1: Initialize with random seeds for groves
        const numSeeds = Math.floor(width * height * 0.005); // 0.5% of the area for fewer, larger groves
        for (let i = 0; i < numSeeds; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            terrain[y * width + x] = 1;
        }
        
        // Step 2: Grow groves using cellular automata
        const iterations = 6;
        for (let iter = 0; iter < iterations; iter++) {
            const newTerrain = [...terrain];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const neighbors = this.countNeighbors(terrain, x, y, width, height);
                    const i = y * width + x;
                    if (terrain[i] === 0 && neighbors >= 1 && Math.random() < 0.6) {
                        newTerrain[i] = 1;
                    }
                }
            }
            terrain.splice(0, terrain.length, ...newTerrain);
        }
        
        // Step 3: Create distance field for smooth transitions
        const distanceField = this.createDistanceField(terrain, width, height);
        
        // Step 4: Generate final terrain values with rolling hills and valley incline
        const maxDistance = Math.max(...distanceField);
        return terrain.map((value, i) => {
            const x = i % width;
            const y = Math.floor(i / width);
            const normalizedDistance = distanceField[i] / maxDistance;
            
            // Create valley incline using sine waves
            const valleyIncline = Math.sin(x / width * Math.PI) * Math.sin(y / height * Math.PI);
            
            // Use a sine function to create rolling hills
            const baseElevation = 0.3 + 0.4 * Math.sin(normalizedDistance * Math.PI);
            
            // Combine rolling hills with valley incline
            const combinedElevation = baseElevation + 0.3 * valleyIncline;
            
            if (value === 1) {
                // Grove: Higher elevation with some variation
                return combinedElevation + 0.2 + Math.random() * 0.1;
            } else {
                // Meadow: Lower elevation with gentle slopes
                return combinedElevation + Math.random() * 0.05;
            }
        });
    }

    countNeighbors(grid, x, y, width, height) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = (x + dx + width) % width;
                const ny = (y + dy + height) % height;
                count += grid[ny * width + nx];
            }
        }
        return count;
    }
    
    createDistanceField(terrain, width, height) {
        const distanceField = new Array(width * height).fill(Infinity);
        const queue = [];
        
        // Initialize distance field
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                if (terrain[i] === 1) {
                    distanceField[i] = 0;
                    queue.push([x, y]);
                }
            }
        }
        
        // Flood fill to calculate distances
        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const currentDist = distanceField[y * width + x];
            
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = (x + dx + width) % width;
                    const ny = (y + dy + height) % height;
                    const ni = ny * width + nx;
                    const newDist = currentDist + Math.sqrt(dx*dx + dy*dy);
                    
                    if (newDist < distanceField[ni]) {
                        distanceField[ni] = newDist;
                        queue.push([nx, ny]);
                    }
                }
            }
        }
        
        return distanceField;
    }

    interpolate(x0, x1, alpha) {
        return x0 * (1 - alpha) + alpha * x1;
    }
    
    findClusters(triangles = []) {
        const clusters = [];
        const visited = new Array(triangles.length).fill(false);

        function shareEdge(triangle1, triangle2) {
            const edges1 = [
                [triangle1.a, triangle1.b],
                [triangle1.b, triangle1.c],
                [triangle1.c, triangle1.a]
            ];
            const edges2 = [
                [triangle2.a, triangle2.b],
                [triangle2.b, triangle2.c],
                [triangle2.c, triangle2.a]
            ];
            for (let edge1 of edges1) {
                for (let edge2 of edges2) {
                    if (
                        (edge1[0].equals(edge2[0]) && edge1[1].equals(edge2[1])) ||
                        (edge1[0].equals(edge2[1]) && edge1[1].equals(edge2[0]))
                    ) {
                        return true;
                    }
                }
            }
            return false;
        }

        function dfs(index, cluster) {
            visited[index] = true;
            cluster.push(triangles[index]);

            for (let i = 0; i < triangles.length; i++) {
                if (!visited[i] && shareEdge(triangles[index], triangles[i])) {
                    dfs(i, cluster);
                }
            }
        }

        for (let i = 0; i < triangles.length; i++) {
            if (!visited[i]) {
                const cluster = [];
                dfs(i, cluster);
                clusters.push(cluster);
            }
        }

        return clusters;
    }

    createBufferGeometryFromCluster(cluster) {
        const vertices = [];
        const indices = [];
        const uvs = [];

        cluster.forEach((triangle, index) => {
            const startIndex = vertices.length / 3;
            vertices.push(
                triangle.a.x, triangle.a.y, triangle.a.z,
                triangle.b.x, triangle.b.y, triangle.b.z,
                triangle.c.x, triangle.c.y, triangle.c.z
            );
            uvs.push(
                0, 0,
                1, 0,
                1, 1
            );
            indices.push(startIndex, startIndex + 1, startIndex + 2);
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }

    clusterCliffs() {
        var meshes = []
        const cliffClusters = this.findClusters(this.cliffs);
        cliffClusters.forEach(cluster => {
            const geometry = this.createBufferGeometryFromCluster(cluster);
            const material = new THREE.MeshBasicMaterial({ 
                // map: rockTexture,
                color: 'white',
                side: THREE.DoubleSide,
                wireframe: false
            });
                
            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            // moveMeshAlongNormal(mesh, -0.05);
            meshes.push(mesh);
        });
        return meshes;
    }

    clusterGrounds() {
        var meshes = [];
        const groundClusters = this.findClusters(this.ground);
        groundClusters.forEach(cluster => {
            const geometry = createBufferGeometryFromCluster(cluster);
                const material = new THREE.MeshStandardMaterial({
                color: 'lawngreen',
                    side: THREE.DoubleSide
                });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            // moveMeshAlongNormal(mesh, -0.05);
            meshes.push(mesh);
        });
        return meshes;
    }

    getBarycentricCoordinates(p, triangle) {
        const v0 = new THREE.Vector3().subVectors(triangle.b, triangle.a);
        const v1 = new THREE.Vector3().subVectors(triangle.c, triangle.a);
        const v2 = new THREE.Vector3().subVectors(p, triangle.a);

        const d00 = v0.dot(v0);
        const d01 = v0.dot(v1);
        const d11 = v1.dot(v1);
        const d20 = v2.dot(v0);
        const d21 = v2.dot(v1);

        const denom = d00 * d11 - d01 * d01;
        const v = (d11 * d20 - d01 * d21) / denom;
        const w = (d00 * d21 - d01 * d20) / denom;
        const u = 1.0 - v - w;

        return [u, v, w];  // Return the barycentric weights for the three vertices
    }  

    findNearestTerrainCenters(position) {
        const roundedX = Math.round(position.x / this.quadrant) * this.quadrant;
        const roundedZ = Math.round(position.z / this.quadrant) * this.quadrant;
        
        // Calculate distances to the 4 nearest centers
        const centers = [
            {x: roundedX, y: 0, z: roundedZ},                           // Center
            {x: roundedX - this.quadrant * 2, y: 0, z: roundedZ},       // Left
            {x: roundedX + this.quadrant * 2, y: 0, z: roundedZ},       // Right
            {x: roundedX, y: 0, z: roundedZ - this.quadrant * 2},       // Top
            {x: roundedX, y: 0, z: roundedZ + this.quadrant * 2},       // Bottom
            {x: roundedX - this.quadrant * 2, y: 0, z: roundedZ - this.quadrant * 2}, // Top-Left
            {x: roundedX + this.quadrant * 2, y: 0, z: roundedZ - this.quadrant * 2}, // Top-Right
            {x: roundedX - this.quadrant * 2, y: 0, z: roundedZ + this.quadrant * 2}, // Bottom-Left
            {x: roundedX + this.quadrant * 2, y: 0, z: roundedZ + this.quadrant * 2}  // Bottom-Right
        ];

        for (var i = 0; i < centers.length; i++) {
            var pillarGeometry = new THREE.CylinderGeometry(1, 1, 32, 32);
            var pillarMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            var pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(centers[i].x, centers[i].y, centers[i].z);
            centers[i] = { 
                center: new THREE.Vector3(centers[i].x, centers[i].y, centers[i].z), 
                pillar 
            }
            scene.add(pillar);
           
        }

        this.surroundingCenters = centers;
        
        return centers;
    }
    
    getDirectionFromCurrent(current, target) {
        if (target.x > current.x) return 'right';
        if (target.x < current.x) return 'left';
        if (target.z > current.z) return 'top';
        if (target.z < current.z) return 'bottom';
        return 'none'; // Should never happen if current !== target
    }

    updateVisibleTrianglesAndClusters(sopCenter) {
        // Helper function to determine if a point is within the SOP
        function isInSOP(point, sopCenter, sopRadius) {
            const dx = point.x - sopCenter.x;
            const dy = point.y - sopCenter.y;
            const dz = point.z - sopCenter.z;
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            return distanceSquared <= sopRadius * sopRadius;
        }


        // Add triangles within the SOP to the scene
        this.grounds.forEach((mesh) => {
            var a = mesh.triangle.a;  // Vertex A of the triangle
            var b = mesh.triangle.b;  // Vertex B of the triangle
            var c = mesh.triangle.b;  // Vertex C of the triangle

            // Calculate the center of the triangle (average of the three vertices)
            var triangleCenter = new THREE.Vector3(
                (a.x + b.x + c.x) / 3,
                (a.y + b.y + c.y) / 3,
                (a.z + b.z + c.z) / 3
            );

            if (!mesh.parent && isInSOP(triangleCenter, sopCenter, VM.map[VM.user.level].sop.grasses)) {
                scene.add(mesh);
            } else if (mesh.parent && !isInSOP(triangleCenter, sopCenter, VM.map[VM.user.level].sop.grasses)) {
                scene.remove(mesh);
            }
        });

        // Repeat for cliffs and grounds clusters if needed
        this.cliffMeshes.forEach((mesh) => {
            const meshCenter = this.getTriangleCenter(mesh.triangle);
            if ((meshCenter.x < sopCenter.x - sopRadius || meshCenter.x > sopCenter.x + sopRadius ||
                meshCenter.z < sopCenter.z - sopRadius || meshCenter.z > sopCenter.z + sopRadius)) {
                scene.remove(mesh);
            } else {
                scene.add(mesh);
            }
        });

        // Remove triangles outside the SOP from the scene
        VM.map[VM.user.level].trees.forEach((tree) => {
            if (tree.foliage.parent && !isInSOP(tree.foliage.position, sopCenter, VM.map[VM.user.level].sop.trees)) {
                scene.remove(tree.trunk);
                scene.remove(tree.foliage);
            } else if (!tree.foliage.parent && isInSOP(tree.foliage.position, sopCenter, VM.map[VM.user.level].sop.trees)) {
                scene.add(tree.trunk);
                scene.add(tree.foliage);
            }
        });

        // Remove triangles outside the SOP from the scene
        VM.map[VM.user.level].grasses.forEach((grass) => {
            var mesh = grass.mesh
            var pos = getInstancePosition(mesh, 0);

            if (mesh.parent && !isInSOP(pos, sopCenter, VM.map[VM.user.level].sop.grasses)) {
                scene.remove(mesh);
            } else if (!mesh.parent && isInSOP(pos, sopCenter, VM.map[VM.user.level].sop.grasses)) {
                scene.add(mesh);
            }
        });

    }

    getTriangleCenter(triangle) {
        const centerX = (triangle.a.x + triangle.b.x + triangle.c.x) / 3;
        const centerY = (triangle.a.y + triangle.b.y + triangle.c.y) / 3;
        const centerZ = (triangle.a.z + triangle.b.z + triangle.c.z) / 3;
        return { x: centerX, y: centerY, z: centerZ };
    }

    createTree(x, y, z, alternate) {
        const textureIndex = Math.floor(Math.random() * 7);

        var trunkHeight = randomInRange(3, 25)
        var trunkBaseRadius = randomInRange(.1, .8)
        var rr = alternate ? randomInRange(.01, .1) : randomInRange(.1, .5)
        var trunkCurve = []
        var trunkRadius = []
        var zS = z
        var xS = x
        var yS = y;

        for (; yS < y + trunkHeight; yS += 0.02) {
            if (Math.random() < 0.13) {
                zS += randomInRange(-rr, rr)
            }
            if (Math.random() < 0.13) {
                xS += randomInRange(-rr, rr)
            }
            var r = trunkBaseRadius
            trunkRadius.push(r)
            trunkCurve.push(
                new THREE.Vector3(
                    xS,
                    yS, 
                    zS
                )
            )
        }

        // Default foliage (spherical)
        var foliageRadius = randomInRange(trunkHeight * .3, 2.85)
        const sphereGeometry = new THREE.SphereGeometry(foliageRadius, 10, 10);
        const greenValue = Math.floor(Math.random() * 256);
        const color = new THREE.Color(Math.random() < 0.05 ? randomInRange(0, 0.5) : 0, greenValue / 255, 0);
        const foliageIndex = textureIndex > 4 ? textureIndex - 3 : textureIndex;
        const foliageTexture = this.textures.foliage[Math.floor(Math.random() * 7)];

        // Set how many times the texture should repeat in the U and V directions
        foliageTexture.wrapS = THREE.RepeatWrapping; // Repeat horizontally
        foliageTexture.wrapT = THREE.RepeatWrapping; // Repeat vertically

        // Adjust these values to control the repetition frequency
        foliageTexture.repeat.set(10, 10); // Increase these numbers for more repetitions and smaller texture

        let sphereMaterial = new THREE.MeshStandardMaterial({
            color,
            map: foliageTexture,
            transparent: true
        });

        
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.castShadow = true
        sphere.receiveShadow = true
        sphere.position.set(xS, yS + (foliageRadius / 2), zS); // Set foliage position
        scene.add(sphere);

        var { array, itemSize } = sphereGeometry.attributes.position
        for (let i = 0; i < 21; i++) {
            for (var j = 0; j < 21; j++) {
                var vertexIndex = (i * (21 + 1) + j) * itemSize
                var x = array[vertexIndex]
                var z = array[vertexIndex + 1]
                var y = array[vertexIndex + 2]

                array[vertexIndex] = randomInRange(x - (foliageRadius * 1.1), x + foliageRadius * 1.1)
                array[vertexIndex + 1] = randomInRange(y - (foliageRadius * 1.1), y + foliageRadius * 1.1)
                array[vertexIndex + 2] = randomInRange(z - (foliageRadius * 1.1), z + foliageRadius * 1.1)
            }
        }


        const path = new THREE.CatmullRomCurve3(trunkCurve);

        var segments = Math.floor(randomInRange(5, 11))
        var radialSegments = 15

        // Create the tube geometry
        const tubeGeometry = new THREE.TubeGeometry(path, segments, trunkBaseRadius);

        const material = new THREE.MeshStandardMaterial({ 
            map: this.textures.barks[textureIndex],
            // color: 'red',
            side: THREE.DoubleSide
        });

        // Create the mesh
        const tubeMesh = new THREE.Mesh(tubeGeometry, material);
        tubeMesh.castShadow = true
        tubeMesh.receiveShadow = true
        tubeMesh.position.y -= 2

        // Add the mesh to the scene
        scene.add(tubeMesh);

        return new Tree(tubeMesh, sphere);
    }

    createGrassBlade(instancedMesh, triangle, bladePositions, i) {

        const dummy = new THREE.Object3D();
        const u = Math.random();
        const v = Math.random() * (1 - u);
        const posX = (1 - u - v) * triangle.a.x + u * triangle.b.x + v * triangle.c.x;
        const posY = (1 - u - v) * triangle.a.y + u * triangle.b.y + v * triangle.c.y;
        const posZ = (1 - u - v) * triangle.a.z + u * triangle.b.z + v * triangle.c.z;
        bladePositions.push(new THREE.Vector3(posX, posY, posZ));
        
        dummy.position.set(posX, posY, posZ);
        dummy.rotation.y = randomInRange(0, Math.PI * 2);
        dummy.rotation.x += randomInRange(2, Math.PI)
        dummy.scale.set(randomInRange(0.8, 1.2), randomInRange(0.8, 2.2),randomInRange(0.8, 1.2))
        dummy.updateMatrix();

        instancedMesh.setMatrixAt(i, dummy.matrix);

        return [instancedMesh, bladePositions];
    }

    createGrassResult(indices, vertices, triangleMesh, bladeCount = 11, bladeHeight = 1, bladeWidth = 0.1) {
        var triangle = triangleMesh.triangle
        
        const bladeGeometry = new THREE.PlaneGeometry(bladeWidth, bladeHeight, 1, 4);
        bladeGeometry.computeVertexNormals();
        
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color("lawngreen"),
            side: THREE.DoubleSide,
            roughness: 0.8,  // Makes the surface more diffuse
            metalness: 0.0,  // Non-metallic surface
        });
        

        let instancedMesh = new THREE.InstancedMesh(bladeGeometry, material, bladeCount);
        let bladePositions = [];

        for (let i = 0; i < bladeCount; i++) {
            [instancedMesh, bladePositions] = this.createGrassBlade(instancedMesh, triangle, bladePositions, i);
        }

        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;

        return new GrassPatch({
            mesh: instancedMesh,
            triangleMesh,
            bladePositions: bladePositions 
        });
    }

    createGrassPatch(indices, vertices, mesh) {
        const grassResult = this.createGrassResult(
            indices, 
            vertices,
            mesh,
            VM.map[VM.user.level].grassBladeDensity,
            randomInRange(0.05, 0.2),
            randomInRange(0.1, 0.5)
        );

        // Mark grass on groundColorMap to match patches
        grassResult.bladePositions.forEach((bladePosition) => {
            const closestVertexIndex = this.findClosestVertex(bladePosition, vertices);
            if (closestVertexIndex >= 0 && closestVertexIndex < vertices.length / 3) {
                const x = Math.floor(closestVertexIndex / (this.segments + 1));
                const y = closestVertexIndex % (this.segments + 1);
                this.groundColorMap[x][y] += .1;  // Increment the grass density at the closest vertex
            }
        });

        return grassResult;
    }

    setCamera(camera) {
        this.camera = camera;
    }
}