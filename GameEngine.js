import * as THREE from '/three';
import * as PERLIN from '/perlin-noise';

window.THREE = THREE;

window.w = false;
window.a = false;
window.s = false;
window.d = false;
window.wS = .03;
window.aS = .03;
window.sS = .01;
window.dS = .03;
window.tS = 0.075
window.space = false;
window.ArrowUp = false;
window.ArrowRight = false;
window.ArrowDown = false;
window.ArrowLeft = false;
window.isJumping = false;
window.dom = []
window.BVH = {}
window.stage = {
	devGridDots: false,
	userBoxFrame: false,
	sun: {},
	earth: {
		radius: 1000
	},
    terrain: {}
}

window.activeMapIndex = -1;
window.priorMapIndex = -1
window.map = {}

window.scene = new THREE.Scene();
window.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
window.camera.touches = new Set()
window.camera.foot = null;
window.camera.sectionTouched = null;
window.camera.triangleTouched = null;
window.scene.add(window.camera);
window.renderer = new THREE.WebGLRenderer();
window.renderer.setSize(window.innerWidth, window.innerHeight);
window.renderer.shadowMap.enabled = true;
window.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
window.renderer.domElement.id = "view";
document.body.appendChild(window.renderer.domElement);


window.addEventListener('keydown', function(e) {
    const key = e.key.toUpperCase();
    if (key == 'W') {
        window.w = true;
    } else if (key == 'A') {
        window.a = true;
    } else if (key == 'S') {
        window.s = true;
    } else if (key == 'D') {
        window.d = true;
    } else if (key == ' ') {
        if (!window.isJumping) {
            window.isJumping = true;
            window.jumpVelocity = 0.2; // Adjust the jump velocity as needed
        }
    } else if (key == 'ARROWUP') {
        window.ArrowUp = true;
    } else if (key == 'ARROWDOWN') {
        window.ArrowDown = true;
    } else if (key == 'ARROWLEFT') {
        window.ArrowLeft = true;
    } else if (key == 'ARROWRIGHT') {
        window.ArrowRight = true;
    }

   
})

window.addEventListener('keyup', function(e) {
    const key = e.key.toUpperCase();
    if (key == 'W') {
        window.w = false;
    } else if (key == 'A') {
        window.a = false;
    } else if (key == 'S') {
        window.s = false;
    } else if (key == 'D') {
        window.d = false;
    } else if (key == ' ') {
        window.space = false;
    } else if (key == 'ARROWUP') {
        window.ArrowUp = false;
    } else if (key == 'ARROWDOWN') {
        window.ArrowDown = false;
    } else if (key == 'ARROWLEFT') {
        window.ArrowLeft = false;
    } else if (key == 'ARROWRIGHT') {
        window.ArrowRight = false;
    }
})




class BVHNode {
    constructor(boundingBox, triangles, left = null, right = null) {
        this.boundingBox = boundingBox;
        this.triangles = triangles;
        this.left = left;
        this.right = right;
    }
}

function buildBVH(triangles, depth = 0) {
    if (triangles.length === 1) {
        return new BVHNode(triangles[0].geometry.boundingBox, [triangles[0]]);
    }

    const axis = depth % 3; // Cycle through x, y, z axes
    triangles.sort((a, b) => a.geometry.boundingBox.min[axis] - b.geometry.boundingBox.min[axis]);

    const mid = Math.floor(triangles.length / 2);
    const leftTriangles = triangles.slice(0, mid);
    const rightTriangles = triangles.slice(mid);

    const leftChild = buildBVH(leftTriangles, depth + 1);
    const rightChild = buildBVH(rightTriangles, depth + 1);

    const boundingBox = new THREE.Box3();
    boundingBox.union(leftChild.boundingBox);
    boundingBox.union(rightChild.boundingBox);

    return new BVHNode(boundingBox, [], leftChild, rightChild);
}


function checkCollision(cameraBoundingVolume, bvhNode) {
    if (!cameraBoundingVolume.intersectsBox(bvhNode.boundingBox)) {
        return null;
    }

    if (bvhNode.triangles.length > 0) {
        for (const triangle of bvhNode.triangles) {
            if (cameraBoundingVolume.intersectsTriangle(triangle.triangle)) {
                return triangle.triangle;
            }
        }
        return null;
    }

    return (
        checkCollision(cameraBoundingVolume, bvhNode.left) ||
        checkCollision(cameraBoundingVolume, bvhNode.right)
    );
}


function generatePointsInTriangle(v0, v1, v2, numPoints) {
    const points = [];
    
    for (let i = 0; i < numPoints; i++) {
        for (let j = 0; j < numPoints; j++) {
            const u = i / (numPoints - 1);
            const v = j / (numPoints - 1);
            

            if (u + v <= 1) {
            	const vector = new THREE.Vector3()
                    .addScaledVector(v0, 1 - u - v)
                    .addScaledVector(v1, u)
                    .addScaledVector(v2, v);
           
                points.push(vector);
            }
        }
    }
    
    return points;
}

function getTriangleNormal(triangle) {
    const v0 = new THREE.Vector3().subVectors(triangle.b, triangle.a);
    const v1 = new THREE.Vector3().subVectors(triangle.c, triangle.a);
    return new THREE.Vector3().crossVectors(v0, v1).normalize();
}

function TriangleAsUnderFoot(cameraBoundingBox, triangle) {
    const normal = getTriangleNormal(triangle);
    const slope = Math.acos(normal.dot(new THREE.Vector3(0, 1, 0))) * (180 / Math.PI);

    // Check if the triangle is within the camera bounding box vertically
    const minZ = Math.min(triangle.a.z, triangle.b.z, triangle.c.z);
    const maxZ = Math.max(triangle.a.z, triangle.b.z, triangle.c.z);

    if (cameraBoundingBox.min.z <= maxZ && cameraBoundingBox.max.z >= minZ) {
        return { Vector3: normal, slope: slope };
    }
    return null;
}

function TriangleAsAdjacent(triangle1, triangle2) {
    const vertices1 = [triangle1.a, triangle1.b, triangle1.c];
    const vertices2 = [triangle2.a, triangle2.b, triangle2.c];

    const sharedVertices = vertices1.filter(v1 =>
        vertices2.some(v2 => v1.equals(v2))
    );

    return sharedVertices.length === 2;
}

function TriangleAsOverhead(cameraBoundingBox, triangle) {
    const normal = getTriangleNormal(triangle);
    const slope = Math.acos(normal.dot(new THREE.Vector3(0, -1, 0))) * (180 / Math.PI);

    // Check if the triangle is within the camera bounding box vertically
    const minZ = Math.min(triangle.a.z, triangle.b.z, triangle.c.z);
    const maxZ = Math.max(triangle.a.z, triangle.b.z, triangle.c.z);

    if (cameraBoundingBox.min.z <= maxZ && cameraBoundingBox.max.z >= minZ) {
        return { Vector3: normal, slope: slope };
    }
    return null;
}


function GetMeshForTriangle(triangle) {
    for (var i = 0; i < dom.length; i++) {
        if (dom[i].triangle == triangle) {
            var cbb = new THREE.Box3().setFromCenterAndSize(
                camera.position,
                new THREE.Vector3(1, 1, 1) // Adjust the size as needed
            );
            return {
                mesh: dom[i],
                underFoot: TriangleAsUnderFoot(cbb, triangle),
                overHead: TriangleAsOverhead(cbb, triangle)
            }
        }
    }
    return null;
}


function touch(triangleMesh) {
}




// Function to get the adjacent indices
function getAdjacentIndices(mapIndex) {
    const [x, y, z] = mapIndex.split('_').map(Number);
    const adjacentIndices = [
        `${x}_${y}_${z}`,
        `${x+1}_${y}_${z}`,
        `${x}_${y+1}_${z}`,
        `${x+1}_${y+1}_${z}`
    ];
    return adjacentIndices;
}

var p = document.createElement('pre');
p.style.background = 'rgba(0,0,0,0.8)'
p.style.color = 'white'
document.body.appendChild(p);
p.style.position = 'absolute'
p.style.left = '0px'
p.style.top = '0px'
p.style.overflow = 'auto';
p.style.maxHeight = '100vh';
p.style.padding = '0.15rem 1rem'

function Sun() {
	var pointLight = new THREE.PointLight(0xfffefe, 999);

	pointLight.castShadow = true;
	var halfSize = 1000 * 2;
	pointLight.shadow.camera.left = -halfSize;
	pointLight.shadow.camera.right = halfSize;
	pointLight.shadow.camera.top = halfSize;
	pointLight.shadow.camera.bottom = -halfSize;

	scene.add(pointLight)
	pointLight.position.set(0, 100, 0)
}

function TriangleMesh(vertices, a, b, c) {
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

    const triangleMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(Math.random(), Math.random(), Math.random()), // Red color for the triangles
        side: THREE.DoubleSide
    });
    const triangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial);
    triangleMesh.castShadow = true;
    triangleMesh.receiveShadow = true;
    triangleMesh.triangle = new THREE.Triangle(
    	new THREE.Vector3(vertexPositions[0], vertexPositions[1], vertexPositions[2]),
    	new THREE.Vector3(vertexPositions[3], vertexPositions[4], vertexPositions[5]),
    	new THREE.Vector3(vertexPositions[6], vertexPositions[7], vertexPositions[8])
    );

    var points = generatePointsInTriangle(triangleMesh.triangle.a, triangleMesh.triangle.b, triangleMesh.triangle.c, 21);
    triangleMesh.points = points;

    return triangleMesh
}


function generateCanvasTexture(width, height, perlinNoise) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const noiseValue = perlinNoise[y * width + x];
            let color = { r: 0, g: 0, b: 0 };

            if (noiseValue < 0.3) {
                // Grassy areas
                color = { r: 139, g: 69, b: 19 }; // Brown
            } else if (noiseValue < 0.6) {
                // Rocky areas
                
                color = { r: 34, g: 139, b: 34 }; // Green
            } else {
                // Snowy peaks
                color = { r: 255, g: 250, b: 250 }; // White
            }

            ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    return new THREE.CanvasTexture(canvas);
}

function Terrain(T, v0, v1, v2, v3, segments, options = { slightBay: true }) {
    let vertices = [];
    let indices = [];
    let uvs = [];
    const cellSize = 10;
    const segmentSize = 1 / segments;

    const noiseWidth = T;
    const noiseHeight = T * 2;
    const perlinNoise = PERLIN.generatePerlinNoise(noiseWidth, noiseHeight);

    for (let i = 0; i <= segments; i++) {
        for (let j = 0; j <= segments; j++) {
            let x = i * segmentSize;
            let y = j * segmentSize;

            let v = new THREE.Vector3();
            v.x = (1 - x) * (1 - y) * v0.x + x * (1 - y) * v1.x + x * y * v2.x + (1 - x) * y * v3.x;
            v.y = (1 - x) * (1 - y) * v0.y + x * (1 - y) * v1.y + x * y * v2.y + (1 - x) * y * v3.y;
            v.z = (1 - x) * (1 - y) * v0.z + x * (1 - y) * v1.z + x * y * v2.z + (1 - x) * y * v3.z;

            let noiseX = Math.floor(x * (noiseWidth - 1));
            let noiseY = Math.floor(y * (noiseHeight - 1));
            let height = perlinNoise[noiseY * noiseWidth + noiseX] * 55;

            v.y += height;

            vertices.push(v.x, v.y, v.z);
            uvs.push(x, y);
        }
    }

    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < segments; j++) {
            let a = i + j * (segments + 1);
            let b = (i + 1) + j * (segments + 1);
            let c = (i + 1) + (j + 1) * (segments + 1);
            let d = i + (j + 1) * (segments + 1);

            if (a >= 0 && b >= 0 && c >= 0 && d >= 0 &&
                a < vertices.length / 3 && b < vertices.length / 3 && c < vertices.length / 3 && d < vertices.length / 3) {
                indices.push(a, b, d);
                indices.push(b, c, d);

                const t1 = TriangleMesh(vertices, a, b, d)
                const t2 = TriangleMesh(vertices, b, c, d)

                dom.push(t1, t2);
            } else {
                console.warn(`Invalid indices detected: a=${a}, b=${b}, c=${c}, d=${d}`);
            }
        }
    }

    const terrainTexture = generateCanvasTexture(noiseWidth, noiseHeight, perlinNoise);
    terrainTexture.wrapS = THREE.RepeatWrapping;
    terrainTexture.wrapT = THREE.RepeatWrapping;

    var planeGeometry = new THREE.BufferGeometry();
    planeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    planeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    planeGeometry.setIndex(indices);
    planeGeometry.computeVertexNormals();
    planeGeometry.computeBoundingBox();

    var material = new THREE.MeshStandardMaterial({
        map: terrainTexture,
        side: THREE.DoubleSide // Ensures both sides of the triangles are rendered
    });
    var mesh = new THREE.Mesh(planeGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.position.set(0, 0, 0);
    scene.add(mesh);

    window.BVH = buildBVH(dom);

    return mesh;
}



var al = new THREE.AmbientLight(0xfffefe, 3);
al.position.set(0,0,0);
scene.add(al)

camera.position.y = 50

function Watch() {
	requestAnimationFrame(Watch)
	p.innerHTML = `
CAMERA:   ${camera.position.x}, ${camera.position.y}, ${camera.position.z}
HAS COLLISION:   ${camera.hasCollision}  ${ camera.hasCollision ? `
    ${camera.triangleTouched.a.x}, ${camera.triangleTouched.a.y}, ${camera.triangleTouched.a.z}
    ${camera.triangleTouched.b.x}, ${camera.triangleTouched.b.y}, ${camera.triangleTouched.b.z}
    ${camera.triangleTouched.c.x}, ${camera.triangleTouched.c.y}, ${camera.triangleTouched.c.z}
` : ''}
SECTION TOUCHED: <table style="overflow: auto;wmax-width:100vw;">
	<tr>
		<th>uuid</th>
        <th>touch type</th>
        <th>slope</th>
	</tr>
    ${ camera.sectionTouched && camera.sectionTouched.mesh ? `
        <tr>
            <td>${camera.sectionTouched.mesh.uuid}</td>
            <td>${(
                camera.sectionTouched.underFoot ? 'under-foot' : (
                    camera.sectionTouched.overHead ? 'over-head' : '?'
                )
            )}</td>
            <td>
                ${(
                    camera.sectionTouched.underFoot ? camera.sectionTouched.underFoot.slope : (
                        camera.sectionTouched.overHead ? camera.sectionTouched.overHead.slope : '?'
                    )
                )}
            </td>
        </tr>` : ''
    }
</table>
`
}


// window.Animate = function() {
//     window.requestAnimationFrame(Animate);

//     if (window.w || window.a || window.s || window.d) {
//         var direction = new THREE.Vector3();
//         var right = new THREE.Vector3();
//         var forwardMovement = new THREE.Vector3();
//         var rightMovement = new THREE.Vector3();

//         if (window.w) {
//             window.camera.getWorldDirection(direction);
//             forwardMovement.add(direction.multiplyScalar(window.wS));
//         }
//         if (window.a) {
//             window.camera.getWorldDirection(direction);
//             right.crossVectors(window.camera.up, direction).normalize();
//             rightMovement.add(right.multiplyScalar(window.aS));
//         }
//         if (window.s) {
//             window.camera.getWorldDirection(direction);
//             forwardMovement.add(direction.multiplyScalar(-window.sS));
//         }
//         if (window.d) {
//             window.camera.getWorldDirection(direction);
//             right.crossVectors(window.camera.up, direction).normalize();
//             rightMovement.add(right.multiplyScalar(-window.dS));
//         }

//         var combinedMovement = new THREE.Vector3();
//         combinedMovement.add(forwardMovement).add(rightMovement);

//         if (camera.hasCollision && camera.triangleTouched) {
//             var triangleNormal = new THREE.Vector3();
//             camera.triangleTouched.getNormal(triangleNormal);
//             combinedMovement.projectOnPlane(triangleNormal);

//             var newPosition = new THREE.Vector3().copy(window.camera.position).add(combinedMovement);
//             var isInsideTriangle = isPointInTriangle(newPosition, camera.triangleTouched);

//             if (isInsideTriangle) {
//                 window.camera.position.copy(newPosition);
//             }
//         } else {
//             window.camera.position.add(combinedMovement);
//         }
//     }

//     if (window.ArrowUp || window.ArrowDown) {
//         if (window.ArrowUp) {
//             camera.rotateX(window.tS);
//         }
//         if (window.ArrowDown) {
//             camera.rotateX(-window.tS);
//         }
//     }

//     if (window.ArrowLeft || window.ArrowRight) {
//         let quaternionY = new THREE.Quaternion();
//         let quaternionX = new THREE.Quaternion();

//         if (window.ArrowLeft) {
//             quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), window.tS);
//         }

//         if (window.ArrowRight) {
//             quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -window.tS);
//         }

//         camera.quaternion.multiplyQuaternions(quaternionY, window.camera.quaternion);
//     }

//     const cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(
//         camera.position,
//         new THREE.Vector3(1, 1, 1) // Adjust the size as needed
//     );
//     const collisionDetected = checkCollision(cameraBoundingBox, window.BVH);
//     if (collisionDetected) {
//         camera.hasCollision = true;
//         camera.triangleTouched = collisionDetected;
//         var section = GetMeshForTriangle(collisionDetected);
//         camera.sectionTouched = section;
//         camera.touches.add(section.mesh);
//         scene.add(section.mesh);

//         // todo: Movements align with the triangle
//     } else {
//         camera.hasCollision = false;
//         camera.position.y += -0.009;
//     }

//     window.renderer.render(window.scene, window.camera);
// }



window.Animate = function() {
    window.requestAnimationFrame(Animate);

    var combinedMovement = new THREE.Vector3();

    // Handle movement
    if (window.w || window.a || window.s || window.d) {
        var direction = new THREE.Vector3();
        var right = new THREE.Vector3();
        var forwardMovement = new THREE.Vector3();
        var rightMovement = new THREE.Vector3();

        if (window.w) {
            window.camera.getWorldDirection(direction);
            forwardMovement.add(direction.multiplyScalar(window.wS));
        }
        if (window.a) {
            window.camera.getWorldDirection(direction);
            right.crossVectors(window.camera.up, direction).normalize();
            rightMovement.add(right.multiplyScalar(window.aS));
        }
        if (window.s) {
            window.camera.getWorldDirection(direction);
            forwardMovement.add(direction.multiplyScalar(-window.sS));
        }
        if (window.d) {
            window.camera.getWorldDirection(direction);
            right.crossVectors(window.camera.up, direction).normalize();
            rightMovement.add(right.multiplyScalar(-window.dS));
        }

        combinedMovement.add(forwardMovement).add(rightMovement);
    }

    // Handle jump and gravity
    if (window.isJumping) {
        window.camera.position.y += window.jumpVelocity;
        window.jumpVelocity -= 0.01; // Adjust the gravity effect on jump

        if (window.jumpVelocity < 0) {
            window.isJumping = false

        } else {
             // Check for collision with ground
            const cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(
                camera.position,
                new THREE.Vector3(1, 1, 1) // Adjust the size as needed
            );
            const collisionDetected = checkCollision(cameraBoundingBox, window.BVH);
            if (collisionDetected) {
                camera.hasCollision = true;
                camera.triangleTouched = collisionDetected;
                var section = GetMeshForTriangle(collisionDetected);
                camera.sectionTouched = section;
                camera.touches.add(section.mesh);
                scene.add(section.mesh);

                // Stop the jump when hitting the ground
                if (window.jumpVelocity <= 0) {
                    window.isJumping = false;
                    window.jumpVelocity = 0;
                    window.camera.position.y = section.mesh.position.y + 1; // Adjust for the height of the triangle surface
                }
            }
        }
    } else if (!camera.hasCollision) {
        window.camera.position.y += -0.09; // Gravity
    }

    // Handle collision detection for horizontal movements
    const cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(
        camera.position,
        new THREE.Vector3(1, 1, 1) // Adjust the size as needed
    );
    const collisionDetected = checkCollision(cameraBoundingBox, window.BVH);
    if (collisionDetected) {
        camera.hasCollision = true;
        camera.triangleTouched = collisionDetected;
        var section = GetMeshForTriangle(collisionDetected);
        camera.sectionTouched = section;
        camera.touches.add(section.mesh);
        scene.add(section.mesh);

        // Adjust position to stay on top of the triangle
        if (window.camera.position.y < section.mesh.position.y + 1) {
            window.camera.position.y = section.mesh.position.y + 1
        }

        if (combinedMovement.length() > 0) {
            var triangleNormal = new THREE.Vector3();
            camera.triangleTouched.getNormal(triangleNormal);
            combinedMovement.projectOnPlane(triangleNormal);

            var newPosition = new THREE.Vector3().copy(window.camera.position).add(combinedMovement);
            var isInsideTriangle = isPointInTriangle(newPosition, camera.triangleTouched);

            if (isInsideTriangle) {
                window.camera.position.copy(newPosition);
            } else {
                window.camera.position.add(combinedMovement);
            }
        }
    } else {
        camera.hasCollision = false;
        window.camera.position.add(combinedMovement);
    }

    // Handle rotation
    if (window.ArrowUp || window.ArrowDown) {
        if (window.ArrowUp) {
            camera.rotateX(window.tS);
        }
        if (window.ArrowDown) {
            camera.rotateX(-window.tS);
        }
    }

    if (window.ArrowLeft || window.ArrowRight) {
        let quaternionY = new THREE.Quaternion();
        let quaternionX = new THREE.Quaternion();

        if (window.ArrowLeft) {
            quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), window.tS);
        }

        if (window.ArrowRight) {
            quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -window.tS);
        }

        camera.quaternion.multiplyQuaternions(quaternionY, window.camera.quaternion);
    }

    window.renderer.render(window.scene, window.camera);
}





// Helper function to check if a point is inside a triangle
function isPointInTriangle(point, triangle) {
    var v0 = new THREE.Vector3().subVectors(triangle.c, triangle.a);
    var v1 = new THREE.Vector3().subVectors(triangle.b, triangle.a);
    var v2 = new THREE.Vector3().subVectors(point, triangle.a);

    var dot00 = v0.dot(v0);
    var dot01 = v0.dot(v1);
    var dot02 = v0.dot(v2);
    var dot11 = v1.dot(v1);
    var dot12 = v1.dot(v2);

    var invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    var u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    var v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    return (u >= 0) && (v >= 0) && (u + v < 1);
}


// window.Animate = function() {
//     window.requestAnimationFrame(Animate);

//     if (window.w || window.a || window.s || window.d) {
//         var direction = new THREE.Vector3();
//         var right = new THREE.Vector3();
//         var forwardMovement = new THREE.Vector3();
//         var rightMovement = new THREE.Vector3();

//         if (window.w) {
//             window.camera.getWorldDirection(direction);
//             forwardMovement.add(direction.multiplyScalar(window.wS));
//         }
//         if (window.a) {
//             window.camera.getWorldDirection(direction);
//             right.crossVectors(window.camera.up, direction).normalize();
//             rightMovement.add(right.multiplyScalar(window.aS));
//         }
//         if (window.s) {
//             window.camera.getWorldDirection(direction);
//             forwardMovement.add(direction.multiplyScalar(-window.sS));
//         }
//         if (window.d) {
//             window.camera.getWorldDirection(direction);
//             right.crossVectors(window.camera.up, direction).normalize();
//             rightMovement.add(right.multiplyScalar(-window.dS));
//         }

//         var combinedMovement = new THREE.Vector3();
//         combinedMovement.add(forwardMovement).add(rightMovement);

//         if (camera.hasCollision && camera.triangleTouched) {
//             var triangleNormal = new THREE.Vector3();
//             camera.triangleTouched.getNormal(triangleNormal);
//             combinedMovement.projectOnPlane(triangleNormal);
//         }

//         window.camera.position.add(combinedMovement);
//     }

//     if (window.ArrowUp || window.ArrowDown) {
//         if (window.ArrowUp) {
//             camera.rotateX(window.tS);
//         }
//         if (window.ArrowDown) {
//             camera.rotateX(-window.tS);
//         }
//     }

//     if (window.ArrowLeft || window.ArrowRight) {
//         let quaternionY = new THREE.Quaternion();
//         let quaternionX = new THREE.Quaternion();

//         if (window.ArrowLeft) {
//             quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), window.tS);
//         }

//         if (window.ArrowRight) {
//             quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -window.tS);
//         }

//         camera.quaternion.multiplyQuaternions(quaternionY, window.camera.quaternion);
//     }

//     const cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(
//         camera.position,
//         new THREE.Vector3(1, 1, 1) // Adjust the size as needed
//     );
//     const collisionDetected = checkCollision(cameraBoundingBox, window.BVH);
//     if (collisionDetected) {
//         camera.hasCollision = true;
//         camera.triangleTouched = collisionDetected;
//         var section = GetMeshForTriangle(collisionDetected);
//         camera.sectionTouched = section;
//         camera.touches.add(section.mesh);
//         scene.add(section.mesh);

//         // todo: Movements align with the triangle
//     } else {
//         camera.hasCollision = false;
//         camera.position.y += -0.09;
//     }

//     window.renderer.render(window.scene, window.camera);
// }




// window.Animate = function() {
//     window.requestAnimationFrame(Animate)
//     if (window.w) {
//         var direction = new THREE.Vector3();
//         window.camera.getWorldDirection(direction);
//         direction.multiplyScalar(window.wS);
//         window.camera.position.add(direction);
//     }
//     if (window.a) {
//         var direction = new THREE.Vector3();
//         var right = new THREE.Vector3();
//         window.camera.getWorldDirection(direction);
//         right.crossVectors(window.camera.up, direction).normalize();
//         right.multiplyScalar(window.aS);
//         window.camera.position.add(right);
//     }
//     if (window.s) {
//         var direction = new THREE.Vector3();
//         window.camera.getWorldDirection(direction);
//         direction.multiplyScalar(-window.sS);
//         window.camera.position.add(direction);
//     }
//     if (window.d) {
//         var direction = new THREE.Vector3();
//         var right = new THREE.Vector3();
//         window.camera.getWorldDirection(direction);
//         right.crossVectors(window.camera.up, direction).normalize();
//         right.multiplyScalar(-window.dS);
//         window.camera.position.add(right);
//     }
//     if (window.ArrowUp || window.ArrowDown) {

//         if (window.ArrowUp) {
//             camera.rotateX(window.tS)
//         }

//         if (window.ArrowDown) {
//             camera.rotateX(-window.tS)
//         }

//     }
//     if (window.ArrowLeft || window.ArrowRight) {
//         let quaternionY = new THREE.Quaternion();
//         let quaternionX = new THREE.Quaternion();

//         if (window.ArrowLeft) {
//             quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), window.tS);
//         }

//         if (window.ArrowRight) {
//             quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -window.tS);
//         }

//         camera.quaternion.multiplyQuaternions(quaternionY, window.camera.quaternion);
//     }

//     const cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(
//         camera.position,
//         new THREE.Vector3(1, 1, 1) // Adjust the size as needed
//     );
//     const collisionDetected = checkCollision(cameraBoundingBox, window.BVH);
//     if (collisionDetected) {
//         camera.hasCollision = true;
//         camera.triangleTouched = collisionDetected
//         var section = GetMeshForTriangle(collisionDetected);
//         camera.sectionTouched = section;
//         camera.touches.add(section.mesh);
//         scene.add(section.mesh);


//     } else {
//         camera.hasCollision = false;
//         camera.position.y += -0.009;
//     }



//     window.renderer.render(window.scene, window.camera)
// }

var T = 64
var terrain = Terrain(T,
    { x: -T, y: 0, z: T },
    { x: T, y: 0, z: T },
    { x: T, y: 0, z: -T },
    { x: -T, y: 0, z: -T },
    100
)
Sun()
Animate();
Watch()
