
function GenerateRandomFrankGehryEdifice(centroid, baseSize, maxHeight, levels) {
	const geometry = new THREE.BufferGeometry();
	const vertices = [];
	const indices = [];

	for (let i = 0; i < levels; i++) {
	    const height = centroid.y + (i * (maxHeight / levels));
	    const xOffset = Math.random() * baseSize - (baseSize / 2);
	    const zOffset = Math.random() * baseSize - (baseSize / 2);

	    vertices.push(
	        centroid.x + xOffset - baseSize, height, centroid.z + zOffset - baseSize,
	        centroid.x + xOffset + baseSize, height, centroid.z + zOffset - baseSize,
	        centroid.x + xOffset + baseSize, height, centroid.z + zOffset + baseSize,
	        centroid.x + xOffset - baseSize, height, centroid.z + zOffset + baseSize,
	        centroid.x + xOffset - baseSize, height + (maxHeight / levels), centroid.z + zOffset - baseSize,
	        centroid.x + xOffset + baseSize, height + (maxHeight / levels), centroid.z + zOffset - baseSize,
	        centroid.x + xOffset + baseSize, height + (maxHeight / levels), centroid.z + zOffset + baseSize,
	        centroid.x + xOffset - baseSize, height + (maxHeight / levels), centroid.z + zOffset + baseSize
	    );

	    const offset = i * 8;
	    indices.push(
	        offset, offset + 1, offset + 5,
	        offset, offset + 5, offset + 4,
	        offset + 1, offset + 2, offset + 6,
	        offset + 1, offset + 6, offset + 5,
	        offset + 2, offset + 3, offset + 7,
	        offset + 2, offset + 7, offset + 6,
	        offset + 3, offset, offset + 4,
	        offset + 3, offset + 4, offset + 7,
	        offset + 4, offset + 5, offset + 6,
	        offset + 4, offset + 6, offset + 7
	    );
	}

	geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
	geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
	geometry.computeVertexNormals();

	const material = new THREE.MeshStandardMaterial({ color: 0x6A5ACD, 
	  transparent: true,
	  opacity: 0.5,
	  side: THREE.DoubleSide 
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

function GenerateRandomIMPeiEdifice(centroid, baseSize, height, levels) {
    // Validate parameters
    if (!centroid || typeof baseSize !== 'number' || typeof height !== 'number' || typeof levels !== 'number' || levels <= 0) {
        throw new Error('Invalid parameters');
    }

    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const segmentHeight = height / levels;

    for (let i = 0; i < levels; i++) {
        const levelHeight = centroid.y + i * segmentHeight;
        const currentSize = baseSize * (1 - i / levels);

        // Define vertices for the current level
        vertices.push(
            centroid.x - currentSize, levelHeight, centroid.z - currentSize,
            centroid.x + currentSize, levelHeight, centroid.z - currentSize,
            centroid.x + currentSize, levelHeight, centroid.z + currentSize,
            centroid.x - currentSize, levelHeight, centroid.z + currentSize,
            centroid.x, levelHeight + segmentHeight, centroid.z
        );

        // Define indices for the current level
        const offset = i * 5;
        indices.push(
            offset, offset + 1, offset + 4,
            offset + 1, offset + 2, offset + 4,
            offset + 2, offset + 3, offset + 4,
            offset + 3, offset, offset + 4,
            offset, offset + 1, offset + 2,
            offset, offset + 2, offset + 3
        );
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: 0x00BFFF,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(centroid.x, centroid.y, centroid.z);

    return mesh;
}

function GenerateRandomLeCorbusierEdifice(centroid, baseSize, ceilingHeight, levels, withPilotis) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const levelHeight = ceilingHeight;

    // Generate vertices for levels
    for (let i = 0; i < levels; i++) {
        const height = i * levelHeight;
        vertices.push(
            centroid.x - baseSize, centroid.y + height, centroid.z - baseSize, // Bottom left
            centroid.x + baseSize, centroid.y + height, centroid.z - baseSize, // Bottom right
            centroid.x + baseSize, centroid.y + height, centroid.z + baseSize, // Top right
            centroid.x - baseSize, centroid.y + height, centroid.z + baseSize, // Top left
            centroid.x - baseSize, centroid.y + height + ceilingHeight, centroid.z - baseSize, // Upper Bottom left
            centroid.x + baseSize, centroid.y + height + ceilingHeight, centroid.z - baseSize, // Upper Bottom right
            centroid.x + baseSize, centroid.y + height + ceilingHeight, centroid.z + baseSize, // Upper Top right
            centroid.x - baseSize, centroid.y + height + ceilingHeight, centroid.z + baseSize  // Upper Top left
        );
    }

    // Generate indices for faces
    for (let i = 0; i < levels; i++) {
        const offset = i * 8;
        indices.push(
            offset, offset + 1, offset + 5,
            offset, offset + 5, offset + 4,
            offset + 1, offset + 2, offset + 6,
            offset + 1, offset + 6, offset + 5,
            offset + 2, offset + 3, offset + 7,
            offset + 2, offset + 7, offset + 6,
            offset + 3, offset, offset + 4,
            offset + 3, offset + 4, offset + 7,
            offset + 4, offset + 5, offset + 6,
            offset + 4, offset + 6, offset + 7
        );
    }

    // Add vertices and indices for pilotis if applicable
    if (withPilotis) {
        const pilotisHeight = ceilingHeight / 2;
        for (let i = 0; i < 4; i++) {
            const x = (i % 2 === 0 ? -baseSize + 1 : baseSize - 1);
            const z = (i < 2 ? -baseSize + 1 : baseSize - 1);
            vertices.push(
                centroid.x + x, centroid.y, centroid.z + z,
                centroid.x + x, centroid.y + pilotisHeight, centroid.z + z
            );
        }

        const pilotisOffset = levels * 8;
        for (let i = 0; i < 4; i++) {
            indices.push(
                pilotisOffset + i * 2, pilotisOffset + i * 2 + 1, pilotisOffset + ((i + 1) % 4) * 2 + 1,
                pilotisOffset + i * 2, pilotisOffset + ((i + 1) % 4) * 2 + 1, pilotisOffset + ((i + 1) % 4) * 2
            );
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ color: 0x8b8b8b, 
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide 
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function GenerateRandomZahaHadidEdifice(centroid, baseSize, maxHeight, numberOfWaves) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const waveHeight = maxHeight / numberOfWaves;
    const segments = 32;

    for (let i = 0; i <= numberOfWaves; i++) {
        const height = i * waveHeight;
        const radius = baseSize * (1 + 0.5 * Math.sin(i * Math.PI / numberOfWaves));

        for (let j = 0; j < segments; j++) {
            const theta = (j / segments) * Math.PI * 2;
            const x = radius * Math.cos(theta);
            const z = radius * Math.sin(theta);
            vertices.push(centroid.x + x, centroid.y + height, centroid.z + z);
        }
    }

    for (let i = 0; i < numberOfWaves; i++) {
        for (let j = 0; j < segments; j++) {
            const first = i * segments + j;
            const second = (i + 1) * segments + j;
            const third = (i + 1) * segments + (j + 1) % segments;
            const fourth = i * segments + (j + 1) % segments;

            indices.push(first, second, third);
            indices.push(first, third, fourth);
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ color: 0x1E90FF, 
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide 
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function GenerateRandomLouisKahnEdifice(centroid, width, depth, height, levels) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const levelHeight = height / levels;
    var baseHeight = height

    for (let i = 0; i < levels; i++) {
        const baseHeight = centroid.y + i * levelHeight;
        const offset = (i % 2 === 0) ? 0 : width / 4;

        vertices.push(
            centroid.x - width / 2 + offset, baseHeight, centroid.z - depth / 2,
            centroid.x + width / 2 - offset, baseHeight, centroid.z - depth / 2,
            centroid.x + width / 2 - offset, baseHeight, centroid.z + depth / 2,
            centroid.x - width / 2 + offset, baseHeight, centroid.z + depth / 2,
            centroid.x - width / 2 + offset, baseHeight + levelHeight, centroid.z - depth / 2,
            centroid.x + width / 2 - offset, baseHeight + levelHeight, centroid.z - depth / 2,
            centroid.x + width / 2 - offset, baseHeight + levelHeight, centroid.z + depth / 2,
            centroid.x - width / 2 + offset, baseHeight + levelHeight, centroid.z + depth / 2
        );

        const vertOffset = i * 8;
        indices.push(
            vertOffset, vertOffset + 1, vertOffset + 5,
            vertOffset, vertOffset + 5, vertOffset + 4,
            vertOffset + 1, vertOffset + 2, vertOffset + 6,
            vertOffset + 1, vertOffset + 6, vertOffset + 5,
            vertOffset + 2, vertOffset + 3, vertOffset + 7,
            vertOffset + 2, vertOffset + 7, vertOffset + 6,
            vertOffset + 3, vertOffset, vertOffset + 4,
            vertOffset + 3, vertOffset + 4, vertOffset + 7,
            vertOffset + 4, vertOffset + 5, vertOffset + 6,
            vertOffset + 4, vertOffset + 6, vertOffset + 7
        );
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ color: 0xA9A9A9, 
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide 
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(centroid.x, centroid.y, centroid.z)
    return mesh;
}

function GenerateFantasticalRenzoPianoEdifice(centroid, baseWidth, baseDepth, height, levels) {
    const group = new THREE.Group();
    const levelHeight = height / levels;

    for (let i = 0; i < levels; i++) {
        const currentHeight = centroid.y + i * levelHeight;
        const currentWidth = baseWidth * (1 - i / levels);
        const currentDepth = baseDepth * (1 - i / levels);

        const geometry = new THREE.BoxGeometry(currentWidth, levelHeight, currentDepth);

        const material = new THREE.MeshStandardMaterial({
            color: 0x00BFFF,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(centroid.x, currentHeight + levelHeight / 2, centroid.z);

        // Apply some random offset for a fantastical look
        const offsetX = (Math.random() - 0.5) * baseWidth * 0.2;
        const offsetZ = (Math.random() - 0.5) * baseDepth * 0.2;
        mesh.position.x += offsetX;
        mesh.position.z += offsetZ;

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        group.add(mesh);
    }

    group.position.set(centroid.x, centroid.y, centroid.z);
    return group;
}

function GenerateRandomNormanFosterEdifice(centroid, width, depth, height, levels) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const levelHeight = height / levels;

    for (let i = 0; i < levels; i++) {
        const baseHeight = centroid.y + i * levelHeight;
        const taper = (1 - i / levels) * 0.5;

        vertices.push(
            centroid.x - width * taper / 2, baseHeight, centroid.z - depth * taper / 2,
            centroid.x + width * taper / 2, baseHeight, centroid.z - depth * taper / 2,
            centroid.x + width * taper / 2, baseHeight, centroid.z + depth * taper / 2,
            centroid.x - width * taper / 2, baseHeight, centroid.z + depth * taper / 2,
            centroid.x - width * taper / 2, baseHeight + levelHeight, centroid.z - depth * taper / 2,
            centroid.x + width * taper / 2, baseHeight + levelHeight, centroid.z - depth * taper / 2,
            centroid.x + width * taper / 2, baseHeight + levelHeight, centroid.z + depth * taper / 2,
            centroid.x - width * taper / 2, baseHeight + levelHeight, centroid.z + depth * taper / 2
        );

        const offset = i * 8;
        indices.push(
            offset, offset + 1, offset + 5,
            offset, offset + 5, offset + 4,
            offset + 1, offset + 2, offset + 6,
            offset + 1, offset + 6, offset + 5,
            offset + 2, offset + 3, offset + 7,
            offset + 2, offset + 7, offset + 6,
            offset + 3, offset, offset + 4,
            offset + 3, offset + 4, offset + 7,
            offset + 4, offset + 5, offset + 6,
            offset + 4, offset + 6, offset + 7
        );
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    geometry.computeVertexNormals();

    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, 
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide 
    });
    const frameMesh = new THREE.Mesh(geometry, frameMaterial);
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = true;
    // Create glass panels
    const glassGeometry = new THREE.BoxGeometry(width, height, depth);
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x87CEEB, transparent: true, opacity: 0.5 });
    const glassMesh = new THREE.Mesh(glassGeometry, glassMaterial);
    glassMesh.position.set(centroid.x, centroid.y + height / 2, centroid.z);

    const group = new THREE.Group();
    group.add(frameMesh);
    group.add(glassMesh);

    group.position.set(centroid.x, centroid.y, centroid.z);

    return group;
}

function GenerateRandomEeroSaarinenEdifice(centroid, width, depth, height, curvature) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const segments = 32;

    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = centroid.x + width * Math.cos(theta) * (1 + curvature * Math.sin(theta));
        const z = centroid.z + depth * Math.sin(theta) * (1 + curvature * Math.cos(theta));
        vertices.push(x, centroid.y, z);
        vertices.push(x, centroid.y + height, z);
    }

    for (let i = 0; i < segments; i++) {
        const first = i * 2;
        const second = first + 1;
        const third = first + 2;
        const fourth = third + 1;

        indices.push(first, third, second);
        indices.push(second, third, fourth);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, 
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide 
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(centroid.x, centroid.y, centroid.z)
    return mesh;
}

function GenerateRandomAntoniGaudiEdifice(centroid, height, baseRadius, levels) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const segments = 32;
    const levelHeight = height / levels;

    for (let i = 0; i <= levels; i++) {
        const currentRadius = baseRadius * (1 - i / levels);
        const y = centroid.y + i * levelHeight;

        for (let j = 0; j <= segments; j++) {
            const theta = (j / segments) * Math.PI * 2;
            const twist = (i % 2 === 0) ? Math.sin(theta + (i * 0.5)) : Math.cos(theta + (i * 0.5));
            const x = centroid.x + currentRadius * Math.cos(theta) * (1 + 0.1 * twist);
            const z = centroid.z + currentRadius * Math.sin(theta) * (1 + 0.1 * twist);
            vertices.push(x, y, z);
        }
    }

    for (let i = 0; i < levels; i++) {
        for (let j = 0; j < segments; j++) {
            const first = i * (segments + 1) + j;
            const second = first + segments + 1;
            const third = first + 1;
            const fourth = second + 1;

            indices.push(first, second, third);
            indices.push(second, fourth, third);
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ color: 0xFF4500, 
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide 
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(centroid.x, centroid.y, centroid.z)
    return mesh;
}

function GenerateRandomMiesVanDerRoheEdifice(centroid, ceilingHeight, levels) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const levelHeight = ceilingHeight;
    const baseSize = 10;
    const gridSegments = 4;

    // Generate vertices for levels
    for (let i = 0; i < levels; i++) {
        const height = i * levelHeight;

        for (let j = 0; j <= gridSegments; j++) {
            for (let k = 0; k <= gridSegments; k++) {
                const x = centroid.x - baseSize + (2 * baseSize / gridSegments) * j;
                const z = centroid.z - baseSize + (2 * baseSize / gridSegments) * k;
                vertices.push(x, centroid.y + height, z);
                vertices.push(x, centroid.y + height + ceilingHeight, z);
            }
        }
    }

    // Generate indices for faces
    for (let i = 0; i < levels; i++) {
        const offset = i * (gridSegments + 1) * (gridSegments + 1) * 2;

        for (let j = 0; j < gridSegments; j++) {
            for (let k = 0; k < gridSegments; k++) {
                const first = offset + (j * (gridSegments + 1) + k) * 2;
                const second = first + 2;
                const third = first + (gridSegments + 1) * 2;
                const fourth = third + 2;

                indices.push(first, second, fourth);
                indices.push(first, fourth, third);

                indices.push(first + 1, second + 1, fourth + 1);
                indices.push(first + 1, fourth + 1, third + 1);
            }
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ color: 0x333333, 
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide 
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(centroid.x, centroid.y, centroid.z)

    return mesh;
}

function GenerateRandomTadaoAndoEdifice(centroid, length, width, height, levels) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const levelHeight = height / levels;

    for (let i = 0; i < levels; i++) {
        const baseHeight = centroid.y + i * levelHeight;
        vertices.push(
            centroid.x - length / 2, baseHeight, centroid.z - width / 2,
            centroid.x + length / 2, baseHeight, centroid.z - width / 2,
            centroid.x + length / 2, baseHeight, centroid.z + width / 2,
            centroid.x - length / 2, baseHeight, centroid.z + width / 2,
            centroid.x - length / 2, baseHeight + levelHeight, centroid.z - width / 2,
            centroid.x + length / 2, baseHeight + levelHeight, centroid.z - width / 2,
            centroid.x + length / 2, baseHeight + levelHeight, centroid.z + width / 2,
            centroid.x - length / 2, baseHeight + levelHeight, centroid.z + width / 2
        );

        const offset = i * 8;
        indices.push(
            offset, offset + 1, offset + 5,
            offset, offset + 5, offset + 4,
            offset + 1, offset + 2, offset + 6,
            offset + 1, offset + 6, offset + 5,
            offset + 2, offset + 3, offset + 7,
            offset + 2, offset + 7, offset + 6,
            offset + 3, offset, offset + 4,
            offset + 3, offset + 4, offset + 7,
            offset + 4, offset + 5, offset + 6,
            offset + 4, offset + 6, offset + 7
        );
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ color: 0x696969, 
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide 
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(centroid.x, centroid.y, centroid.z)
    return mesh;
}


var building = GenerateRandomFrankGehryEdifice(
	{ x:20, y:0, z:20 },
	5,
	50,
	4
)
scene.add(building);
var building2 = GenerateRandomIMPeiEdifice(
	{ x:-20, y:0, z:-20 },
	10,
	110,
	10
)
scene.add(building2);
var building3 = GenerateRandomLeCorbusierEdifice(
	{ x:-20, y:0, z:20 },
	6,
	10,
	10,
	10
)
scene.add(building3);

var building4 = GenerateRandomZahaHadidEdifice({ x:20, y:0, z:-20 },
	5, 30, 12)
scene.add(building4)


var LouisKahnEdifice = GenerateRandomLouisKahnEdifice({ x:5, y:0, z:-20 }, 10, 20, 20, 5);
scene.add(LouisKahnEdifice)

var RenzoPianoEdifice = GenerateFantasticalRenzoPianoEdifice({ x:-5, y:0, z:-2 }, 10, 11, 3, 3);
scene.add(RenzoPianoEdifice)


var NormanFosterEdifice = GenerateRandomNormanFosterEdifice({ x:11, y:0, z:2 }, 10, 11, 13, 13);
scene.add(NormanFosterEdifice)

var EeroSaarinenEdiface = GenerateRandomEeroSaarinenEdifice({ x:3, y:0, z:0 }, 2, 2, 10, Math.random() * Math.PI * 2)
scene.add(EeroSaarinenEdiface)


var AntoniGaudiEdifice = GenerateRandomAntoniGaudiEdifice({ x:-25, y:0, z:1 }, 95, 5, 11)
scene.add(AntoniGaudiEdifice)


var TadaoAndoEdifice = GenerateRandomTadaoAndoEdifice({ x:-1, y:0, z:-11 }, 15, 10, 50, 11)
scene.add(TadaoAndoEdifice)


var MiesVanDerRoheEdifice = GenerateRandomMiesVanDerRoheEdifice({ x:1, y:0, z:11 }, 5,  20)
scene.add(MiesVanDerRoheEdifice)
