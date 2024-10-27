import * as THREE from '/lib/three.module.min.js';
import { UnrealBloomPass } from '/lib/UnrealBloomPass.js';
import { EffectComposer } from '/lib/EffectComposer.js';
import { RenderPass } from '/lib/RenderPass.js';
import { CSG } from '/lib/CSG.js'
import { SUBTRACTION, Brush, Evaluator } from '/lib/three-bvh-csg.js';
import ViewModel from "/src/view-model.js";

window.CYPRESSGREENS = ['#93b449', '#6b881c', '#a9cc4e']
window.CYPRESSBRANCH = new THREE.TextureLoader().load("/images/branch.webp")
window.TRUNKTEXTURE = new THREE.TextureLoader().load("/images/trees/bark/bark-2.jpg")
window.cementTexture = new THREE.TextureLoader().load("/images/ground-0.jpg", texture => {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.rotation = Math.random() * Math.PI * 2
    texture.repeat.set(100, 100)
})
var clock = new THREE.Clock()
const evaluator = new Evaluator();

var floorTexture = new THREE.TextureLoader().load("/images/floor2.jpg", texture => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
})
const groundTexture = new THREE.TextureLoader().load("/images/ground-0.jpg")

var landscape = {
    field: {
        center: {
            x: 0,
            y: 10,
            z: 0
        },
        width: 50,
        depth: 35
    }
}

var house = {
    center: landscape.field.center,
    width: 30,
    depth: 20,
    foundation: {
        width: 20,
        height: 1,
        depth: 20
    }
}
var dockDepth = house.width
const boardwalk = {
    width: (landscape.field.width / 2) - (house.width / 2),
    depth: dockDepth,
    height: 0.2,
    center: {
        x: (house.width / 2) + (((landscape.field.width / 2) - (house.width / 2)) / 2),
        y: house.center.y + .1,
        z: 0
    }
}
// Define the side yard boundaries extending from the house foundation
var sideYardStartZ = house.center.z - house.foundation.depth / 2 - 50;  // Extend outwards on the -Z side
var sideYardEndZ = house.center.z - house.foundation.depth / 2 - 5;    // Extend outwards on the +Z side
var sideYardStartX = house.center.x - house.foundation.width / 2 - 30;  // Extend outwards on the -X side
var sideYardEndX = house.center.x + house.foundation.width / 2 + 30;    // Extend outwards on the +X side
var sideYardStartY = house.center.y - house.foundation.height / 2;      // Match house Y bounds
var sideYardEndY = house.center.y + house.foundation.height / 2;        // Match house Y bounds

// Function to check if point `v` is within the side yard boundaries
function isIn(v, which) {
    switch (which) {
        case 'sideyard':
            return (
                v.x >= sideYardStartX && 
                v.x <= sideYardEndX &&
                v.y >= sideYardStartY && 
                v.y <= sideYardEndY &&
                v.z >= sideYardStartZ && 
                v.z <= sideYardEndZ
            );
        case 'backyard':
            return (
                v.x <= house.center.x - house.foundation.width / 2
            )
        default:
            return false;
    }
}


function randomPointOnTriangle(A, B, C) {
    // Generate two random numbers between 0 and 1
    let u = Math.random();
    let v = Math.random();

    // If u + v > 1, flip the coordinates to keep the point inside the triangle
    if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
    }

    // Calculate the random point P on the triangle
    const P = new THREE.Vector3();
    P.addScaledVector(A, 1 - u - v);
    P.addScaledVector(B, u);
    P.addScaledVector(C, v);

    return P;
}

var twoPi = Math.PI * 2
function piBy01() {
    var arr = []
    for (var i = 0; i < twoPi; i += .01) {
        arr.push(i)
    }
    return arr
}

function interpolateArrays(array1, array1Index, array2) {
    var sourceIndexPercent = new Number(array1Index / array1.length).toFixed(2)
    var targetIndex = Math.floor(array2 / sourceIndexPercent)
    return array2[targetIndex]
}

var pillars = []
var composer

window.THREE = THREE;

const cameraBoundingBox = () => new THREE.Box3().setFromCenterAndSize(
    window.user.camera.position,
    new THREE.Vector3(.35, 1.2, .2) // Adjust size if needed
);

window.sliding = false


window.GRAVITY = -0.05
window.TERMINAL_VELOCITY = -.5,

window.sunMaxDist = -Infinity;
window.sunMinDist = Infinity
window.map = {}
var oceanBackground = null;

function moveMeshAlongNormal(mesh, offset) {
    // Calculate the normal of the mesh's geometry
    const geometry = mesh.geometry;
    geometry.computeVertexNormals();

    // Assuming the mesh is a single triangle
    const normal = new THREE.Vector3();
    const positions = geometry.attributes.position;
    const vertexA = new THREE.Vector3(positions.getX(0), positions.getY(0), positions.getZ(0));
    const vertexB = new THREE.Vector3(positions.getX(1), positions.getY(1), positions.getZ(1));
    const vertexC = new THREE.Vector3(positions.getX(2), positions.getY(2), positions.getZ(2));

    const triangle = new THREE.Triangle(vertexA, vertexB, vertexC);
    triangle.getNormal(normal);

    // Move the mesh along the normal
    mesh.position.add(normal.multiplyScalar(offset));
}

window.sceneRadius = 150

var origin = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), new THREE.MeshStandardMaterial({ color: 'turquoise' }));
origin.position.set(0, 0, 0);
// Global bounding box for the camera

function getPositionFromVertexArray(array) {
    const positions = [];
    // Iterate through the array, stepping by 3 to group (x, y, z) coordinates
    for (let i = 0; i < array.length; i += 3) {
        const position = {
            x: array[i],        // x coordinate
            y: array[i + 1],    // y coordinate
            z: array[i + 2]     // z coordinate
        };
        positions.push(position);
    }
    return positions;
}

function asdwFromNormalAndDistance(normal, cameraPosition, intersectionPoint) {
    const movementKeys = [];

    // Calculate the vector from the camera to the intersection point
    const directionToIntersection = [
        intersectionPoint[0] - cameraPosition[0],
        intersectionPoint[1] - cameraPosition[1],
        intersectionPoint[2] - cameraPosition[2]
    ];

    // Normalize the directionToIntersection vector
    const magnitude = Math.sqrt(
        directionToIntersection[0] ** 2 +
        directionToIntersection[1] ** 2 +
        directionToIntersection[2] ** 2
    );
    const normalizedDirection = [
        directionToIntersection[0] / magnitude,
        directionToIntersection[1] / magnitude,
        directionToIntersection[2] / magnitude
    ];

    // Dot product of the normal and the direction from the camera
    const dotProduct = 
        normalizedDirection[0] * normal[0] +
        normalizedDirection[1] * normal[1] +
        normalizedDirection[2] * normal[2];

    // Determine if the intersection is in front (forward) or behind (backward)
    if (dotProduct > 0) {
        movementKeys.push('W'); // Move forward (W) toward the surface
    } else if (dotProduct < 0) {
        movementKeys.push('S'); // Move backward (S) away from the surface
    }

    // Cross product for determining left (A) or right (D)
    const rightVector = [
        cameraPosition[1] * normal[2] - cameraPosition[2] * normal[1],
        cameraPosition[2] * normal[0] - cameraPosition[0] * normal[2],
        cameraPosition[0] * normal[1] - cameraPosition[1] * normal[0]
    ];

    // Dot product of the right vector and the direction to the intersection
    const dotRight = 
        normalizedDirection[0] * rightVector[0] +
        normalizedDirection[1] * rightVector[1] +
        normalizedDirection[2] * rightVector[2];

    // Determine left (A) or right (D) movement
    if (dotRight > 0) {
        movementKeys.push('D'); // Move right (D)
    } else {
        movementKeys.push('A'); // Move left (A)
    }

    return movementKeys;
}

function mapToRange(normalizedValue, minNew, maxNew) {
    return minNew + normalizedValue * (maxNew - minNew);
}

function randomInRange(from, to, startDistance = 0) {
   const min = Math.min(from, to) + startDistance;
   const max = Math.max(from, to) + startDistance;
   const val = Math.random() * (max - min) + min;
   return val;
}

class GrassPatch {
    constructor(initobject) {
        this.mesh = initobject.mesh;
        this.triangle = initobject.triangle
        this.bladePositions = initobject.bladePositions;
        this.ground = initobject.ground
    }
}





function TriangleMesh(vertices, a, b, c, terrainWidth, terrainHeight, map) {

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
        map,
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
    triangleMesh.triangle.indices = [0,1,2]

    // Calculate the triangle's normal and slope
    const normal = new THREE.Vector3();
    triangleMesh.triangle.getNormal(normal);
    const slope = Math.acos(normal.dot(new THREE.Vector3(0, 1, 0))) * (180 / Math.PI);

    triangleMesh.slope = slope;
    triangleMesh.normal = normal;
    triangleMesh.triangle.uvs = uvs;  // Store UVs for later use (e.g., for texture painting)

    return triangleMesh;
}


function Triangle(vertices, a, b, c) {
    const vertexPositions = [
        vertices[a * 3], vertices[a * 3 + 1], vertices[a * 3 + 2],  // Vertex a
        vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2],  // Vertex b
        vertices[c * 3], vertices[c * 3 + 1], vertices[c * 3 + 2]   // Vertex c
    ];

    for (var i = 0; i < vertexPositions.length; i++) {
        if (Number.isNaN(vertexPositions[i])) {
            debugger
        }
    }

    // Create the THREE.Triangle object
    const triangle = new THREE.Triangle(
        new THREE.Vector3(vertexPositions[0], vertexPositions[1], vertexPositions[2]),
        new THREE.Vector3(vertexPositions[3], vertexPositions[4], vertexPositions[5]),
        new THREE.Vector3(vertexPositions[6], vertexPositions[7], vertexPositions[8])
    );

    // Set up indices (for BufferGeometry)
    const indices = [0, 1, 2];  // Indices for a single triangle (points a, b, c)

    // Create the BufferGeometry
    const triangleGeometry = new THREE.BufferGeometry();
    triangleGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexPositions), 3));
    triangleGeometry.setIndex(indices);
    triangleGeometry.computeBoundingBox()

    // Create a mesh for the triangle with a basic material (optional)
    const triangleMesh = new THREE.Mesh(
        triangleGeometry, 
        new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        side: THREE.BackSide
    }));
    triangleMesh.name = `${a}_${b}_${c}`

    // Return the triangle data and mesh
    return {
        triangle: triangle,            // THREE.Triangle object
        position: new THREE.Vector3(
            (triangle.a.x + triangle.b.x + triangle.c.x / 3),
            (triangle.a.y + triangle.b.y + triangle.c.y / 3),
            (triangle.a.z + triangle.b.z + triangle.c.z / 3),
        ),
        vertexPositions: vertexPositions, // Raw vertex positions
        indices: indices,                // Indices for BufferGeometry
        mesh: triangleMesh               // The mesh object for this triangle
    };
}

function TriangleGrid(vertices, a, b, c) {
    const vertexPositions = [
        vertices[a * 3], vertices[a * 3 + 1], vertices[a * 3 + 2],  // Vertex a
        vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2],  // Vertex b
        vertices[c * 3], vertices[c * 3 + 1], vertices[c * 3 + 2]   // Vertex c
    ];

    // Midpoints of the edges
    const midpointAB = [
        (vertexPositions[0] + vertexPositions[3]) / 2, // X midpoint between a and b
        (vertexPositions[1] + vertexPositions[4]) / 2, // Y midpoint
        (vertexPositions[2] + vertexPositions[5]) / 2  // Z midpoint
    ];

    const midpointBC = [
        (vertexPositions[3] + vertexPositions[6]) / 2, // X midpoint between b and c
        (vertexPositions[4] + vertexPositions[7]) / 2, // Y midpoint
        (vertexPositions[5] + vertexPositions[8]) / 2  // Z midpoint
    ];

    const midpointCA = [
        (vertexPositions[6] + vertexPositions[0]) / 2, // X midpoint between c and a
        (vertexPositions[7] + vertexPositions[1]) / 2, // Y midpoint
        (vertexPositions[8] + vertexPositions[2]) / 2  // Z midpoint
    ];


    const smallerTriangles = [
        // Outer triangle 1: a, midpointAB, midpointCA
        [vertexPositions.slice(0, 3), midpointAB, midpointCA],

        // Outer triangle 2: b, midpointBC, midpointAB
        [vertexPositions.slice(3, 6), midpointBC, midpointAB],

        // Outer triangle 3: c, midpointCA, midpointBC
        [vertexPositions.slice(6, 9), midpointCA, midpointBC],

        // Inner upside-down triangle: midpointAB, midpointBC, midpointCA
        [midpointAB, midpointBC, midpointCA]
    ];

    const triangles = [];

    // Create a mesh for each smaller triangle
    smallerTriangles.forEach((triangleVertices, index) => {
        var triangle = new THREE.Triangle(
            new THREE.Vector3(...triangleVertices[0]),
            new THREE.Vector3(...triangleVertices[1]),
            new THREE.Vector3(...triangleVertices[2])
        )

        const center = new THREE.Vector3();
        triangle.getMidpoint(center);

        const normal = new THREE.Vector3();
        triangle.getNormal(normal);
        const side1 = triangle.a.distanceTo(triangle.b);
        const side2 = triangle.b.distanceTo(triangle.c);
        const side3 = triangle.c.distanceTo(triangle.a);
        const averageSide = (side1 + side2 + side3) / 3;
        const matrix = new THREE.Matrix4();
        matrix.setPosition(center.x, center.y, center.z);

        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        matrix.makeRotationFromQuaternion(quaternion);

        matrix.scale(new THREE.Vector3(averageSide, averageSide, averageSide));

        triangle.matrix = matrix
        triangle.center = center
        triangle.normal = normal

        triangles.push(triangle);
     });

    // Return the array of triangle meshes
    return triangles
}

function Lathe(x, y, z, color) {
    const height = randomInRange(1.2, 3.2)
    const group = new THREE.Group();
    
    // Define mesh material arguments
    const meshMaterialArgs = { 
        color: color || 'pink',
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0.95
    }
    // Create the mesh material
    const meshMaterial = new THREE.MeshStandardMaterial(meshMaterialArgs);
    

    // Generate profile points for LatheGeometry
    const points = [];
    for (let i = 0; i <= 10; i++) {
        const heightStep = (i / 10) * height;
        const  x = Math.sin(i * 0.2) * (height / 2) * (Math.random() < 0.5 ? -1 : 1)
        const  y = heightStep - (height / 2) 

        points.push(new THREE.Vector2(x, y));
    }

    // Lathe geometry parameters
    const data = {
        segments: 12,
        phiStart: Math.random(),
        phiLength: 3.14
    };

    // Create the lathe geometry
    const geometry = new THREE.LatheGeometry(points, data.segments, data.phiStart, data.phiLength);

    // Create the wireframe and mesh and add them to the group
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.castShadow = true
    mesh.receiveShadow = true

    group.add(mesh);

    // Set the position of the group
    group.position.set(x, y + (height / 2), z);

    return group
}




// function User(camera) {
//     var leftArm = {
//         shoulder: [],
//         elbow: [],
//         wrist: [],
//         knuckleA: [],
//         knuckleB: [],
//         knuckleC: [],
//         knuckleD: [],
//         knuckleE: [],
//         skin_tone: 'pink'
//     }

    
// }



function getInstancePosition(instancedMesh, index) {
    const matrix = new THREE.Matrix4();
    instancedMesh.getMatrixAt(index, matrix);  // Get the transformation matrix for the instance

    const position = new THREE.Vector3();
    position.setFromMatrixPosition(matrix);  // Extract the position from the matrix

    return position;
}

function colorshade(rgb) {
    if (rgb === 0) {
        // Random shade of red
        const red = Math.floor(Math.random() * 256);  // Generate a random value for red (0-255)
        return `rgb(${red}, 0, 0)`;  // Full red, no green, no blue
    } else if (rgb === 1) {
        // Random shade of green
        const green = Math.floor(Math.random() * 256);
        return `rgb(0, ${green}, 0)`;  // Full green, no red, no blue
    } else if (rgb === 2) {
        // Random shade of blue
        const blue = Math.floor(Math.random() * 256);
        return `rgb(0, 0, ${blue})`;  // Full blue, no red, no green
    } else {
        // Random color (any shade of RGB)
        const red = Math.floor(Math.random() * 256);
        const green = Math.floor(Math.random() * 256);
        const blue = Math.floor(Math.random() * 256);
        return `rgb(${red}, ${green}, ${blue})`;
    }
}

class Sky {

    constructor(user) {
        this.counter = 0;
        this.user = user;
        this.sceneRadius = 550;
        this.full_circle = 2 * Math.PI;
        this.time = 0;

        this.hemisphereLight = new THREE.HemisphereLight(0xfefeff, 0x444444, .05); // Sky and ground color
        this.hemisphereLight.position.set(0, 0, 0);
        // scene.add(this.hemisphereLight);


        this.sun = new THREE.DirectionalLight(0xffffff, 2);
        this.sun.position.set(0, sceneRadius, 0);
        scene.add(this.sun)
        this.sun.lookAt(0, 0, 0)

        this.sun.castShadow = true; // Enable shadow casting for the light

        // Optionally configure shadow map size for better shadow quality
        this.sun.shadow.mapSize.width = 1024;
        this.sun.shadow.mapSize.height = 1024;

        // Configure the shadow camera for the directional light (this affects shadow casting area)
        this.sun.shadow.camera.near = 0.005;
        this.sun.shadow.camera.far = 1200;
        this.sun.shadow.camera.left = -1200;
        this.sun.shadow.camera.right = 1200;
        this.sun.shadow.camera.top = 1200;
        this.sun.shadow.camera.bottom = -1200;
        this.sky = [];
        this.sphere = new THREE.Mesh(
            new THREE.SphereGeometry(11, 30, 30), 
            new THREE.MeshBasicMaterial({ 
                side: THREE.DoubleSide, 
                color: 'white' 
            })
        );
        this.sphere.position.copy(this.sun.position)
        scene.add(this.sphere)

        // Set up the composer for postprocessing
        composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, user.camera);
        composer.addPass(renderPass);

        // Set up the UnrealBloomPass
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5,    // Strength of bloom
            0.4,    // Bloom radius
            0.85    // Threshold
        );
        composer.addPass(bloomPass);



        this.createDome();

        // for (var i = 0; i < 29; i++) {
        //     var cloud = this.MakeCloud()
        //     cloud.position.y += randomInRange(50, 250)
        //     cloud.position.x -= randomInRange(-50, 50)
        //     cloud.position.z -= randomInRange(-50, 50)

        //     scene.add(cloud)
        // }

    }

    createDome() {
        this.time = Math.PI / 2;
        var gridSize = 90;  // Larger grid size for more detail at the horizon
        var radius = this.sceneRadius;
        var points = [];  // Array to hold positions for all points in the dome
        var colors = [];  // Array to store color for each point
        var thetaPhiArray = [];  // Array to store the theta and phi angles for each point
        var maxdist = 0;
        var highestY = 0;

        // Material for the points
        var pointMaterial = new THREE.PointsMaterial({
            size: 50,  // Size of each point
            vertexColors: true,  // Allow different colors per vertex (point)
            transparent: false,
            opacity: 0.8  // Set initial opacity for points
        });

        // Loop through to calculate points in spherical coordinates
        for (var i = 0; i < gridSize; i++) {
            for (var j = 0; j < gridSize; j++) {
                // Calculate spherical coordinates
                var theta = (i / gridSize) * Math.PI;
                var phi = (j / gridSize) * Math.PI;

                // Convert spherical coordinates to Cartesian coordinates
                var x = radius * Math.sin(phi) * Math.cos(theta);
                var z = radius * Math.cos(phi);
                var y = radius * Math.sin(phi) * Math.sin(theta);

                if (y > highestY) highestY = y;

                // Lerp colors from sky blue to white based on the height (closer to horizon = more white)
                var horizonFactor = Math.abs(y / radius);  // 0 at horizon, 1 at top
                var skyColor = new THREE.Color(0x00f0ff);  // Sky blue color
                var white = new THREE.Color(0xffffff);  // White at horizon
                var color = new THREE.Color().lerpColors(white, skyColor, horizonFactor);  // Interpolate color

                // Add position to points array
                points.push(x, y, z);

                // Add color to the colors array (r, g, b values)
                colors.push(color.r, color.g, color.b);

                // Store theta and phi for use in lighting updates later
                thetaPhiArray.push({ theta: theta, phi: phi });

                if (z > maxdist) maxdist = z;
            }
        }

        // Create buffer geometries to hold the positions and colors for the points
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Store the theta and phi for each point inside the geometry
        geometry.userData = { thetaPhiArray: thetaPhiArray };

        // Create the points cloud and add it to the scene
        var pointCloud = new THREE.Points(geometry, pointMaterial);
        this.sky.push(pointCloud);  // Add the point cloud to the sky array for updates
        scene.add(pointCloud);  // Add the point cloud to the scene
    }



    update() {
        if (this.time > Math.PI * 2) {
            this.time = 0
        }

        if (this.time > Math.PI) {
            this.sun.intensity = 0
        } else {
            this.sun.intensity = 2
        }

        this.time += 0.0001
        // Sun's position: moving along the x and y axes while keeping z fixed at 0
        var sunX = this.sceneRadius * Math.cos(this.time);  // Sun moves along the x-axis
        var sunY = this.sceneRadius * Math.sin(this.time);  // Sun rises and falls along the y-axis
        var sunZ = 0;  // Sun remains at z = 0

        // Update sun and sphere positions based on this movement
        this.sun.position.set(sunX, sunY, sunZ);
        this.sphere.position.set(sunX, sunY, sunZ);  // Optional sphere for visualizing the sun

        // Define the maximum distance from the sun where sunrise/sunset colors will be applied
        var influenceRadius = this.sceneRadius;  // Adjust this value to change how localized the effect is

        // Define sunrise/sunset gradient colors
        var sunriseColors = [
            new THREE.Color(0xff4500),  // Red
            new THREE.Color(0xffa500),  // Orange
            new THREE.Color(0xffc0cb),  // Pink
            new THREE.Color(0xffdab9),  // Peach/Sunset
            new THREE.Color(0xdda0dd),  // Pale Violet
            new THREE.Color(0xf0e68c)   // Light Yellow/Salmon
        ];

        // Loop through the sky (point cloud)
        for (var i = 0; i < this.sky.length; i++) {
            var pointCloud = this.sky[i];
            var colors = pointCloud.geometry.attributes.color.array;
            var thetaPhiArray = pointCloud.geometry.userData.thetaPhiArray;

            // Loop through all points in the point cloud
            for (var j = 0; j < thetaPhiArray.length; j++) {
                var theta = thetaPhiArray[j].theta;
                var phi = thetaPhiArray[j].phi;

                // Convert theta/phi to Cartesian coordinates
                var pointX = this.sceneRadius * Math.sin(phi) * Math.cos(theta);
                var pointY = this.sceneRadius * Math.sin(phi) * Math.sin(theta);
                var pointZ = this.sceneRadius * Math.cos(phi);

                // Calculate the distance between the sun and the current point
                var distanceToSun = Math.sqrt(
                    Math.pow(pointX - sunX, 2) +
                    Math.pow(pointY - sunY, 2) +
                    Math.pow(pointZ - sunZ, 2)
                );

                // Calculate the angular difference between the sun and the point
                var thetaDifference = Math.abs(theta);
                var phiDifference = Math.abs(phi - Math.atan2(sunY, sunX));  // Adjusted for x-axis/y-axis movement

                // Normalize the differences (wrap around at full circle)
                thetaDifference = Math.min(thetaDifference, this.full_circle - thetaDifference);
                phiDifference = Math.min(phiDifference, Math.PI - phiDifference);

                // Calculate angular distance and intensity based on proximity to the sun
                var angularDistance = thetaDifference + phiDifference;
                var maxAngularDistance = Math.PI;
                var intensity = 1 - (angularDistance / maxAngularDistance);  // Closer to the sun = higher intensity

                // Define base sky colors
                var nightColor = new THREE.Color(0x001a33);  // Dark blue for night sky
                var dayColor = new THREE.Color(0x87ceeb);  // Light blue for day sky
                var middayColor = new THREE.Color(0x87ceeb);  // Bright white for noon

                var blendedColor;
                var horizonMargin = 50

                // **Sun is above the horizon**
                if (this.sun.position.y > 0) {
                    // Apply sunrise/sunset effect if the point is within the sun's influence radius

                    // AND the sun is near the horizon (y-position close to 0)
                    if (distanceToSun < influenceRadius && Math.abs(this.sun.position.y) < horizonMargin) {
                        // The sun is close to the horizon and we're near the sun, apply sunrise/sunset colors
                        var horizonBlendFactor = distanceToSun / influenceRadius;  // Strongest effect near the sun
                        var horizonBlendIndex = Math.floor(horizonBlendFactor * (sunriseColors.length - 1));

                        // Interpolate between two sunrise/sunset colors based on horizon factor
                        var colorStart = sunriseColors[horizonBlendIndex];
                        var colorEnd = sunriseColors[Math.min(horizonBlendIndex + 1, sunriseColors.length - 1)];
                        blendedColor = new THREE.Color().lerpColors(colorStart, colorEnd, horizonBlendFactor * intensity);

                    } else if (Math.abs(this.sun.position.y) < horizonMargin) {
                        // The sun is near the horizon but we're outside the influence radius
                        var sunBlendFactor = Math.abs(sunY / horizonMargin);  // Strongest effect at horizon (y = 0)
                        blendedColor = new THREE.Color().lerpColors(sunriseColors[4], dayColor, sunBlendFactor * intensity);

                    } else {
                        // Daytime sky: Bright white during noon, transitioning to blue
                        blendedColor = new THREE.Color().lerpColors(middayColor, dayColor, intensity);
                    }

                } else {
                    // **Sun is below the horizon (night or early morning)**
                    var nightBlendFactor = Math.max(0, 1 - (Math.abs(sunY / 20)));  // Strongest effect near horizon

                    // Apply night sky colors, blending to sunrise/sunset colors if near the horizon
                    blendedColor = new THREE.Color().lerpColors(nightColor, sunriseColors[0], nightBlendFactor * intensity);
                }

                // Update colors in the buffer
                colors[j * 3] = blendedColor.r;
                colors[j * 3 + 1] = blendedColor.g;
                colors[j * 3 + 2] = blendedColor.b;
            }

            // Ensure the color buffer is updated
            pointCloud.geometry.attributes.color.needsUpdate = true;
        }
    }


    MakeCloud() {
        // Create a group to hold the cloud's spheres
        const cloud = new THREE.Group();

        // Generate a random number of clusters (elongated parts of the cloud)
        const numClusters = randomInRange(7, 11); // Fewer larger cloud parts for a wispy appearance

        for (let i = 0; i < numClusters; i++) {
            // Create a group for each elongated cluster
            const cluster = new THREE.Group();
            
            // Define a random radius for the cluster
            const clusterLength = randomInRange(15, 30); // Elongated in horizontal direction
            const clusterHeight = randomInRange(3, 7); // Thin in the vertical direction
            
            var sphereSmall = this.sceneRadius * .01;
            var sphereLarge = this.sceneRadius * .1
            // Randomize the number of small spheres per cluster
            const numSpheres = randomInRange(10, 19); // More spheres for each elongated cluster

            for (let j = 0; j < numSpheres; j++) {
                // Random radius for smaller spheres within the cluster
                const radius = (j / numSpheres) * randomInRange(sphereSmall, sphereLarge); // Much smaller spheres for a wispy look

                // Create a sphere geometry
                const geometry = new THREE.SphereGeometry(radius, 32, 32);

                // Create a material with white color and lower opacity for a lighter appearance
                const material = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: mapToRange(1 - ((radius - sphereSmall) / (sphereLarge - sphereSmall)), 0.7, 1) // Lower opacity between 0.3 and 0.5
                });

                // Create the mesh (small sphere)
                const sphere = new THREE.Mesh(geometry, material);

                // Position the small spheres more spread out horizontally, but thin vertically
                sphere.position.set(
                    Math.random() * clusterLength - clusterLength / 2, // Wider in x direction
                    randomInRange(clusterHeight - sphereLarge, clusterHeight - sphereLarge - sphereSmall),
                    Math.random() * 5 - 2.5  // Some variation in z direction
                );

                // Add the small sphere to the cluster
                cluster.add(sphere);
            }

            // Position the entire cluster randomly in the cloud space but focus on elongation
            cluster.position.set(
                randomInRange(-this.sceneRadius, this.sceneRadius),  // Spread out horizontally
                randomInRange(100, 1000),  // Some vertical spread
                randomInRange(-this.sceneRadius, this.sceneRadius)   // Spread out in depth for 3D look
            );

            // Add the cluster to the cloud group
            cloud.add(cluster);
        }

        // Return the cloud group, which now contains all the clusters and spheres
        return cloud;
    }  
}

// Array to store each triangle's specific sine wave parameters for rotation
var triangleRotationWaves = new Map();  // Could also use an array if easier

// Initialize each triangle's wave parameters for rotation (frequency, phase)
function initializeTriangleRotationWaves(triangleCount) {
    for (let i = 0; i < triangleCount; i++) {
        triangleRotationWaves.set(i, {
            frequency: Math.random() * 0.1 + 0.05,  // Random frequency for rotation
            phase: Math.random() * Math.PI * 2  // Random initial phase
        });
    }
}

function rotateAroundPoint(v, center, angle) {
    var cosAngle = Math.cos(angle);
    var sinAngle = Math.sin(angle);
    var x = v.x - center.x;
    var z = v.z - center.z;

    // Rotate the vertex around the Y-axis (assuming water is horizontal)
    var rotatedX = cosAngle * x - sinAngle * z;
    var rotatedZ = sinAngle * x + cosAngle * z;

    // Return the rotated vertex position, translating it back to the center point
    return new THREE.Vector3(rotatedX + center.x, v.y, rotatedZ + center.z);
}

var uw = 0
function UndulateWater(sunPositionX, sunPositionY, sunPositionZ) {
    if (uw++ % 5 !== 0) return
    if (uw > 100) uw = 0
    var originalWaterPosition = terrain.water.geometry.attributes.position.array;
    var time = performance.now() * 0.001;  // Time factor for animating the waves
    var waterVertices = terrain.water.geometry.attributes.position.array;
    var sunPosition = new THREE.Vector3(sunPositionX, sunPositionY, sunPositionZ);

    // Define the number of sine waves and their properties
    const numWaves = 9;  // Number of sine waves
    const waveDirections = [];
    const waveFrequencies = [];
    const waveAmplitudes = [];
    
    // Set a base Y offset for stabilization
    const baseY = -5;  // Stabilize around this Y value

    // Generate random directions, frequencies, and smaller amplitudes for each wave
    for (let i = 0; i < numWaves; i++) {
        waveDirections.push(new THREE.Vector3(
            Math.random() * 2 - 1,  // Random X direction
            0,                      // No Y movement in the direction vector
            Math.random() * 2 - 1   // Random Z direction
        ).normalize());  // Normalize to ensure consistent direction

        waveFrequencies.push(randomInRange(0.05, 0.1));  // Random frequency for each wave
        waveAmplitudes.push(randomInRange(0.01, 0.2));  // Subtle random amplitude for each wave
    }

    // Apply waves to the water vertices
    for (let i = 0; i < originalWaterPosition.length; i += 9) {  // Loop over every triangle (3 vertices per triangle)

        var v0 = new THREE.Vector3(originalWaterPosition[i], originalWaterPosition[i + 1], originalWaterPosition[i + 2]);
        var v1 = new THREE.Vector3(originalWaterPosition[i + 3], originalWaterPosition[i + 4], originalWaterPosition[i + 5]);
        var v2 = new THREE.Vector3(originalWaterPosition[i + 6], originalWaterPosition[i + 7], originalWaterPosition[i + 8]);

        // Initialize displacement values
        var displacementV0 = 0;
        var displacementV1 = 0;
        var displacementV2 = 0;

        // Apply all waves to each vertex
        for (let w = 0; w < numWaves; w++) {
            const direction = waveDirections[w];
            const frequency = waveFrequencies[w];
            const amplitude = waveAmplitudes[w];

            // Project the position onto the wave direction
            const waveV0 = v0.dot(direction);
            const waveV1 = v1.dot(direction);
            const waveV2 = v2.dot(direction);

            // Apply sine wave displacement based on the projection
            displacementV0 += Math.sin(waveV0 * frequency + time) * amplitude;
            displacementV1 += Math.sin(waveV1 * frequency + time) * amplitude;
            displacementV2 += Math.sin(waveV2 * frequency + time) * amplitude;
        }

        // Stabilize around baseY and add subtle displacements
        v0.y = baseY + displacementV0;
        v1.y = baseY + displacementV1;
        v2.y = baseY + displacementV2;

        // Update the vertex positions in the waterVertices array
        waterVertices[i] = v0.x; waterVertices[i + 1] = v0.y; waterVertices[i + 2] = v0.z;
        waterVertices[i + 3] = v1.x; waterVertices[i + 4] = v1.y; waterVertices[i + 5] = v1.z;
        waterVertices[i + 6] = v2.x; waterVertices[i + 7] = v2.y; waterVertices[i + 8] = v2.z;
    }

    terrain.water.geometry.attributes.position.needsUpdate = true;  // Ensure the geometry updates
}


class Castle {
    offsetY = 1.5
    elevatorSpeed = 0.2

    constructor(castleBaseCenter) {
        for (var key in VM.map.structures[0]) {
            this[key] = VM.map.structures[0][key]
        }
        this.parts = [];
        this.elevator = []

        var buildingHeight = 300
        var elevatorHeight = 3
        const floorHeight = 4
        const foundationY = house.center.y - (house.foundation.height / 2)
        var floorY = foundationY

        // const foundation = new THREE.Mesh(
        //     new THREE.BoxGeometry(house.width, house.foundation.height, house.depth),
        //         new THREE.MeshStandardMaterial({
        //             map: new THREE.TextureLoader().load("/images/concrete", texture => {
        //                 texture.wrapS = THREE.RepeatWrapping;
        //                 texture.wrapT = THREE.RepeatWrapping;
        //                 texture.repeat.set(11, 11);
        //             }),
        //             side: THREE.DoubleSide
        //         }),
                
        // )
        // foundation.position.set(0, floorY + .1, 0)
        // floorY += floorHeight
        // foundation.frustrumCulled = true
        // this.parts.push(foundation)
        // scene.add(foundation)



        const intensity = .1;
        const light_foundation = new THREE.RectAreaLight( 0xffffff, intensity,  house.width, house.width );
        light_foundation.position.set( 0, 5, 0 );
        light_foundation.lookAt( 0, 0, 0 );
        scene.add( light_foundation )

        
        this.createHarryPotterLampPost(
            boardwalk.center.x - boardwalk.width / 2 + 1, 
            boardwalk.center.y, 
            boardwalk.center.z - boardwalk.depth / 2 + 1
        )
        const boardwalkTexture = new THREE.TextureLoader().load("/images/floor2.jpg", texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(11, 11);
        })
        
        var opts = {}
        opts.map = boardwalkTexture;
        var tilePlane = new THREE.Mesh(
            new THREE.BoxGeometry(boardwalk.width, boardwalk.height, boardwalk.depth),
            new THREE.MeshStandardMaterial(opts)
        );
        tilePlane.receiveShadow = true;
        tilePlane.position.set(boardwalk.center.x, boardwalk.center.y, boardwalk.center.z);
        this.parts.push(tilePlane)
        tilePlane.frustrumCulled = true
        scene.add(tilePlane)

        var dock = {
            width: boardwalk.width * 1.5 + 4, 
            height: boardwalk.height, 
            depth: boardwalk.depth / 2,
            x: (landscape.field.width / 2) + (boardwalk.width / 2) + 1,
            y: -3,
            z: 3
        }
        var dockMesh =  new THREE.Mesh(
            new THREE.BoxGeometry(dock.width, dock.height, dock.depth),
            new THREE.MeshStandardMaterial(opts)
        );
        dockMesh.position.set(dock.x, dock.y, dock.z)
        dockMesh.receiveShadow = true
        dockMesh.castShadow = true
        dockMesh.frustrumCulled = true
        scene.add(dockMesh)
        this.parts.push(dockMesh)

        var dockStepDepth = house.width * .4
        var dockWidth = (landscape.field.width / 2) - (house.width / 2)


        var stepWidth = .3
        var stepHeight = .15
        var stepY = boardwalk.center.y - (stepHeight / 2)
        var stepX = boardwalk.center.x + (boardwalk.width / 2)
        var stepZ = boardwalk.center.z - (boardwalk.depth / 2.5)
        
        var stepCount = Math.abs(boardwalk.center.y - dock.y) / stepHeight
        var turning = false
        for (var i = 0; i < stepCount; i++) {
            var stepGeo = new THREE.BoxGeometry(stepWidth, stepHeight, 2)
            if (i > (stepCount / 2) && turning) {
                stepGeo.rotateY(Math.PI / 2)
            }
            var step = new THREE.Mesh(stepGeo, new THREE.MeshStandardMaterial({
                map: boardwalkTexture,
                side: THREE.DoubleSide
            }))
            step.position.set(stepX, stepY, stepZ)
            
            if (i > (stepCount / 2)) {
                if (!turning) {
                    turning = true
                    var stepTurnPlane = new THREE.Mesh(
                        new THREE.BoxGeometry(2, 0.15, 2),
                        new THREE.MeshStandardMaterial({
                            map: boardwalkTexture,
                            side: THREE.DoubleSide
                        })
                    )
                    stepTurnPlane.position.set(stepX + 1, stepY, stepZ)
                    scene.add(stepTurnPlane)
                    this.parts.push(stepTurnPlane)
                    stepZ += .9
                    stepX += 1
                }
                stepZ += stepHeight
            } else {
                stepX += stepWidth
            }

            stepY -= stepHeight
            scene.add(step)
            this.parts.push(step)
        }

        return
        
        var boxHeight = 5;
        var wallHeight = boxHeight
        var maxWidth = house.width;
        var maxDepth = house.width;

        for (var i = 0; i < 10; i++) {
            var width = i < 5 ? maxWidth : maxWidth
            var depth = i < 5 ? maxDepth : maxDepth

            // Create the main box
            var box = new THREE.Mesh(
                new THREE.BoxGeometry(width, boxHeight, depth),
                new THREE.MeshStandardMaterial({
                    map: new THREE.TextureLoader().load("/images/wall4.jpg"),
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 1
                })
            );
            box.castShadow = true;
            box.receiveShadow = true

            var xPos = randomInRange(-width / 2, width / 2);
            var yPos = (i * wallHeight) + wallHeight / 2
            var zPos = randomInRange(-depth / 2, depth / 2);
            box.position.set(0, yPos, 0);
      

            // Define wall thickness
            var wallThickness = 0.2;
            var windowThickness = 2
            var wallMaterial = new THREE.MeshStandardMaterial({ 
                map: new THREE.TextureLoader().load("/images/wall4.jpg", texture => {
                    texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(11, 11);
                }), side: THREE.DoubleSide 
            });

            // Window variables
            var windowWidth = boxHeight / 4; // Fixed size for smaller windows
            var windowHeight = boxHeight / 4;
            var windowSpacing = windowWidth * 1.5;  // Spacing between windows

            const evaluator = new Evaluator();

            // Front Wall
            var frontWallGeometry = new THREE.BoxGeometry(width, boxHeight, wallThickness);
            var frontWallBrush = new Brush(frontWallGeometry);
            frontWallBrush.position.set(0, yPos, depth / 2);
            frontWallBrush.updateMatrixWorld();

            // Create and subtract multiple windows for front wall
            for (var w = 0; w < 5; w++) {
                var windowGeometry = new THREE.BoxGeometry(windowWidth, windowHeight, windowThickness);
                var windowBrush = new Brush(windowGeometry);
                windowBrush.position.set(
                    -width / 2 + windowWidth, // Avoid edges
                    yPos,
                    depth / 2 + windowThickness / 2 + 0.01
                );
                windowBrush.updateMatrixWorld();
                frontWallBrush = evaluator.evaluate(frontWallBrush, windowBrush, SUBTRACTION); // Subtract the window
            }

            // Convert front wall geometry back to mesh
            var frontMesh = new THREE.Mesh(frontWallBrush.geometry, new THREE.MeshStandardMaterial({
                map: new THREE.TextureLoader().load("/images/wall4.jpg", texture => {
                    texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(11, 11);
                })
            }));
            frontMesh.frustrumCulled = true
            this.parts.push(frontMesh)
            scene.add(frontMesh);

            // Back Wall
            var backWallGeometry = new THREE.BoxGeometry(width, boxHeight, wallThickness);
            var backWallBrush = new Brush(backWallGeometry);
            backWallBrush.position.set(0, yPos, -depth / 2);
            backWallBrush.updateMatrixWorld();

            // Subtract multiple windows from back wall
            for (var w = 0; w < 3; w++) {
                var backWindowGeometry = new THREE.BoxGeometry(windowWidth, windowHeight, windowThickness);
                var backWindowBrush = new Brush(backWindowGeometry);
                backWindowBrush.position.set(
                    width / 2 - windowWidth, 
                    yPos - boxHeight / 4,
                    -depth / 2 - windowThickness / 2 - 0.01
                );
                backWindowBrush.updateMatrixWorld();
                backWallBrush = evaluator.evaluate(backWallBrush, backWindowBrush, SUBTRACTION);
            }

            // Convert back wall geometry back to mesh
            var backMesh = new THREE.Mesh(backWallBrush.geometry, new THREE.MeshStandardMaterial({
                map: new THREE.TextureLoader().load("/images/wall4.jpg", texture => {
                    texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(11, 11);
                })
            }));
            backMesh.frustrumCulled = true
            this.parts.push(backMesh)
            scene.add(backMesh);

            // Left Wall
            var leftWallGeometry = new THREE.BoxGeometry(wallThickness, boxHeight, depth);
            var leftWallBrush = new Brush(leftWallGeometry);
            leftWallBrush.position.set(-width / 2, yPos, 0);
            leftWallBrush.updateMatrixWorld();

            // Subtract multiple windows from left wall
            for (var w = 0; w < 3; w++) {
                var leftWindowGeometry = new THREE.BoxGeometry(windowThickness, windowHeight, windowWidth);
                var leftWindowBrush = new Brush(leftWindowGeometry);
                var lwb_x = -width / 2 - windowThickness / 2 - 0.01
                var lwb_y = yPos + boxHeight / 4
                var lwb_z = -depth / 2 + windowHeight

                leftWindowBrush.position.set(lwb_x, lwb_y, lwb_z);
                leftWindowBrush.updateMatrixWorld();
                leftWallBrush = evaluator.evaluate(leftWallBrush, leftWindowBrush, SUBTRACTION);

                
            }

            // Convert left wall geometry back to mesh
            var leftMesh = new THREE.Mesh(leftWallBrush.geometry, new THREE.MeshStandardMaterial({
                map: new THREE.TextureLoader().load("/images/wall4.jpg", texture => {
                    texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(11, 11);
                })
            }));
            leftMesh.frustrumCulled = true
            this.parts.push(leftMesh)
            scene.add(leftMesh);

            // Right Wall
            var rightWallGeometry = new THREE.BoxGeometry(wallThickness, boxHeight, depth);
            var rightWallBrush = new Brush(rightWallGeometry);
            rightWallBrush.position.set(width / 2, yPos, 0);
            rightWallBrush.updateMatrixWorld();

            // Subtract multiple windows from right wall
            for (var w = 0; w < 3; w++) {
                var rightWindowGeometry = new THREE.BoxGeometry(windowThickness * 3, windowHeight * 2, windowWidth);
                var rightWindowBrush = new Brush(rightWindowGeometry);
                var rwb_x = width / 2 + windowThickness / 2 + 0.01
                var rwb_y = yPos + boxHeight / 4
                var rwb_z = depth / 2 - windowHeight
                rightWindowBrush.position.set(rwb_x, rwb_y, rwb_z);
                rightWindowBrush.updateMatrixWorld();
                rightWallBrush = evaluator.evaluate(rightWallBrush, rightWindowBrush, SUBTRACTION);
                

                // if (i % 2 == 0) {
                //     var lwb_sx = rwb_x
                //     for (var lwb_sy = lwb_y - windowHeight; lwb_sy > 0; lwb_sy -= .2) {
                //         var stepGeo = new THREE.BoxGeometry(.3, .2, .8)
                //         stepGeo.computeVertexNormals()
                //         var stepMat = new THREE.MeshStandardMaterial({
                //             side: THREE.DoubleSide, map: new THREE.TextureLoader().load("/images/floor1111.jpg")
                //         })
                //         var step = new THREE.Mesh(stepGeo, stepMat)
                //         step.castShadow = true
                //         step.receiveShadow = true
                //         step.position.set(lwb_sx, lwb_sy, rwb_z)
                //         lwb_sx += .3
                //         this.parts.push(step)
                //         scene.add(step)
                //     }
                // }
            }

            // Convert right wall geometry back to mesh
            var rightMesh = new THREE.Mesh(rightWallBrush.geometry, new THREE.MeshStandardMaterial({
                map: new THREE.TextureLoader().load("/images/wall4.jpg", texture => {
                    texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(11, 11);
                })
            }));
            rightMesh.frustrumCulled = true
            this.parts.push(rightMesh)
            scene.add(rightMesh);

            // Top and bottom walls remain unchanged
            var topWall = new THREE.Mesh(new THREE.BoxGeometry(width, wallThickness, depth), wallMaterial);
            topWall.position.set(0, yPos + (boxHeight / 2), 0);
            topWall.frustrumCulled = true
            this.parts.push(topWall)
            scene.add(topWall);

            var bottomWall = new THREE.Mesh(new THREE.BoxGeometry(width, wallThickness, depth), new THREE.MeshStandardMaterial({
                side: THREE.DoubleSide,
                map: new THREE.TextureLoader().load("/images/floor19.jpg")
            }));
            bottomWall.position.set(0, yPos - (boxHeight / 3), 0);
            bottomWall.frustrumCulled = true
            this.parts.push(bottomWall)
            scene.add(bottomWall);
        }

               
        var backyardTree = terrain.createTree(29, 0, 21);
        terrain.trees.push(backyardTree);


    }

    createHarryPotterLampPost(x, y, z) {
        const lampHeight = 5;

        // Create the lamp post (a tall cylinder)
        const postGeometry = new THREE.CylinderGeometry(0.1, 0.1, lampHeight, 8);
        const postMaterial = new THREE.MeshStandardMaterial({ color: 'black' });
        const lampPost = new THREE.Mesh(postGeometry, postMaterial);
        lampPost.position.set(x, y + lampHeight / 2, z); // Position it so the base is at the given coordinates
        scene.add(lampPost);

        // Create the top cap of the lamp post (a sphere)
        const capGeometry = new THREE.SphereGeometry(0.2, 8, 8); // Small cap on top of the post
        const capMaterial = new THREE.MeshStandardMaterial({ color: 'black' });
        const lampPostCap = new THREE.Mesh(capGeometry, capMaterial);
        lampPostCap.position.set(x, y + lampHeight, z); // Position at the top of the post
        scene.add(lampPostCap);

        // Add a light to the lamp post
        const pointLight = new THREE.PointLight(0xffa5f0, 10, 10); // Orangish-yellow light
        pointLight.position.set(x, y + lampHeight + 0.5, z); // Slightly above the cap
        scene.add(pointLight);

        // Optionally, add a sphere to represent the light bulb (glowing effect)
        const bulbGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500, emissive: 0xffa500 });
        const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
        bulb.position.set(x, y + lampHeight + 0.5, z);
        scene.add(bulb);

        // Optionally, add shadow to the light
        pointLight.castShadow = true;
    }

    buildElevator() {
        // Elevator floor
        var eFloor = new THREE.Mesh(
            new THREE.BoxGeometry(elevatorWidth, 0.2, elevatorWidth),
            new THREE.MeshStandardMaterial({ color: 'maroon' })
        );
        eFloor.position.set(
            house.width / 2 - elevatorWidth / 2,
            castleBaseCenter.y + this.offsetY,
            house.width / 2 - elevatorWidth / 2
        );
        eFloor.geometry.computeVertexNormals()
        eFloor.floorZero = castleBaseCenter.y + this.offsetY
        eFloor.interval = this.wallHeight * 3
        eFloor.name = "elevator-floor"
        this.elevator.push(eFloor)
        scene.add(eFloor);

        var eCeiling = new THREE.Mesh(
            new THREE.BoxGeometry(elevatorWidth, 0.2, elevatorWidth),
            new THREE.MeshStandardMaterial({ color: 'maroon' })
        );
        eCeiling.position.set(
            house.width / 2 - elevatorWidth / 2, 
            castleBaseCenter.y + elevatorHeight + this.offsetY, 
            house.width / 2 - elevatorWidth / 2
        );
        eCeiling.geometry.computeVertexNormals()
        this.elevator.push(eCeiling)
        scene.add(eCeiling);

        let texture = new THREE.TextureLoader().load('/images/wall12.jpg')

        var elevatorShaftInnerRight = new THREE.Mesh(
            new THREE.BoxGeometry(
                elevatorWidth, buildingHeight, 0.2
            ),
            new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide
            })
        );
        elevatorShaftInnerRight.position.set(
            eFloor.position.x - elevatorWidth / 2, castleBaseCenter.y + buildingHeight / 2 + this.offsetY, eFloor.position.z)
        elevatorShaftInnerRight.rotation.y = Math.PI / 2;
        elevatorShaftInnerRight.geometry.computeVertexNormals()
        scene.add(elevatorShaftInnerRight)


        var elevatorShaftOuterLeft = new THREE.Mesh(
            new THREE.BoxGeometry(
                elevatorWidth, buildingHeight, 0.2  // Segment height for this floor
            ),
            new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0.3,
                depthTest: true,   // Ensure depth testing is enabled
                depthWrite: false,  // Ensure writing to the depth buffer is enabled
                side: THREE.DoubleSide
            })
        );
        elevatorShaftOuterLeft.position.set(
            eFloor.position.x, castleBaseCenter.y + buildingHeight / 2 + this.offsetY, 
            eFloor.position.z + elevatorWidth / 2
        )
        elevatorShaftOuterLeft.geometry.computeVertexNormals()
        scene.add(elevatorShaftOuterLeft)
        // this.parts.push(elevatorShaftOuterLeft)

        var elevatorShaftOuterRight = new THREE.Mesh(
            new THREE.BoxGeometry(
                elevatorWidth, buildingHeight, 0.2  // Segment height for this floor
            ),
            new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0.3,
                depthTest: true,   // Ensure depth testing is enabled
                depthWrite: false,  // Ensure writing to the depth buffer is enabled
                side: THREE.DoubleSide
            })
        );
        elevatorShaftOuterRight.position.set(eFloor.position.x + elevatorWidth / 2, castleBaseCenter.y + buildingHeight / 2 + this.offsetY, eFloor.position.z)
        elevatorShaftOuterRight.rotation.y = Math.PI / 2;
        elevatorShaftOuterRight.geometry.computeVertexNormals();
        scene.add(elevatorShaftOuterRight)
        // this.parts.push(elevatorShaftOuterRight)



        var elevatorShaftInnerLeft;
        for (let i = 1; i <= 13; i++) {
            var elevatorShaftLeft = new THREE.Mesh(
                new THREE.BoxGeometry(
                    elevatorWidth, this.wallHeight * 3, 0.1
                ),
                new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.DoubleSide
                })
            );
            
            var yPosition = buildingHeight + (this.wallHeight * 3 / 2) * i

            var floorYPosition = yPosition - (this.wallHeight * 3) / 2;

            
            elevatorShaftLeft.position.set(
                eFloor.position.x, 
                yPosition,  // Y-position at this level
                eFloor.position.z - elevatorWidth / 2
            );

            // Convert the elevator shaft into a Brush for CSG operations
            const shaftBrush = new Brush(elevatorShaftLeft.geometry);
            shaftBrush.position.set(
                eFloor.position.x, 
                yPosition,  // Y-position at this level
                eFloor.position.z - elevatorWidth / 2
            )
            shaftBrush.updateMatrixWorld();

            // Create the door geometry for the cutout
            const doorGeometry = new THREE.BoxGeometry(1.25, 2, 0.2); // Door size
            const doorBrush = new Brush(doorGeometry);
            doorBrush.position.set(
                eFloor.position.x, 
                floorYPosition + this.offsetY + 1,  // Y-position at this level
                eFloor.position.z - elevatorWidth / 2
            );
            doorBrush.updateMatrixWorld();

            // Subtract the door from the shaft segment (perform CSG subtraction)
            const evaluator = new Evaluator();
            const result = evaluator.evaluate(shaftBrush, doorBrush, SUBTRACTION);

            // Create a mesh from the updated geometry for this shaft segment
            elevatorShaftInnerLeft = new THREE.Mesh(result.geometry, new THREE.MeshStandardMaterial({
                map: texture,
                transparent: false,
                side: THREE.DoubleSide
            }));

            // Add to scene and store the shaft segment
            elevatorShaftInnerLeft.receiveShadow = true;
            elevatorShaftInnerLeft.castShadow = true;
            elevatorShaftInnerLeft.geometry.computeVertexNormals();
            scene.add(elevatorShaftInnerLeft);
            // this.parts.push(elevatorShaftInnerLeft);



            // ----------- Add Button Plate to Each Shaft -----------
            var buttonPlate = new THREE.Mesh(
                new THREE.PlaneGeometry(0.3, 0.3),
                new THREE.MeshStandardMaterial({
                    color: 'gold',
                    metalness: 1,
                    side: THREE.DoubleSide
                })
            );

            // Position the button plate on the right side of the door (outside the shaft)
            // Adjust the position of the plate relative to the door and shaft
            buttonPlate.position.set(
                eFloor.position.x - 1, 
                floorYPosition + this.offsetY + 1,  // Y-position at this level
                eFloor.position.z - elevatorWidth / 2 - .12
            );
            buttonPlate.geometry.computeVertexNormals();
            
            // buttonPlate.rotation.y = Math.PI / 2;  // Rotate to face correctly

            // this.parts.push(buttonPlate);  // Add to elevator array
            scene.add(buttonPlate);  // Add to scene

            var button = new THREE.Mesh(
                new THREE.CircleGeometry(.025, 20, 20),
                new THREE.MeshStandardMaterial({
                    color: 'gray',
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide
                })
            );
            button.geometry.computeVertexNormals();
            button.name = 'elevator-call-button';
            button.floor = i - 1;
            button.position.set(
                eFloor.position.x - 1, 
                floorYPosition + this.offsetY + 1,  // Y-position at this level
                eFloor.position.z - elevatorWidth / 2 - .13
            );
            button.floorZero = plateCenterY - plateHeight / 2 + i * buttonSpacing
            // button.rotation.y = Math.PI / 2
            if (!i) {
                activeButtonLight.position.copy(button.position);
                scene.add(activeButtonLight)
                button.material.color.set('white')
            }
            scene.add(button);

            var elevatorPointLight = new THREE.PointLight(0xffffff, 3, 5);
            elevatorPointLight.position.set(
                eFloor.position.x - 1, 
                floorYPosition + this.offsetY + 2,  // Y-position at this level
                eFloor.position.z - elevatorWidth / 2 - .3
            )
            scene.add(elevatorPointLight)
            var elevatorLightViz = new THREE.Mesh(
                new THREE.SphereGeometry(.1, 10, 10),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff
                })
            );
            elevatorLightViz.position.copy(elevatorPointLight.position)
            scene.add(elevatorLightViz)
            // this.parts.push(elevatorLightViz)
        }


        // Elevator walls (4 walls)
        
        for (var i = 0; i < 4; i++) {
            var meshOptions = {}
            if (i == 3 || i == 0) {
                meshOptions.transparent = true;
                meshOptions.opacity = 0;
            } else {
                // meshOptions.map = texture;
                // meshOptions.color = 'blue'
                meshOptions.map = new THREE.TextureLoader().load("/images/velvet2.jpg")
                
            } 
            var eWall = new THREE.Mesh(
                new THREE.BoxGeometry(elevatorWidth, elevatorHeight, 0.1),
                new THREE.MeshBasicMaterial(meshOptions)
            );
            
            // Position each wall based on index
            if (i == 0) {
                eWall.position.set(
                    eFloor.position.x, 
                    castleBaseCenter.y + elevatorHeight / 2 + this.offsetY, 
                    eFloor.position.z + elevatorWidth / 2
                ); // Front wall
            }
            if (i == 1) {
                const wallGeometry = new THREE.BoxGeometry(elevatorWidth, elevatorHeight, 0.1);
                const wallBrush = new Brush(wallGeometry);
                wallBrush.position.set(
                    eFloor.position.x, 
                    castleBaseCenter.y + elevatorHeight / 2 + this.offsetY, 
                    eFloor.position.z - elevatorWidth / 2 + .1
                );
                wallBrush.updateMatrixWorld();

                // Create the door as a Brush
                const doorGeometry = new THREE.BoxGeometry(1.25, 2, 0.1); // Door size
                const doorBrush = new Brush(doorGeometry);
                doorBrush.position.set(
                    eFloor.position.x, 
                    castleBaseCenter.y + this.wallHeight / 2, 
                    eFloor.position.z - elevatorWidth / 2 + .1
                );
                doorBrush.updateMatrixWorld();

                // Perform the CSG subtraction to create a door in the wall
                const evaluator = new Evaluator();
                const finalWallGeometry = evaluator.evaluate(wallBrush, doorBrush, SUBTRACTION);

                // Convert the result back into a Mesh
                eWall = new THREE.Mesh(finalWallGeometry.geometry, new THREE.MeshStandardMaterial(meshOptions));
                
                
            }
            if (i == 2) {
                eWall.position.set(
                    eFloor.position.x - elevatorWidth / 2 + .1, 
                    castleBaseCenter.y + elevatorHeight / 2 + this.offsetY, 
                    eFloor.position.z
                ); // Left wall
                eWall.rotation.y = Math.PI / 2; // Rotate left wall by 90 degrees
            }
            if (i == 3) {
                eWall.position.set(
                    eFloor.position.x + elevatorWidth / 2, 
                    castleBaseCenter.y + elevatorHeight / 2 + this.offsetY, 
                    eFloor.position.z
                ); // Right wall
                eWall.rotation.y = Math.PI / 2; // Rotate right wall by 90 degrees
            }

            this.elevator.push(eWall)

            scene.add(eWall);
            // this.parts.push(eWall);
        }

        var buttonPlate = new THREE.Mesh(
            new THREE.PlaneGeometry(.3, .8),
            new THREE.MeshStandardMaterial({
                color: 'gold',
                metalness: 1,
                side: THREE.DoubleSide
            })
        );

        buttonPlate.position.set(eFloor.position.x - elevatorWidth / 2 + .19, castleBaseCenter.y + 2.5, eFloor.position.z)
        buttonPlate.rotation.y = Math.PI / 2;

        this.elevator.push(buttonPlate);
        scene.add(buttonPlate);

        var elevatorPointLight = new THREE.PointLight(0xffffff, 25, 5);
        this.elevator.push(elevatorPointLight)
        elevatorPointLight.position.set(
            house.width / 2 - elevatorWidth / 2, 
            castleBaseCenter.y + elevatorHeight + 1,  // Y position (at ceiling height)
            house.width / 2 - elevatorWidth / 2
        )
        scene.add(elevatorPointLight)
        var elevatorLightViz = new THREE.Mesh(
            new THREE.SphereGeometry(.3, 10, 10),
            new THREE.MeshBasicMaterial({
                color: 0xffffff
            })
        );
        this.elevator.push(elevatorLightViz)
        elevatorLightViz.position.copy(elevatorPointLight.position)
        scene.add(elevatorLightViz)

        var plateHeight = 0.7;
        var buttonSpacing = plateHeight / 12;  // Distance between each button
        var plateCenterY = buttonPlate.position.y;  // Center of the plate along y-axis

        var activeButtonLight = new THREE.PointLight(0xffffff, .05, 5);
        activeButtonLight.name = 'active-button-light'
        this.elevator.push(activeButtonLight)

        for (var i = 0; i < 13; i++) {
            var button = new THREE.Mesh(
                new THREE.CircleGeometry(.025, 20, 20),
                new THREE.MeshStandardMaterial({
                    color: 'gray',
                    transparent: true,
                    opacity: 0.7
                })
            );
            button.name = 'elevator-button';
            button.floor = i;
            button.position.set(
                buttonPlate.position.x + .01,  // x position, you can adjust it if needed
                plateCenterY - plateHeight / 2 + i * buttonSpacing,  // y position, spacing the buttons evenly
                house.width / 2 - elevatorWidth / 2      // z position
            );
            button.floorZero = plateCenterY - plateHeight / 2 + i * buttonSpacing
            button.rotation.y = Math.PI / 2
            if (!i) {
                activeButtonLight.position.copy(button.position);
                scene.add(activeButtonLight)
                button.material.color.set('white')
            }
            this.elevator.push(button)
            scene.add(button);
        }
    }


    buildWalls(wall_instructions = ['decorative wall with cutout windows at 1 - 2 levels of varying sizes','a wall of glass','a castle wall','a mossy wall with circular window cutouts']) {
        var createDecorativeWall = (foundation, width, times = 1, wall_instructions) => {
            // console.log("Building decorative wall...");

            // Define the wall dimensions
            const wallHeight = this.area.wall.height * 3 * times; // Example: 3 floors tall
            const wallWidth = width; // Example wall width
            const wallThickness = 0.3; // Example thickness

            // Create the base wall geometry
            const wallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness);
            const wallBrush = new Brush(wallGeometry);
            wallBrush.position.set(
                this.foundation.position.x,
                this.position.foundation.y + wallHeight / 2,
                this.foundation.position.z
            );
            wallBrush.updateMatrixWorld();

            // Create cutouts for windows at varying heights and sizes
            const evaluator = new Evaluator();
            
            // Create small windows at level 1
            const window1Geometry = new THREE.BoxGeometry(0.5, 0.5, wallThickness + 0.1); // Small square window
            const window1Brush = new Brush(window1Geometry);
            window1Brush.position.set(this.foundation.position.x, this.position.foundation.y + wallHeight / 6, foundation.position.z);
            window1Brush.updateMatrixWorld();
            
            // Create larger windows at level 2
            const window2Geometry = new THREE.BoxGeometry(1, 1, wallThickness + 0.1); // Larger window
            const window2Brush = new Brush(window2Geometry);
            window2Brush.position.set(this.foundation.position.x, this.position.foundation.y + wallHeight / 2, foundation.position.z);
            window2Brush.updateMatrixWorld();

            // Create small circular window at level 3
            const window3Geometry = new THREE.CylinderGeometry(0.3, 0.3, wallThickness + 0.1, 32); // Circular window
            const window3Brush = new Brush(window3Geometry);
            window3Brush.rotation.x = Math.PI / 2; // Rotate cylinder to face forward
            window3Brush.position.set(this.foundation.position.x, this.position.foundation.y + wallHeight * 5 / 6, foundation.position.z);
            window3Brush.updateMatrixWorld();

            // Perform the CSG subtraction to create the windows in the wall
            let finalWallGeometry = evaluator.evaluate(wallBrush, window1Brush, SUBTRACTION);
            finalWallGeometry = evaluator.evaluate(finalWallGeometry, window2Brush, SUBTRACTION);
            finalWallGeometry = evaluator.evaluate(finalWallGeometry, window3Brush, SUBTRACTION);

            let texture = new THREE.TextureLoader().load("/images/wallpaper3.jpg")
            texture.wrapS = THREE.RepeatWrapping; // Repeat horizontally
            texture.wrapT = THREE.RepeatWrapping;
            // Convert the result back into a Mesh
            const decorativeWall = new THREE.Mesh(
                finalWallGeometry.geometry, 
                new THREE.MeshStandardMaterial({ 
                    map: texture,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.63
                }));
            decorativeWall.name = wall_instructions
            // decorativeWall.computeBoundingSphere()
            const positions = finalWallGeometry.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i++) {
                if (isNaN(positions[i])) {
                    // console.log(`NaN found at index ${i}`);
                }
            }

            scene.add(decorativeWall); // Add the wall with cutouts to the scene

            return decorativeWall
        }

        var walls = []

        for (var wi of wall_instructions) {
            
            switch (wi) {
                case 'decorative wall with cutout windows at 1 - 2 levels of varying sizes':
                    var aDecorativeWall = createDecorativeWall(this.foundation, this.area.foundation.width, 1, wall_instructions);
                    aDecorativeWall.position.z += this.area.foundation.depth / 2
                    scene.add(aDecorativeWall)
                    this.parts[aDecorativeWall.name] = aDecorativeWall
                    break;
                case 'a wall of glass':
                    var aDecorativeWall = createDecorativeWall(this.foundation, this.area.foundation.depth, 1, wall_instructions);
                    aDecorativeWall.position.x += this.area.foundation.width / 2
                    aDecorativeWall.rotation.y += Math.PI / 2
                    scene.add(aDecorativeWall)
                    this.parts[aDecorativeWall.name] = aDecorativeWall
                    break;
                case 'a castle wall':
                    var aDecorativeWall = createDecorativeWall(this.foundation, this.area.foundation.width, 1, wall_instructions);
                    aDecorativeWall.position.z -= this.area.foundation.depth / 2
                    aDecorativeWall.rotation.y += -Math.PI 
                    scene.add(aDecorativeWall)
                    this.parts[aDecorativeWall.name] = aDecorativeWall
                    break;
                case 'a mossy wall with circular window cutouts':
                    var aDecorativeWall = createDecorativeWall(this.foundation, this.area.foundation.depth, 1, wall_instructions);
                    aDecorativeWall.position.x -= this.area.foundation.width / 2
                    aDecorativeWall.rotation.y = -Math.PI / 2
                    scene.add(aDecorativeWall)
                    this.parts[aDecorativeWall.name] = aDecorativeWall
                    break;
            }
        }
    }
}

const sphereGeometries = {};
const leafMaterials = {};

function getCachedSphereGeometry(radius, map, transparent) {
    if (!sphereGeometries[radius]) {
        const geometry = new THREE.SphereGeometry(radius, 20, 20);
        
        // Randomize vertex positions for a leaf-like appearance
        if (transparent) {
            for (let i = 0; i < geometry.attributes.position.array.length; i += 3) {
                // Define a random factor to apply different shapes to different parts of the sphere
                let layer = Math.floor(i / (geometry.attributes.position.array.length / 3));
                
                // Position-based variations
                let offsetX = randomInRange(-0.2, 0.2) + layer * randomInRange(-0.05, 0.05);
                let offsetY = randomInRange(-0.4, 0.4) + layer * randomInRange(-0.1, 0.1);
                let offsetZ = randomInRange(-0.2, 0.2) + layer * randomInRange(-0.05, 0.05);

                // Apply offset to create more organic shapes and layers
                geometry.attributes.position.array[i] += offsetX;
                geometry.attributes.position.array[i + 1] += offsetY;
                geometry.attributes.position.array[i + 2] += offsetZ;
            }
            geometry.computeVertexNormals()
            geometry.attributes.position.needsUpdate = true;

        } else {
            for (let i = 0; i < geometry.attributes.position.array.length; i += 3) {
                geometry.attributes.position.array[i] += randomInRange(-0.3, 0.3);
                geometry.attributes.position.array[i + 1] += randomInRange(-0.5, 0.5);
                geometry.attributes.position.array[i + 2] += randomInRange(-0.3, 0.3);
            }
            geometry.computeVertexNormals()
            geometry.attributes.position.needsUpdate = true;
        }
        sphereGeometries[radius] = geometry;
    }
    return sphereGeometries[radius];
}

function getCachedLeafMaterial(color, map, transparent) {
    if (!leafMaterials[color]) {
        var leafMaterialArgs = { 
            // color, 
            side: THREE.DoubleSide,
            color: CYPRESSGREENS[Math.floor(Math.random() * CYPRESSGREENS.length)],
            transparent: true,
            opacity: 1
        }
        if (transparent) {
            leafMaterialArgs.color = CYPRESSGREENS[0]
        }
        leafMaterials[color] = new THREE.MeshStandardMaterial(leafMaterialArgs);
    }
    return leafMaterials[color];
}


const tree = {
        cypress: {
            height: randomInRange(15, 20),
            width: randomInRange(1, 1.9),
            colors: ['#93b449', '#6b881c', '#a9cc4e'], // Cypress leaf colors
            trimmed: Math.random() < 0.5 ? true : false
        }
 };

class Terrain {
    // map
    // Grass
    segments = 79
    visited = { }
    constructor(options) {
        // this.grassTexture = new THREE.TextureLoader().load("/images/nasturtiums1.jpg")
        this.Grass = [
            '#33462d', //
            '#435c3a', //
            '#4e5e3e', //
            '#53634c', //
            '#536c46', //
            '#5d6847', //
        ]
        for (var key in options) {
            this[key] = options[key]
        }
        this.sop = VM.map.sop
        // this.textures =  _textures;
        this.vertices = new Map();
        this.meshes = [];
        this.plants = []
        this.markers = {};
        this.surroundingCenters = [];
        this.currentMesh = 0;
        this.center = new THREE.Vector3(0, 0, 0);


       



        this.go();
    }

    init() {
        this.go();
    }


    static OrangeTreeSinCurve = class extends THREE.Curve { 
        constructor( scale = 1 ) { 
            super(); 
            this.scale = scale; 
        } 
        getPoint( t, optionalTarget = new THREE.Vector3() ) { 
            const tx = t * 3 - 1.5; 
            const ty = Math.sin( 2 * Math.PI * t ); 
            const tz = 0; 
            return optionalTarget.set( tx, ty, tz ).multiplyScalar( this.scale ); 
        } 
    } 

    static RandomizedTrunkCurve = class extends THREE.Curve {
        constructor(x, y, z, segments) {
            super();
            this.points = [];

            // Generate randomized trunk points
            for (let i = 0; i < segments; i++) {
                this.points.push(new THREE.Vector3(
                    x + randomInRange(-0.1, 0.1),
                    y + i * 0.2, // Assuming y should increase with each segment
                    z + randomInRange(-0.1, 0.1)
                ));
            }
        }

        getPoint(t, optionalTarget = new THREE.Vector3()) {
            // Interpolate between the points based on t
            const pointIndex = (this.points.length - 1) * t;
            const index1 = Math.floor(pointIndex);
            const index2 = Math.min(index1 + 1, this.points.length - 1);

            // Get the two points to interpolate between
            const point1 = this.points[index1];
            const point2 = this.points[index2];

            // Linear interpolation
            optionalTarget.lerpVectors(point1, point2, pointIndex - index1);
            
            return optionalTarget;
        }
    }


    createOrangeTree(x, y, z) {
        const segments = randomInRange(10, 15)
        var tree = {
            colors: {
                leaf: ['#beb816','#d7dd87','#8c7414','#7cac0c','#84ac10','#5c8404'],
                orange: ['#fac811','#cc4c04','#f6a712','#fbe816','#872b07']
            },
            trunk: {
                curve: new Terrain.RandomizedTrunkCurve(x, y, z, segments),
                segments, // More segments for smoother trunk
                radius: 0.2
            }
        };

        var trunkGeometry = new THREE.TubeGeometry(
            tree.trunk.curve, 
            tree.trunk.segments, 
            tree.trunk.radius, 
            8, 
            false
        );
        
        // trunkGeometry.setAttribute('color', new THREE.Float32BufferAttribute(trunkColors.flat(), 3));


        var trunkMaterial = new THREE.MeshStandardMaterial({
            // vertexColors: true,
            color: 'green',
            roughness: 0.8,
            metalness: 0.1
        });
        
        var trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);

        return trunkMesh
        // scene.add(trunkMesh)
        
        // Create foliage using randomly positioned spheres
        // var foliageGroup = new THREE.Group();
        // for (var i = 0; i < 50; i++) { // Create 50 leaves
        //     var leafGeometry = new THREE.SphereGeometry(randomInRange(0.1, 0.2), 8, 8);
        //     var leafMaterial = new THREE.MeshStandardMaterial({
        //         color: orange.colors.leaf[Math.floor(Math.random() * orange.colors.leaf.length)]
        //     });
        //     var leafMesh = new THREE.Mesh(leafGeometry, leafMaterial);
        //     leafMesh.position.set(
        //         x + randomInRange(-1, 1),
        //         y + orange.height - randomInRange(0, 1),
        //         z + randomInRange(-1, 1)
        //     );
        //     foliageGroup.add(leafMesh);
        // }

        // // Add oranges
        // for (var i = 0; i < 5; i++) { // Create 5 oranges
        //     var orangeGeometry = new THREE.SphereGeometry(0.2, 12, 12);
        //     var orangeMaterial = new THREE.MeshStandardMaterial({
        //         color: orange.colors.orange[Math.floor(Math.random() * orange.colors.orange.length)]
        //     });
        //     var orangeMesh = new THREE.Mesh(orangeGeometry, orangeMaterial);
        //     orangeMesh.position.set(
        //         x + randomInRange(-0.5, 0.5),
        //         y + orange.height - randomInRange(0.5, 1),
        //         z + randomInRange(-0.5, 0.5)
        //     );
        //     foliageGroup.add(orangeMesh);
        // }

      
    }


    createFlora(x, Y, z, treeKind) {
        const tree = {
            cypress: {
                height: randomInRange(25, 40),
                width: randomInRange(1, 1.9),
                colors: CYPRESSGREENS, // Cypress leaf colors
                trimmed: Math.random() < 0.5 ? true : false,
                branch: {
                    map: CYPRESSBRANCH
                },
                trunk: {
                    map: TRUNKTEXTURE
                }
            }
        };

        const twoPi = Math.PI * 2;
        const colorArray = tree[treeKind].colors;
        const transparent = Math.random() < 0.3

        // Create an instanced mesh for the leaves
        const instanceCount = Math.floor(tree[treeKind].height * 7); // Adjust count as needed
        const instancedMesh = new THREE.InstancedMesh(
            getCachedSphereGeometry(tree[treeKind].width / 2, tree[treeKind].branch.map, transparent),
            getCachedLeafMaterial(colorArray[Math.floor(Math.random() * colorArray.length)], tree[treeKind].branch.map, transparent),
            instanceCount
        );

        // Populate instanced mesh with randomized transformations
        let index = 0;
        for (let y = Y; y < Y + tree[treeKind].height * 2; y  += 1) {
            const progress = (y - Y) / tree[treeKind].height;
            let radiusAtY = (1 - progress) * (tree[treeKind].width / 2) * randomInRange(.83, 2.25);

            if (radiusAtY < 0.5) radiusAtY = 0.5

            for (let p = 0; p < twoPi && index < instanceCount; p += randomInRange(0.6, 1.0)) {
                const matrix = new THREE.Matrix4();
                const randomAngle = randomInRange(-0.4, 0.4);
                const randomHeightAdjustment = randomInRange(-0.3, 0.3);

                const xPos = x + (radiusAtY * Math.cos(p + randomAngle)) + randomInRange(-.75, .75);
                const zPos = z + (radiusAtY * Math.sin(p + randomAngle)) + randomInRange(-.75, .75);
                const yPos = y + randomHeightAdjustment;

                matrix.setPosition(xPos, yPos, zPos);
                matrix.scale(new THREE.Vector3(radiusAtY, radiusAtY, radiusAtY));
                instancedMesh.setMatrixAt(index++, matrix);
            }
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        // scene.add(instancedMesh);

        // Create the trunk
        const trunkGeometry = new THREE.CylinderGeometry(.05, randomInRange(0.1, 0.5), tree[treeKind].height, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ 
            color: CYPRESSGREENS[Math.floor(Math.random() * CYPRESSGREENS.length)],
            map:  TRUNKTEXTURE,
            transparent: false
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, Y, z);
        trunk.branches = []

        // scene.add(trunk);

        return new Terrain.Tree(trunk, instancedMesh)
    }


    go(centerX = 0, centerY = 0, centerZ = 0) {
        console.log("what?")
        const centerKey = `${centerX}_${centerZ}`;
        this.terrainType = 'half'//['sparse', 'dense', 'half'][Math.floor(Math.random() * 3)];        
        this.cliffs = [];
        this.grounds = [];
        this.grassTriangles = [];
        this.cliffMeshes = [];

        let t = VM.map.quadrant;
        let center = { x: centerX, y: centerY, z: centerZ }

        let v0 = { x: center.x - t, y: center.y, z: center.z + t };
        let v1 = { x: center.x + t, y: center.y, z: center.z + t }; 
        let v2 = { x: center.x + t, y: center.y, z: center.z - t }; 
        let v3 = { x: center.x - t, y: center.y, z: center.z - t };

        let vertices = [];
        let indices = [];

        for (var key in VM.map) {
            this[key] = VM.map[key];
        }

        const segmentSize = 1 / this.segments
        // const neighbors = this.meshes.filter(mesh => this.isNeighbor(mesh.centerKey, centerKey));

        // if (neighbors.length > 0) {
        //     var generationRootSlices = this.getRootSlices(centerKey, neighbors);
        //     for (var obj of generationRootSlices) {
        //         this.renderNoiseSlice(obj, this.width, this.height, center); 
        //     }
            
        // }

        let perlinNoise = this.generatePerlinNoise({ center, centerKey });

        var theCove = [];
        var maxX = -Infinity
        var maxZ = -Infinity
        var minX = Infinity
        var minZ = Infinity
        var averageY = []

        for (let i = 0; i <= this.segments; i++) {
            for (let j = 0; j <= this.segments; j++) {
                let x = i * segmentSize;
                let y = j * segmentSize;

                let v = new THREE.Vector3();
                v.x = (1 - x) * (1 - y) * v0.x + x * (1 - y) * v1.x + x * y * v2.x + (1 - x) * y * v3.x;
                v.y = (1 - x) * (1 - y) * v0.y + x * (1 - y) * v1.y + x * y * v2.y + (1 - x) * y * v3.y;
                v.z = (1 - x) * (1 - y) * v0.z + x * (1 - y) * v1.z + x * y * v2.z + (1 - x) * y * v3.z;

                averageY.push(v.y)

                let noiseX = Math.floor(x * (this.noiseWidth - 1));
                let noiseY = Math.floor(y * (this.noiseHeight - 1));
                let variance = perlinNoise[noiseY * this.noiseWidth + noiseX] * this.altitudeVariance;

                v.y += variance;

                var inField = v.x > -landscape.field.width / 2 && v.x < landscape.field.width / 2 && v.z > -landscape.field.depth / 2 && v.z < landscape.field.depth / 2;
                if (inField) {
                    v.y = landscape.field.center.y;  // Flatten the terrain inside the castle
                }

                var inTheCove = v.x >= landscape.field.width / 2 && v.z >= -landscape.field.depth && v.z <= landscape.field.depth / 3;
                if (inTheCove) {


                    if (v.x > maxX) {
                        maxX = v.x
                    }

                    if (v.z > maxZ) {
                        maxZ = v.z
                    }

                    if (v.x < minX) {
                        minX = v.x
                    }

                    if (v.z < minZ) {
                        minZ = v.z
                    }


                    let curveFactor = .1 * Math.cos(Math.random() * Math.PI); // Smooth cosine factor
                    let targetHeight = -20;


                    if (Math.random() < 0.95) {
                        v.y = curveFactor * (v.y - targetHeight) + targetHeight;
                    }

                } else {

                    if (isIn(v, 'sideyard')) {
                        console.log('changing', v.y, house.center.y)
                        v.y = house.center.y
                    }
                }

                
                // terrain vertices
                vertices.push(v.x, v.y, v.z);
            }
        }

        var theCove = [];
        var theCoveIndices = [];  // For storing triangle theCoveIndices

        minZ -= 1000
        maxZ += 1000
        minX -= 1000
        maxX += 1000

        var xStep = (maxX - minX) / this.segments;
        var zStep = (maxZ - minZ) / this.segments;


        for (let i = 0; i <= this.segments; i++) {
            for (let j = 0; j <= this.segments; j++) {
                let x = minX + i * xStep;
                let z = minZ + j * zStep;
                let y = -5;  // Random Y for variation

                // Store each vertex position
                theCove.push(x, y, z);

                // Create two triangles for each square of the grid (except the last row/column)
                if (i < this.segments && j < this.segments) {
                    let topLeft = i * (this.segments + 1) + j;
                    let topRight = (i + 1) * (this.segments + 1) + j;
                    let bottomLeft = i * (this.segments + 1) + (j + 1);
                    let bottomRight = (i + 1) * (this.segments + 1) + (j + 1);

                    // Push two triangles for this square (top left, bottom left, bottom right)
                    theCoveIndices.push(topLeft, bottomLeft, bottomRight);  // First triangle
                    theCoveIndices.push(topLeft, bottomRight, topRight);    // Second triangle
                }
            }
        }


        // Create geometry and assign the vertices and theCoveIndices
        var theCovesGeometry = new THREE.BufferGeometry();
        theCovesGeometry.setAttribute(
            'position', 
            new THREE.Float32BufferAttribute(new Float32Array(theCove), 3)
        );

        // Set theCoveIndices to connect vertices and form triangles
        theCovesGeometry.setIndex(theCoveIndices);
        theCovesGeometry.computeVertexNormals();  // Ensure proper lighting/shading

        // Create material (water-like material)
        var waterMaterial = new THREE.MeshStandardMaterial({
            color: 'royalblue',
            map: new THREE.TextureLoader().load("/images/art-water.gif"),
            side: THREE.DoubleSide,
            opacity: 0.9,
            transparent: true
        });

        // Create the mesh
        var TheCove = new THREE.Mesh(theCovesGeometry, waterMaterial);

        // Add to scene
        scene.add(TheCove);


        // Store reference to the water mesh
        console.log("adding water")
        this.water = TheCove;



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


        var grassPatches = new Array(this.segments + 1).fill().map(() => new Array(this.segments + 1).fill(false));
        
        
        switch (this.terrainType) {
            case 'dense':
                for (let i = 0; i < this.segments; i++) {
                    for (let j = 0; j < this.segments; j++) {
                        grassPatches[i][j] = Math.random() < 0.9
                    }
                }
                break;
            case 'sparse':
                for (let i = 0; i < this.segments; i++) {
                    for (let j = 0; j < this.segments; j++) {
                        grassPatches[i][j] = Math.random() < 0.09
                    }
                }
                break;
            case 'half':
                for (let i = 0; i < this.segments; i++) {
                    for (let j = 0; j < this.segments; j++) {
                        grassPatches[i][j] = Math.random() < 0.5
                    }
                }
                break;                      
        }


        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.segments; j++) {
                let a = i + j * (this.segments + 1);
                let b = (i + 1) + j * (this.segments + 1);
                let c = (i + 1) + (j + 1) * (this.segments + 1);
                let d = i + (j + 1) * (this.segments + 1);
             
                indices.push(a, b, d); // First triangle in the quad
                indices.push(b, c, d); // Second triangle in the quad

                let x = i * segmentSize;
                let y = j * segmentSize;
                let v = new THREE.Vector3();

                v.x = (1 - x) * (1 - y) * v0.x + x * (1 - y) * v1.x + x * y * v2.x + (1 - x) * y * v3.x;
                v.y = (1 - x) * (1 - y) * v0.y + x * (1 - y) * v1.y + x * y * v2.y + (1 - x) * y * v3.y;
                v.z = (1 - x) * (1 - y) * v0.z + x * (1 - y) * v1.z + x * y * v2.z + (1 - x) * y * v3.z;

                var inCastle = (v.x > -house.width / 2 && v.x < house.width / 2 && v.z > -house.depth / 2 && v.z < house.depth / 2)
                var inCove = v.x >= landscape.field.width / 2 && v.z >= -landscape.field.depth && v.z <= landscape.field.depth / 3;
  
                var Txture = cementTexture
                const t1 = TriangleMesh(vertices, a, b, d, this.width, this.height, Txture);
                const t2 = TriangleMesh(vertices, b, c, d, this.width, this.height, Txture);

                [t1, t2].forEach((triangleMesh) => {
                    
                    var trianglePosition = this.getTriangleCenter(triangleMesh.triangle)
                    var triangle = triangleMesh.triangle

                    this.grounds.push(triangleMesh)

                    /* TERRAIN FEATURES */
                    const CLIFF = Math.abs(triangleMesh.normal.y) < 0.4 && (Math.abs(triangleMesh.normal.x) > 0.4 || Math.abs(triangleMesh.normal.z) > 0.4)
                    const SIDEYARD = isIn(trianglePosition, 'sideyard')
                    const BACKYARD = isIn(trianglePosition, 'backyard')
                    let cypressTreePosition
                    if ((SIDEYARD) || (BACKYARD && Math.random() < 0.05)) {
                        for (var tree_partner = 0; tree_partner < 3; tree_partner++) {
                            cypressTreePosition = randomPointOnTriangle(triangle.a, triangle.b, triangle.c)
                            var cypressTree = this.createFlora(cypressTreePosition.x, cypressTreePosition.y, cypressTreePosition.z, 'cypress')
                            this.trees.push(cypressTree)
                        }
                    }

                    else if (BACKYARD) {
                        var treePosition = randomPointOnTriangle(triangle.a, triangle.b, triangle.c)
                        var tree = this.createTree(treePosition.x, treePosition.y, treePosition.z)
                        this.trees.push(tree)
                    }

                    if (BACKYARD) {
                        var pos = randomPointOnTriangle(triangle.a, triangle.b, triangle.c)
                        var lathe = Lathe(trianglePosition.x, trianglePosition.y, trianglePosition.z, CYPRESSGREENS[Math.floor(Math.random() * CYPRESSGREENS.length)])
                        lathe.position.copy(pos)
                        this.grasses.push(
                            lathe
                        )
                    }

                    if (CLIFF) {
                        this.cliffs.push(triangle)
                    }
                    
                })

            }
        }
        
         

            
        // this.createInstancedMeshGrounds()

        this.clusterCliffs()

        
        // Now, let's apply the grass density in groundColorMap to color the vertices
        const colors = [];
        const gridSize = grassPatches.length;  // Assuming groundColorMap is a 2D array of the grid size


        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const density = grassPatches[i][j];
                

                // Ensure that color application and grass application use the same coordinates
                const vertexIndex = i * (this.segments + 1) + j;  // Adjust based on segment count and grid

                colors.push(randomInRange(0.1, 0.3), randomInRange(0.11, 0.15), randomInRange(0, 0.08));  // RGB color for dark brown soil
            }
        }

        console.log("created random colors for the terrain canvas")

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
            // vertexColors: true,  // Enable vertex colors
            map: new THREE.TextureLoader().load("/images/floor112.jpg"),
            side: THREE.DoubleSide,
            wireframe: false,
            transparent: false,
            opacity: 1
        });

        const mesh = new THREE.Mesh(planeGeometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.mesh = mesh;
        this.mesh.name = "terrain"
        this.mesh.noise = perlinNoise;
        this.mesh.centerKey = centerKey;

        scene.add(mesh);

       
        this.meshes.push(this.mesh);




        return this;
    }

    createInstancedMeshGrounds() {
        // create instanced meshes for simple items
        var triangleGeometry = new THREE.BufferGeometry();
        let triangleVertices = new Float32Array([
            0, 0, 0,  // Vertex 1 (relative to the origin)
            1, 0, 0,  // Vertex 2
            0, 1, 0   // Vertex 3
        ]);   
        triangleGeometry.setAttribute('position', new THREE.BufferAttribute(triangleVertices, 3));

          // Step 2: Set up MeshStandardMaterial with vertex colors enabled
        var groundInstancedMeshmaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });

        const instanceCount = this.grounds.length;
        this.groundInstancedMesh = new THREE.InstancedMesh(triangleGeometry, groundInstancedMeshmaterial, instanceCount);
        this.groundInstancedMesh.castShadow = true
        this.groundInstancedMesh.receiveShadow = true      
        this.groundInstancedMesh.material.receiveShadow = true;
        this.groundInstancedMesh.material.castShadow = true;

        // Step 3: For each ground element, update the instance matrix
        for (let i = 0; i < this.grounds.length; i++) {
            const groundTriangle = this.grounds[i];
            const trianglePosition = new THREE.Vector3(
                groundTriangle.center.x,
                groundTriangle.center.y,
                groundTriangle.center.z
            );
            const triangleNormal = groundTriangle.normal;

            // Use an Object3D to easily apply transformations
            const object3d = new THREE.Object3D();

            // Copy and decompose the existing matrix if it exists, or create a new one
            if (groundTriangle.matrix) {
                object3d.matrix.copy(groundTriangle.matrix);
                object3d.matrix.decompose(object3d.position, object3d.rotation, object3d.scale);
            } else {
                throw new Error("A ground triangle is missing a matrix.")
            }

            // Set the new position
            object3d.position.copy(trianglePosition);

            // Apply random rotation around Z-axis
            object3d.rotation.z = Math.random() * Math.PI * 2;

            // Set scale for each instance (adjust as needed)
            object3d.scale.set(2.75, 2.75, 2.75);

            // Align rotation based on triangle normal
            object3d.lookAt(trianglePosition.clone().add(triangleNormal));

            // Update the matrix based on new transformations
            object3d.updateMatrix();

            // Set the updated matrix on the instance
            this.groundInstancedMesh.setMatrixAt(i, object3d.matrix);
        }

        // Step 4: Ensure the instance matrices are updated
        this.groundInstancedMesh.instanceMatrix.needsUpdate = true;

        // Finally, add the instanced mesh to the scene
        scene.add(this.groundInstancedMesh);

    }

    getTriangleNormal(triangle) {
        const v0 = new THREE.Vector3().subVectors(triangle.b, triangle.a);
        const v1 = new THREE.Vector3().subVectors(triangle.c, triangle.a);
        return new THREE.Vector3().crossVectors(v0, v1).normalize();
    }
   
    trianglePosition(v0, v1, v2) {
        // Create a new vector to store the center (centroid) of the triangle
        let center = new THREE.Vector3();

        // Compute the center (centroid) of the triangle
        center.x = (v0.x + v1.x + v2.x) / 3;
        center.y = (v0.y + v1.y + v2.y) / 3;
        center.z = (v0.z + v1.z + v2.z) / 3;

        return center;
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


    generateRollingPerlinNoise() {
        const map = VM.map;
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

    generatePerlinNoise(options) {
        // Get the map for the user's level from the VM (some kind of virtual machine or game state)
        const map = VM.map;

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
        const noise = new Array(VM.map.width * VM.map.height);
        for (let i = 0; i < noise.length; ++i) {
            noise[i] = Math.random();
        }
        return noise;
    }

    generateSmoothNoise(octave, whiteNoise) {
        const map = VM.map;
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
        const width = VM.map.width;
        const height = VM.map.height;
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
    
  
    interpolate(x0, x1, alpha) {
        return x0 * (1 - alpha) + alpha * x1;
    }
    
 
    shareEdge(triangle1, triangle2) {
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

    dfs(index, cluster) {
        this.visited[index] = true;
        cluster.push(this.cliffs[index]);
        for (let i = 0; i < this.cliffs.length; i++) {
            if (!this.visited[i] && this.shareEdge(this.cliffs[index], this.cliffs[i])) {
                this.dfs(i, cluster);
            }
        }
    }

    clusterTriangles(clusterKey, array) {
        const clusters = []
        this.visited[clusterKey] = new Array(array.length).fill(false)
        for (var i = 0; i < array.length; i++) {
            if (!this.visited[clusterKey][i]) {

            }
        }
    }
    clusterCliffs() {
        const clusters = [];

        this.visited.cliffs = new Array(this.cliffs.length).fill(false);
   
        for (let i = 0; i < this.cliffs.length; i++) {
            if (!this.visited.cliffs[i]) {
                const cluster = [];
                this.dfs(i, cluster);
                clusters.push(cluster);
            }
        }

        this.cliffs = []

        console.log("clustering " + clusters.length + " cliffs clusters")

        clusters.forEach(cluster => {
            console.log("this cluster has " + cluster.length + " triangles")
            var cliffGeometry = new THREE.BufferGeometry()
            var points = []
            cluster.forEach(triangle => {
                const index0 = triangle.indices[0];
                const index1 = triangle.indices[1];
                const index2 = triangle.indices[2];

                const a = triangle.a
                const b = triangle.b
                const c = triangle.c

                // // Create geometry for this triangle
                const geometry = new THREE.BufferGeometry();
                const vertices = new Float32Array([
                    a.x, a.y, a.z,
                    b.x, b.y, b.z,
                    c.x, c.y, c.z
                ]);
                points.push(a.x, a.y, a.z,
                    b.x, b.y, b.z,
                    c.x, c.y, c.z)
                const uvs = new Float32Array([
                    0, 0,  // UV for vertex a
                    1, 0,  // UV for vertex b
                    0.5, 1 // UV for vertex c (or adjust to your triangle size)
                ]);


                // Fix: Reverse the order of the cross product to flip the normal
                const edge1 = new THREE.Vector3().subVectors(c, a);  // Use c - a instead of b - a
                const edge2 = new THREE.Vector3().subVectors(b, a);  // Use b - a instead of c - a
                const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();  // Cross product for normal

                // Create the normal array (same normal for all 3 vertices in this flat triangle)
                const normals = new Float32Array([
                    normal.x, normal.y, normal.z,
                    normal.x, normal.y, normal.z,
                    normal.x, normal.y, normal.z
                ]);

                // Set position and normal attributes for the geometry
                geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
                geometry.setAttribute('uvs', new THREE.BufferAttribute(uvs, 3));

                geometry.computeVertexNormals();

                // Load the texture for the cliff triangle
                

                // Create the material with the texture
                const material = new THREE.MeshBasicMaterial({
                    // map: rockwallTexture,
                    color: new THREE.Color(Math.random(), Math.random(), Math.random()),
                    side: THREE.DoubleSide,
                    wireframe: false
                });

                // Create the mesh for the triangle
                const mesh = new THREE.Mesh(geometry, material);
                mesh.receiveShadow = true;
                mesh.castShadow = true;
                mesh.position.y += .2;

                // Store triangle for later use if needed
                mesh.triangle = triangle;

                triangle.normal = normal;

                this.cliffs.push(triangle);

                console.log("creating a cliff cluster!")

                scene.add(mesh);
            });
            // cliffGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3))
            // cliffGeometry.computeVertexNormals()
            // var cliff = new THREE.Mesh(cliffGeometry,
            //     new THREE.MeshBasicMaterial({
            //         color: new THREE.Color(Math.random(), Math.random(), Math.random()),
            //         side: THREE.DoubleSide
            //     })
            // )
            // cliff.position.y += 0.2
            // this.cliffs.push(cliff)
            // scene.add(cliff)
        });
    }




    updateTerrain() {
        var sopCenter = user.camera.position
        // Helper function to determine if a point is within the SOP
        function isInSOP(point, sopCenter, sopRadius) {
            const dx = point.x - sopCenter.x;
            const dy = point.y - sopCenter.y;
            const dz = point.z - sopCenter.z;
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            return distanceSquared <= sopRadius * sopRadius;
        }

        // Remove triangles outside the SOP from the scene

        this.trees.forEach((tree) => {
            // Add or remove tree based on SOP (Screen-oriented projection) center check
            if (tree.trunk.parent && !isInSOP(tree.trunk.position, sopCenter, 100)) {
                scene.remove(tree.trunk);
                scene.remove(tree.foliage);
            } else if (!tree.trunk.parent && isInSOP(tree.trunk.position, sopCenter, 100)) {
                scene.add(tree.trunk);
                scene.add(tree.foliage);
            }
        });


        this.plants.forEach(plant => {
            if (plant.parent && !isInSOP(plant.position.clone(), sopCenter, this.sop.grasses)) {
                scene.remove(plant);
            } else if (!plant.parent && isInSOP(plant.position.clone(), sopCenter, this.sop.grasses)) {
                scene.add(plant);
            }
        })

        this.grounds.forEach(ground => {
            const center = new THREE.Vector3(
                ((ground.triangle.a.x + ground.triangle.a.x + ground.triangle.c.x)/ 3),
                ((ground.triangle.a.y + ground.triangle.a.y + ground.triangle.c.y)/ 3),
                ((ground.triangle.a.z + ground.triangle.a.z + ground.triangle.c.z)/ 3)
            )
            if (ground.parent && center.distanceTo(user.camera.position) > 100) {
                scene.remove(ground);
            } else if (!ground.parent && center.distanceTo(user.camera.position) < 100/*&& isInSOP(center, sopCenter, this.sop.grounds)*/) {
                ground.material.transparent = true
                ground.material.opacity += randomInRange(-0.05, 0.05)
                if (ground.material.opacity > 1) ground.material.opacity = .9
                if (ground.material.opacity < 0) ground.material.opacity = .1
                scene.add(ground);
            }
        })

        // Remove triangles outside the SOP from the scene
        this.grasses.forEach(lathe => {
            const pos = lathe.position.distanceTo(user.camera.position)
            if (lathe.parent && pos > this.sop.grasses) {
                scene.remove(lathe)
            } else if (!lathe.parent && pos < this.sop.grasses) {
                scene.add(lathe)
            } else if (lathe.parent) {
                lathe.rotation.y += 0.01;
                if (lathe.rotation.y > Math.PI * 2) {
                    lathe.rotation.y = 0
                }
                lathe.needsUpdate = true
            }
        });

        
    }

    getTriangleCenter(triangle) {
        const centerX = (triangle.a.x + triangle.b.x + triangle.c.x) / 3;
        const centerY = (triangle.a.y + triangle.b.y + triangle.c.y) / 3;
        const centerZ = (triangle.a.z + triangle.b.z + triangle.c.z) / 3;
        return { x: centerX, y: centerY, z: centerZ };
    }

    static Tree = class {
        constructor(trunk, foliage) {
            this.trunk = trunk; 
            if (foliage) {
                 this.foliage = foliage;  
            }
            this.boundingBox = new THREE.Box3().setFromObject(this.trunk).union(new THREE.Box3().setFromObject(this.foliage));
        }
    }

    createTree(x, y, z, alternate, treeKind) {
        const textureIndex = Math.floor(Math.random() * 7);

        var trunkHeight = randomInRange(3, 25)
        var trunkBaseRadius = randomInRange(.1, .8)
        var rr = alternate ? randomInRange(.01, .1) : randomInRange(.1, .5)
        var trunkCurve = []
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
        // const foliageTexture = this.textures.foliage[Math.floor(Math.random() * 7)];

        // Set how many times the texture should repeat in the U and V directions
        // foliageTexture.wrapS = THREE.RepeatWrapping; // Repeat horizontally
        // foliageTexture.wrapT = THREE.RepeatWrapping; // Repeat vertically

        // Adjust these values to control the repetition frequency
        // foliageTexture.repeat.set(10, 10); // Increase these numbers for more repetitions and smaller texture

        let sphereMaterial = new THREE.MeshStandardMaterial({
            color,
            // map: foliageTexture,
            transparent: false
        });

        // 
        // createFoliageBunch(x, y, z)
        //
        
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.castShadow = true
        sphere.receiveShadow = true
        sphere.position.set(xS, yS + (foliageRadius / 2), zS); // Set foliage position
        sphere.frustrumCulled = true
        sphere.radius = foliageRadius
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
            // map: this.textures.barks[textureIndex],
            color: 'red',
            side: THREE.DoubleSide
        });

        // Create the mesh
        const tubeMesh = new THREE.Mesh(tubeGeometry, material);
        tubeMesh.castShadow = true
        tubeMesh.receiveShadow = true
        tubeMesh.position.y -= 2

        // Add the mesh to the scene
        tubeMesh.frustrumCulled = true
        scene.add(tubeMesh);

        return new Terrain.Tree(tubeMesh, sphere);
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

    createGrassResult(indices, vertices, triangle, bladeCount = 11, bladeHeight = 1, bladeWidth = 0.1) {


        const bladeGeometry = new THREE.PlaneGeometry(bladeWidth, bladeHeight, 1, 4);
        bladeGeometry.computeVertexNormals();
        
        const material = new THREE.MeshStandardMaterial({
            color: ['#93b449', '#6b881c', '#a9cc4e', 'lawngreen'][Math.floor(Math.random() * 4)],
            // color: new THREE.Color(this.Grass[Math.floor(Math.random() * this.Grass.length)]),
            // map: this.grassTexture,
            side: THREE.DoubleSide,
            transparent: false,
            opacity: 1
        });
        

        let instancedMesh = new THREE.InstancedMesh(bladeGeometry, material, bladeCount);
        let bladePositions = [];

        for (let i = 0; i < bladeCount; i++) {
            [instancedMesh, bladePositions] = this.createGrassBlade(instancedMesh, triangle, bladePositions, i);
        }

        instancedMesh.frustrumCulled = true
        // instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        instancedMesh.position.y += bladeHeight / 2

        var ground_triangles = new Triangle(vertices, triangle.a, triangle.b, triangle.c, this.width, this.height)
        var groundMeshGeometry = new THREE.BufferGeometry()
        var ground_points = []
        for (var triangle of ground_triangles) {
            for (var vertex in ground_triangles[triangle]) {
                ground_points.push(vertex.x, vertex.y, vertex.z)
            }
        }
        groundMeshGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ground_points), 3))
        groundMeshGeometry.computeVertexNormals()
        groundMeshGeometry.computeBoundingBox()
        var ground = new THREE.Mesh(groundMeshGeometry, new THREE.MeshStandardMaterial({
            map: new THREE.TextureLoader().load("/images/ground-0.jpg"),
            side: THREE.DoubleSide
        }))
        ground.castShadow = true;
        ground.receiveShadow = true
        return new GrassPatch({
            ground,
            mesh: instancedMesh,
            triangle,
            bladePositions: bladePositions 
        });
    }

    createGrassPatch(indices, vertices, mesh) {
        const grassResult = this.createGrassResult(
            indices, 
            vertices,
            mesh,
            5,
            randomInRange(0.05, 0.2),
            randomInRange(0.1, 0.5)
        );

        // Mark grass on groundColorMap to match patches
        grassResult.bladePositions.forEach((bladePosition) => {
            const closestVertexIndex = this.findClosestVertex(bladePosition, vertices);
            if (closestVertexIndex >= 0 && closestVertexIndex < vertices.length / 3) {
                const x = Math.floor(closestVertexIndex / (this.segments + 1));
                const y = closestVertexIndex % (this.segments + 1);
            }
        });

        return grassResult;
    }

    setCamera(camera) {
        this.camera = camera;
    }
}

class UserController {
    inersections = []
    constructor(terrain) {
        this.terrain = terrain;
        this.isJumping = false;
        this.w = false;
        this.a = false;
        this.s = false;
        this.d = false;
        this._w = false;
        this._a = false;
        this._s = false;
        this._d = false;
        this.wS = .1
        this.aS = .1
        this.sS = .1
        this.dS = .1
        this.tS = .05
        this.mousedown = false
        this.shift = false
        this.space = false;
        this.ArrowUp = false;
        this.ArrowRight = false;
        this.ArrowDown = false;
        this.ArrowLeft = false;
        this.leftShift = false;
        this.rightShift = false;
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.centerKey = null;
        this.cmd = false;
        this.velocity = new THREE.Vector3(); // General velocity
        this.intersectsTerrain = [];
        this.time_held = {
            w: 0,
            a: 0,
            s: 0,
            d: 0
        }
        this.addEventListener();
        this.init();
        this.objects = []
    }

    moveForward() {
        var { _w, _x, _y, _z } = this.camera.quaternion;
        var forward_X = 2 * (_x * _z + _w * _y);
        var forward_Y = 2 * (_y * _z - _w * _x);
        var forward_Z = 1 - 2 * (_x**2 + _y**2);
        
        var distance = -0.21;
        forward_X *= distance;
        forward_Y *= distance;
        forward_Z *= distance;

        this.camera.position.add(new THREE.Vector3(forward_X, forward_Y, forward_Z));
    }

    init() {
        let position = VM.user.position;
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1600);
        this.camera.near = 0.1;  // Increase this value
        this.camera.far = 1000;  // Reduce far plane if it's too large
        this.camera.updateProjectionMatrix();
        this.camera.touches = new Set()
        this.camera.foot = null;
        this.camera.position.set(position.x, position.y + 2, position.z);
        this.camera.velocity = new THREE.Vector3(0, 0, 0);
        this.cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(
            this.camera.position,
            new THREE.Vector3(1, 1, 1) // Adjust size if needed
        );
    }


    addEventListener() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toUpperCase();
            if (key == 'META') {
                this.cmd = true
            }
            if (this.cmd && key == 'S') {
                // localStorage.position = JSON.stringify({ x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z })
                // localStorage.rotation = JSON.stringify({ x: this.camera.rotation.x, y: this.camera.rotation.y, z: this.camera.rotation.z })
            } if (key == 'W') {
                this.w = true;
                this.time_held.w = new Date().getTime();
            } else if (key == 'A') {
                this.a = true;
            } else if (key == 'S') {
                this.s = true;
            } else if (key == 'D') {
                this.d = true;
            } else if (key == ' ') {
                this.isJumping = true;
                this.jumpVelocity = 0.4;
            } else if (key == 'ARROWUP') {
                this.ArrowUp = true;
            } else if (key == 'ARROWDOWN') {
                this.ArrowDown = true;
            } else if (key == 'ARROWLEFT') {
                this.ArrowLeft = true;
            } else if (key == 'ARROWRIGHT') {
                this.ArrowRight = true;
            } else if (key === 'SHIFT') {
                this.run = true
            } else if (key === 'ShiftRight') {
                this.rightShift = true;
            }
        })
        
        window.addEventListener('keyup', (e) => {
            const key = e.key.toUpperCase();
            if (key == 'META') {
                this.cmd = false
            }
            if (key == 'W') {
                user.w = false;
                this.time_held.w = 0;
            } else if (key == 'A') {
                this.a = false;
            } else if (key == 'S') {
                this.s = false;
            } else if (key == 'D') {
                this.d = false;
            } else if (key == ' ') {
                this.space = false;
            } else if (key == 'ARROWUP') {
                this.ArrowUp = false;
            } else if (key == 'ARROWDOWN') {
                this.ArrowDown = false;
            } else if (key == 'ARROWLEFT') {
                this.ArrowLeft = false;
            } else if (key == 'ARROWRIGHT') {
                this.ArrowRight = false;
            } else if (key === 'SHIFT') {
                this.run = false;
            } else if (key === 'ShiftRight') {
                this.rightShift = false;
            }
        });

        var raycaster = new THREE.Raycaster();
        var mouse = new THREE.Vector2();

        window.addEventListener('click', (e) => {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, window.user.camera);

            var intersects = raycaster.intersectObjects(scene.children);

            if (intersects.length > 0) {
                for (var i = 0; i < intersects.length; i++) {
                    switch (intersects[i].object.name) {
                    case 'elevator-call-button':
                    case 'elevator-button':
                        intersects[i].object.material.color.set('white')
                        intersects[i].object.selected = true;
                        var interval = undefined
                        var eFloor = castle.elevator.find(m => m.name == 'elevator-floor');
                        var up = eFloor.interval * intersects[i].object.floor > eFloor.position.y - castle.offsetY;
                        var down = eFloor.interval * intersects[i].object.floor < eFloor.position.y - castle.offsetY;
                        var arrived = false
                        var targetFloor = intersects[i].object.floor
                        var targetHeight = eFloor.interval * targetFloor + castle.offsetY;
                        // console.log(targetFloor, targetHeight);
                        function riseElevator() {
                            if (arrived) return
                            castle.elevator.forEach(m => {
                                if (up) {
                                    m.position.y += castle.elevatorSpeed
                                } else if (down) {
                                    m.position.y -= castle.elevatorSpeed
                                } else {
                                    return
                                }
                                var current_floor = Math.floor(eFloor.position.y / eFloor.interval)

                                if (m.name == 'elevator-button') {
                                    if (m.floor == current_floor) {
                                        m.material.color.set('white')
                                        m.selected = false
                                        castle.elevator.filter(m => m.name == 'active-button-light').forEach(l => l.position.y = m.position.y)
                                    } else if (!m.selected) {
                                        m.material.color.set('gray')
                                    }
                                } else if (m.name == 'elevator-floor' && (up ? m.position.y >= targetHeight : m.position.y <= targetHeight)) {
                                    m.position.y = targetHeight;
                                    // console.log('reaching targetHeight', m.position.y)
                                    arrived = true
                                }
                            });
                            if (arrived) {
                                clearInterval(interval);
                            }
                        }
                        interval = riseElevator;
                        setInterval(interval, 1)
                        break;
                    default:
                        break;
                    }
                }
            }
        }, false);


        this.yaw = 0;   // Rotation around the Y-axis (left/right)
        this.pitch = 0; // Rotation around the X-axis (up/down)
        this.maxPitch = Math.PI / 2;
        this.previous = { movementX: 0, movementY: 0 }
        this.targetLook = new THREE.Vector3();


        window.addEventListener('mousedown', e => { this.mouseDown = true })
        window.addEventListener('mouseup', e => { this.mouseDown = false })

        // Define the max angle for the arc (in radians)
        const maxAngle = THREE.MathUtils.degToRad(45);  // 45 degrees in radians
        window.addEventListener('mousemove', (event) => {
            const sensitivity = 0.05;  // Adjust sensitivity
            this.yaw -= event.movementX * sensitivity;
            this.pitch -= event.movementY * sensitivity;

            // Clamp the pitch so the camera doesn't flip
            this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));

            const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');  // Yaw-Pitch-Roll
            this.camera.quaternion.setFromEuler(euler);  // Apply the rotation to the camera

            if (this.mouseDown) {
                this.moveForward()
            }
        });


    }

    handleMovement() {
        this.intersections = []
        const now = new Date().getTime();

        if (this.isJumping) {
            this.handleJumping();
        } else {
            this.applyGravity();
        }

        // Movement (while not jumping, or with reduced movement during jumping)
        var combinedMovement = new THREE.Vector3();
        if (this.w || this.a || this.s || this.d) {
            var direction = new THREE.Vector3();
            var right = new THREE.Vector3();
            var forwardMovement = new THREE.Vector3();
            var rightMovement = new THREE.Vector3();
            var combinedMovement = new THREE.Vector3();  // To store the final movement result

            if (this.w && !this._w) {
                this.camera.getWorldDirection(direction);
                direction.y = 0;  // Ignore vertical movement
                direction.normalize();  // Ensure consistent vector length
                forwardMovement.add(direction.multiplyScalar(this.wS + (this.run ? 0.23 : 0)));  // Move forward by this.wS
            }

            if (this.s && !this._s) {
                this.camera.getWorldDirection(direction);
                direction.y = 0;
                direction.normalize();  // Normalize for consistent movement
                forwardMovement.sub(direction.multiplyScalar(this.sS + (this.run ? 0.23 : 0)));  // Move backward by this.sS
            }

            if ((this.a && !this._a)) {
                this.camera.getWorldDirection(direction);
                direction.y = 0;  // Keep movement in the horizontal plane
                right.crossVectors(this.camera.up, direction).normalize();  // Calculate the right vector
                rightMovement.add(right.multiplyScalar(this.aS + (this.run ? 0.23 : 0)));  // Move right
            } 

            if ((this.d && !this._d)) {
                this.camera.getWorldDirection(direction);
                direction.y = 0;  // Keep movement in the horizontal plane
                right.crossVectors(this.camera.up, direction).normalize();  // Calculate the right vector
                rightMovement.sub(right.multiplyScalar(this.dS + (this.run ? 0.23 : 0))); 
            }


            combinedMovement.add(forwardMovement).add(rightMovement);
            this.camera.position.add(combinedMovement);


        }

        // Handle rotation
        if (this.ArrowUp || this.ArrowDown) {
            if (this.ArrowUp) {
                this.camera.rotateX(this.tS);
            }
            if (this.ArrowDown) {
                this.camera.rotateX(-this.tS);
            }
        }

        if (this.ArrowLeft || this.ArrowRight) {
            let quaternionY = new THREE.Quaternion();
            let quaternionX = new THREE.Quaternion();

            if (this.ArrowLeft) {
                quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.tS);
            }

            if (this.ArrowRight) {
                quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.tS);
            }

            this.camera.quaternion.multiplyQuaternions(quaternionY, this.camera.quaternion);
        }

        this.handleCollision()


        // Apply movement after collision handling
        this.camera.position.add(combinedMovement);
     

    }
        

    handleCollision() {
        const cameraBox = new THREE.Box3().setFromCenterAndSize(
            this.camera.position.clone(),
            new THREE.Vector3(.5, 1.2, .2)  // Adjust based on camera size
        );

        const directions = [
            new THREE.Vector3(0, -1, 0),   // Down
            new THREE.Vector3(0, 1, 0),    // Up
            new THREE.Vector3(1, 0, 0),    // Right
            new THREE.Vector3(-1, 0, 0),   // Left
            new THREE.Vector3(0, 0, 1),    // Forward
            new THREE.Vector3(0, 0, -1),   // Backward
        ];


        for (const direction of directions) {
            var dir = direction

            const ray = new THREE.Ray(this.camera.position.clone(), direction.clone().normalize());

            let closestIntersection = null;
            let minDistance = .5;
            let intersectionNormal = null;

            terrain.cliffs.forEach(cliffTriangle => {

                const a = cliffTriangle.a;
                const b = cliffTriangle.b;
                const c = cliffTriangle.c;

                const intersectionPoint = new THREE.Vector3();

                const intersects = ray.intersectTriangle(a, b, c, false, intersectionPoint);

                if (intersects) {
                    const distance = this.camera.position.distanceTo(intersectionPoint);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestIntersection = { normal: cliffTriangle.normal, point: intersects }
                    }
                }
            });

            if (closestIntersection) {
                const cameraToIntersection = new THREE.Vector3().subVectors(closestIntersection.point, this.camera.position);
                const dotProduct = cameraToIntersection.dot(closestIntersection.normal);
                const offset = user.wS * 2;  // Adjust based on your needs

                const normalOffset = closestIntersection.normal.clone().multiplyScalar(offset);

                if (this.floor !== null && normalOffset.y !== 0) normalOffset.y = 0

                this.camera.position.add(normalOffset);

                this.camera.velocity.y = 0;
                this.isJumping = false;

                break;
            }

            const raycaster = new THREE.Raycaster(this.camera.position, dir.normalize());

            const intersectsTrees = raycaster.intersectObjects(this.terrain.trees.flatMap(tree => [tree.trunk, tree.foliage]), true);
            if (intersectsTrees.length > 0 && intersectsTrees[0].distance < 1) {
                console.log("intersecting a tree")
                const responseDirection = this.camera.position.clone().sub(intersectsTrees[0].point).normalize();
                this.camera.position.add(responseDirection.multiplyScalar(1));

                if (direction.equals(new THREE.Vector3(0, -1, 0))) {
                    this.camera.velocity.y = 0;
                    this.camera.position.y = intersectsTrees[0].point.y + 1;
                } else if (direction.equals(new THREE.Vector3(0, 1, 0))) {
                    this.camera.velocity.y = Math.min(this.camera.velocity.y, 0);
                }
            }

            const intersectsCastle = raycaster.intersectObjects(window.castle.parts, true);
            if (intersectsCastle.length > 0 && intersectsCastle.some(i => i.distance < 0.2)) {
                const responseDirection = this.camera.position.clone().sub(intersectsCastle[0].point).normalize();

                if (isVerticalIntersection(intersectsCastle[0].face.normal)) {
                    this.camera.velocity.y = 0;
                    this.camera.position.y = intersectsCastle[0].point.y + 1;
                } else {
                    this.camera.position.add(responseDirection.multiplyScalar(1));
                }
            }


            if (this.isJumping) {
                var closestGround = undefined
            }
        }

    }

    getClosestPointOnBox(box, point) {
        const clampedX = Math.max(box.min.x, Math.min(point.x, box.max.x));
        const clampedY = Math.max(box.min.y, Math.min(point.y, box.max.y));
        const clampedZ = Math.max(box.min.z, Math.min(point.z, box.max.z));

        return new THREE.Vector3(clampedX, clampedY, clampedZ);
    }


    // Handle tree collision
    handleTreeCollision(intersection, direction, responseForce) {
        const responseDirection = this.camera.position.clone().sub(intersection.point).normalize();
        this.camera.position.add(responseDirection.multiplyScalar(responseForce));

        if (direction.equals(new THREE.Vector3(0, -1, 0))) {
            this.camera.velocity.y = 0;
            this.camera.position.y = intersection.point.y + 1;
        } else if (direction.equals(new THREE.Vector3(0, 1, 0))) {
            this.camera.velocity.y = Math.min(this.camera.velocity.y, 0);
        }
    }

    // Handle castle part collision
    handleCastleCollision(intersection, direction, responseForce) {
        const responseDirection = this.camera.position.clone().sub(intersection.point).normalize();

        // If it's a vertical intersection (like standing on a foundation)
        if (isVerticalIntersection(intersection.face.normal)) {
            this.camera.velocity.y = 0;
            this.camera.position.y = intersection.point.y + 1;  // Adjust height for foundation

            // Optionally, you can "stop" here or adjust new terrain logic
            // this.terrain.createNewTerrain(); // Create new terrain logic, if necessary
        } else {
            // Horizontal collision with walls, push the player away
            this.camera.position.add(responseDirection.multiplyScalar(responseForce));
        }
    }

    handleJumping() {
        // Update camera position based on the jump velocity
        this.camera.position.y += this.jumpVelocity;
        this.jumpVelocity += GRAVITY * 0.7; // Simulate gravity by decreasing velocity

        // Cast a ray from the camera downwards to detect the ground
        const downRaycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, -1, 0));
        const downIntersection = this.findClosestIntersection(downRaycaster);

        // Cast a ray upwards to detect ceilings
        const upRaycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, 1, 0));
        const upIntersection = this.findClosestIntersection(upRaycaster);

        // Ground collision detection
        if (downIntersection && downIntersection.distance < 1) {
            this.intersections.push(downIntersection.object)
            // console.log("Camera is above the ground, landing");

            // Adjust the camera position to the surface plus a small offset to simulate landing
            this.camera.position.y = downIntersection.point.y + .6;
            this.floor = this.camera.position.y ;
            this.camera.velocity.y = 0;
            this.isJumping = false;
        } else {
            this.floor = null
        }

        // Ceiling collision detection
        if (upIntersection && upIntersection.distance < .5) {
            this.intersections.push(upIntersection.object)
            // console.log("Camera hit the ceiling");

            // Prevent the camera from going through the ceiling
            this.camera.position.y = upIntersection.point.y - .5; // Adjust based on how close you want to stop
            this.camera.velocity.y = 0;
            this.isJumping = false;

            // Optional: handle additional ceiling collision logic here
        }

        // If neither intersection is detected, continue falling
        if (!downIntersection && !upIntersection) {
            // console.log("No intersection detected, camera still in the air");
        }
    }



    applyGravity() {
        if (this.camera.velocity.y < TERMINAL_VELOCITY) {
            this.camera.velocity.y = TERMINAL_VELOCITY;
        } else {
            this.camera.velocity.y += GRAVITY; 
        }
        this.camera.position.y += this.camera.velocity.y;

        const raycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, -1, 0));
        const intersection = this.findClosestIntersection(raycaster);

        if (intersection && intersection.distance < 1) {
            this.intersections.push(intersection)

            var newY = intersection.point.y + 1

            this.camera.position.y = newY;
            this.floor = intersection.point.y + 1

            this.camera.velocity.y = 0;
            this.isJumping = false;

        } else {
            this.floor = null
        }
        
        // Cast a ray upwards to detect ceilings
        const upRaycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, 1, 0));
        const upIntersection = this.findClosestIntersection(upRaycaster);


        // Ceiling collision detection
        if (upIntersection && upIntersection.distance < .5) {
            // console.log("Camera hit the ceiling");

            // Prevent the camera from going through the ceiling
            this.camera.position.y = upIntersection.point.y - .5; // Adjust based on how close you want to stop
            this.camera.velocity.y = 0;
            this.isJumping = false;

            // Optional: handle additional ceiling collision logic here
        }
    }

    // Helper function to find the closest intersection with terrain
    findClosestIntersection(raycaster) {
        let closestIntersection = null;
        let minDistance = 1;

        for (let m of scene.children) {
            var mesh = m.mesh ? m.mesh : m
            const intersects = raycaster.intersectObject(mesh, true);
            if (intersects.length > 0 && intersects[0].distance < minDistance) {
                closestIntersection = intersects[0];
                minDistance = intersects[0].distance;
            }
        }

        return closestIntersection;
    }
}

function isVerticalIntersection(normal) {
    // If the normal of the intersected object is pointing mostly upward or downward, it's vertical
    return Math.abs(normal.y) > 0.7; // Adjust threshold as necessary
}

class View {
    constructor() {
        window.scene = new THREE.Scene();
        window.renderer = new THREE.WebGLRenderer();
        window.renderer.setSize(window.innerWidth, window.innerHeight);
        window.renderer.shadowMap.enabled = true;
        window.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        window.renderer.domElement.id = "view";
    }

    init() {
        console.log("start")
        document.body.appendChild(window.renderer.domElement);


        // console.log(VM);

        window.terrain = new Terrain(VM);

        console.log("added terrain")

        window.user = new UserController(terrain);

        console.log("added user controller")

        window.sky = new Sky(window.user);

        console.log('added sky')

        window.terrain.setCamera(window.user.camera);


        var castleBaseCenter = new THREE.Vector3(0, 0, 0)

        window.castle = new Castle(castleBaseCenter);

        console.log('added castle')


        
        this.addUser();

        Animate();


    }



    addUser() {
        // Create a wireframe box to visualize the bounding box
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1); // Adjust dimensions as needed
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00, // Wireframe color (green, adjust as needed)
            wireframe: true
        });
        window.wireframeBox = new THREE.Mesh(boxGeometry, wireframeMaterial);


        // Add the wireframe to the scene
        window.scene.add(wireframeBox);

        var mesh = terrain.meshes[0];

        //var [x, y, z] = [mesh.geometry.attributes.position.array[333], mesh.geometry.attributes.position.array[334] + 1, mesh.geometry.attributes.position.array[335]];
        let x, y, z;
        for (var i = 0; i < mesh.geometry.attributes.position.array.length; i += 3) {
            var _x = Math.abs(mesh.geometry.attributes.position.array[i] - 20);
            var _z = Math.abs(mesh.geometry.attributes.position.array[i + 2] - 20);

            if (_x < 2 && _z < 2) {
                x = mesh.geometry.attributes.position.array[i]
                y = mesh.geometry.attributes.position.array[i + 1] + 1
                z = mesh.geometry.attributes.position.array[i + 2]
                break;
            }
        }

        // window.user.camera.position.set(33.953909365281795, 2.610000001490116, 23.053098469337314);
        window.user.camera.position.set(24, landscape.field.center.y + 10, 0)

        window.user.camera.lookAt(sky.sphere.position)

        
        
    }

}

function getCenterOfGeometry(geometry) {
    // Get the position attribute of the geometry (which contains all the vertices)
    const position = geometry.attributes.position;

    // Variables to hold the sum of all x, y, and z values
    let xSum = 0, ySum = 0, zSum = 0;

    // Loop over all the vertices in the geometry
    for (let i = 0; i < position.count; i++) {
        xSum += position.getX(i);
        ySum += position.getY(i);
        zSum += position.getZ(i);
    }

    // Compute the average for x, y, and z to get the center
    const centerX = xSum / position.count;
    const centerY = ySum / position.count;
    const centerZ = zSum / position.count;

    // Return the center point as a Three.js Vector3
    return new THREE.Vector3(centerX, centerY, centerZ);
}





window.VM = new ViewModel();
window.view = new View();




await VM.init("Peter", view);






window.Animate = function() {
        window.requestAnimationFrame(Animate);

        window.sky.update()
        window.terrain.updateTerrain()
        UndulateWater() 
        window.user.handleMovement()
       

        window.renderer.render(window.scene, window.user.camera);




        

}






