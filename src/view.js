import * as THREE from '/lib/Three.module.min.js';
import { GLTFLoader } from '/lib/GLTFLoader.js';
import { CSG } from '/lib/CSG.js';
import { Anima } from '/lib/Anima.js';
import { SUBTRACTION, Brush, Evaluator } from '/lib/three-bvh-csg.js';
import ViewModel from "/src/view-model.js";
import { Reflector } from '/lib/Reflector.js';
import { MeshBVH, acceleratedRaycast } from '/lib/three-mesh-bvh.js';
import {
  generatePerlinNoise,
  generateWhiteNoise
} from '/lib/PerlinNoise.js'

const t = 100
const width = t * 2
const height = t * 2
const depth = t / 2
const GREENS = ['#93b449', '#6b881c', '#a9cc4e', '#4e8b2d', '#3b5e24', '#629441', '#6f9e3e', '#4d7b26', '#86b454'];
const RGBGREENS = [
    [147, 180, 73],
    [107, 136, 28],
    [169, 204, 78],
    [78, 139, 45],
    [59, 94, 36],
    [98, 148, 65],
    [111, 158, 62],
    [77, 123, 38],
    [134, 180, 84]
]


class World {
    segments = t / 2
    segmentSize = 1 / (t / 2)
    grass = []
    heightMap = {}
    startingPoint = new THREE.Vector3()
    constructor(scene) {
        console.log(this.segmentSize)
        this.makeTerrain(0, 0, 0);
    }
    getIJ(x, z) {

        let i = Math.round(x / this.segmentSize);
        let j = Math.round(z / this.segmentSize);
        return { i, j }
    }

    makeTerrain(x, y, z) {
        const perlinNoise = generatePerlinNoise(width, height, {
            octaveCount: 5,
            amplitude: 0.05,
            persistence: 0.1
        });

        const terrainGeometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const uvs = [];
        const colors = [];
        const noiseWidth = t * 2;
        const noiseHeight = t;
        const altitudeVariance = t / 5;
        const v0 = { x: x - t, y: y, z: z + t };
        const v1 = { x: x + t, y: y, z: z + t };
        const v2 = { x: x + t, y: y, z: z - t };
        const v3 = { x: x - t, y: y, z: z - t };

        const minX = Math.floor(Math.min(v0.x, v1.x, v2.x, v3.x));
        const maxX = Math.ceil(Math.max(v0.x, v1.x, v2.x, v3.x));
        const minZ = Math.floor(Math.min(v0.z, v1.z, v2.z, v3.z));
        const maxZ = Math.ceil(Math.max(v0.z, v1.z, v2.z, v3.z));

        for (let xKey = minX; xKey <= maxX; xKey++) {
            this.heightMap[xKey] = this.heightMap[xKey] || {};
            for (let zKey = minZ; zKey <= maxZ; zKey++) {
                // Map xKey and zKey to ratios in the range [0, 1] to sample Perlin noise
                const xRatio = (xKey - minX) / (maxX - minX);
                const zRatio = (zKey - minZ) / (maxZ - minZ);

                // Calculate Perlin noise indices
                const noiseX = Math.floor(xRatio * (noiseWidth - 1));
                const noiseY = Math.floor(zRatio * (noiseHeight - 1));
                const noiseIndex = noiseY * noiseWidth + noiseX;

                // Sample altitude and apply variance
                const variance = perlinNoise[noiseIndex] * altitudeVariance;
                const yValue = y + variance;

                // Populate heightMap with precision 1
                this.heightMap[xKey][zKey] = yValue;

                // Create vertex and color for rendering
                vertices.push(xKey, yValue, zKey);
                uvs.push(xRatio, zRatio);
                const color = RGBGREENS[Math.floor(Math.random() * RGBGREENS.length)];
                colors.push(color[0] / 255, color[1] / 255, color[2] / 255);

                if (Math.random() < 0.007 && !this.startingPoint) {
                    this.startingPoint = new THREE.Vector3(v.x, v.y + 10, v.z)
                }
            }
        }

        // Populate indices for rendering the terrain as triangles
        for (let i = 0; i < maxX - minX; i++) {
            for (let j = 0; j < maxZ - minZ; j++) {
                const a = i * (maxZ - minZ + 1) + j;
                const b = i * (maxZ - minZ + 1) + (j + 1);
                const c = (i + 1) * (maxZ - minZ + 1) + j;
                const d = (i + 1) * (maxZ - minZ + 1) + (j + 1);

                indices.push(a, b, d);
                indices.push(a, d, c);

                 const vertexPositionsA = [
                    vertices[a * 3], vertices[a * 3 + 1], vertices[a * 3 + 2],
                    vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2],
                    vertices[c * 3], vertices[c * 3 + 1], vertices[c * 3 + 2]
                ];

                const vertexPositionsB = [
                    vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2],
                    vertices[c * 3], vertices[c * 3 + 1], vertices[c * 3 + 2],
                    vertices[d * 3], vertices[d * 3 + 1], vertices[d * 3 + 2]
                ];

                var triangleA = new THREE.Triangle(
                    new THREE.Vector3(vertexPositionsA[0], vertexPositionsA[1], vertexPositionsA[2]),
                    new THREE.Vector3(vertexPositionsA[3], vertexPositionsA[4], vertexPositionsA[5]),
                    new THREE.Vector3(vertexPositionsA[6], vertexPositionsA[7], vertexPositionsA[8])
                );

                var triangleB = new THREE.Triangle(
                    new THREE.Vector3(vertexPositionsB[0], vertexPositionsB[1], vertexPositionsB[2]),
                    new THREE.Vector3(vertexPositionsB[3], vertexPositionsB[4], vertexPositionsB[5]),
                    new THREE.Vector3(vertexPositionsB[6], vertexPositionsB[7], vertexPositionsB[8])
                );


                this.makeBladesOfGrass(triangleA)
                this.makeBladesOfGrass(triangleB)
            }
        }

        terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        terrainGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        terrainGeometry.setIndex(indices);
        terrainGeometry.computeVertexNormals();

        const terrain = new THREE.Mesh(terrainGeometry, new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            vertexColors: true
        }));

        terrain.receiveShadow = true;
        terrain.castShadow = true;

        view.scene.add(terrain);

        terrain.bvh = new MeshBVH(terrainGeometry);
        terrainGeometry.boundsTree = terrain.bvh;

        this.terrain = terrain;
    }


    makeBladesOfGrass(triangle) {
        const bladeCount = 11

        const smallBladeGeometry = new THREE.PlaneGeometry(randomInRange(0.02, 0.03), randomInRange(0.4, 0.6));
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(...RGBGREENS[Math.floor(Math.random() * RGBGREENS.length)].map(rgb => rgb / 255 * 1.5)),
            side: THREE.DoubleSide
        });

        const bladesOfGrass = new THREE.InstancedMesh(smallBladeGeometry, bladeMaterial, bladeCount * 5);
        bladesOfGrass.receiveShadow = true;

        const triangleNormal = new THREE.Vector3();
        triangle.getNormal(triangleNormal);
        const normalQuaternion = new THREE.Quaternion();
        normalQuaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), triangleNormal);

        for (let i = 0; i < bladeCount; i++) {
            const bladePosition = randomPointOnTriangle(triangle.a, triangle.b, triangle.c);
            const basePosition = new THREE.Vector3(bladePosition.x, bladePosition.y, bladePosition.z);
            const baseRotation = new THREE.Quaternion();
            const randomYRotation = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(
                    randomInRange(0, 0.17),               // random rotation around x-axis
                    Math.random() * Math.PI * 2,          // random rotation around y-axis
                    randomInRange(0, 0.17)                // random rotation around z-axis
                )
            );

            baseRotation.multiplyQuaternions(normalQuaternion, randomYRotation);

            const spacing = 0.02;
            const angleOffset = 0.1; 

            for (let j = 0; j < 5; j++) {
                const matrix = new THREE.Matrix4();

                const offsetPosition = basePosition.clone().add(new THREE.Vector3((j - 2) * spacing, 0, 0));

                const individualRotation = baseRotation.clone();
                individualRotation.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, (j - 2) * angleOffset)));

                matrix.compose(offsetPosition, individualRotation, new THREE.Vector3(1, 1, 1));

                bladesOfGrass.setMatrixAt(i * 5 + j, matrix);
            }
            bladesOfGrass.userData[`blade_${i}`] = {
                originRotation: baseRotation.clone()
            };
        }

        bladesOfGrass.instanceMatrix.needsUpdate = true;

        bladesOfGrass.triangle = triangle;

        this.grass.push(bladesOfGrass);
    }

    update() {
        for (var i = 0; i < this.grass.length; i++) {
            const centerX = (this.grass[i].triangle.a.x + this.grass[i].triangle.b.x + this.grass[i].triangle.c.x) / 3;
            const centerY = (this.grass[i].triangle.a.y + this.grass[i].triangle.b.y + this.grass[i].triangle.c.y) / 3;
            const centerZ = (this.grass[i].triangle.a.z + this.grass[i].triangle.b.z + this.grass[i].triangle.c.z) / 3;
            const pos = new THREE.Vector3(centerX, centerY, centerZ)
            if (user.camera.position.distanceTo(pos) < t / 5) {
                view.scene.add(this.grass[i])
            } else if (this.grass[i].parent) {
                view.scene.remove(this.grass[i])
            }
        }
    }

}

class $ky {
    time = .5
    constructor(user) {
        this.counter = 0;
        this.user = user;
        this.sceneRadius = 500;
        this.full_circle = 2 * Math.PI;

        this.starLight = new THREE.AmbientLight(0xfefeff,  .1); // Sky and ground color
        this.starLight.position.set(0, 0, 0);
        view.scene.add(this.starLight);

        
        this.sun = new THREE.DirectionalLight(0xffffff, 1);
        this.sun.position.set(0, this.sceneRadius, 0);
        view.scene.add(this.sun)
        this.sun.lookAt(0, 0, 0)

        this.sun.castShadow = true; // Enable shadow casting for the light

        // Optionally configure shadow map size for better shadow quality
        this.sun.shadow.mapSize.width = 1024;
        this.sun.shadow.mapSize.height = 1024;

        // Configure the shadow camera for the directional light (this affects shadow casting area)
        this.sun.shadow.camera.near = 0.005;
        this.sun.shadow.camera.far = 9900;
        this.sky = [];
        this.sphere = new THREE.Mesh(
            new THREE.SphereGeometry(11, 30, 30), 
            new THREE.MeshBasicMaterial({ 
                side: THREE.DoubleSide, 
                color: 'white' 
            })
        );
        this.sphere.position.copy(this.sun.position)
        view.scene.add(this.sphere)



        this.createDome();
        // for (var i = 0; i < 29; i++) {
        //     var cloud = this.MakeCloud()
        //     cloud.position.y += randomInRange(50, 250)
        //     cloud.position.x -= randomInRange(-50, 50)
        //     cloud.position.z -= randomInRange(-50, 50)

        //     view.scene.add(cloud)
        // }
    }

    AudioContext(audioUrl) {
        console.log("if this is a static $ky class, then what is this?", this)
        this.audioUrl = audioUrl;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048; // Determines frequency bin resolution
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.source = null;
        this.animationFrameId = null;
        class AudioProcessor {

            async loadAudio() {
                // Fetch and decode audio
                const response = await fetch(this.audioUrl);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

                // Set up the audio buffer source
                this.source = this.audioContext.createBufferSource();
                this.source.buffer = audioBuffer;
                this.source.connect(this.analyser);
                this.analyser.connect(this.audioContext.destination);
            }

            play() {
                if (this.source) {
                    this.source.start();
                    this.animate();
                } else {
                    console.error("Audio source not initialized. Call loadAudio() first.");
                }
            }

            stop() {
                if (this.source) {
                    this.source.stop();
                    cancelAnimationFrame(this.animationFrameId);
                }
            }

            animate() {
                // Set up the next animation frame
                this.animationFrameId = requestAnimationFrame(() => this.animate());

                // Get frequency data
                this.analyser.getByteFrequencyData(this.dataArray);

                // Call the onFrame callback with the dataArray
                if (this.onFrame) this.onFrame(this.dataArray);
            }

            onFrame(callback) {
                // Attach a custom callback for real-time data processing
                this.onFrame = callback;
            }
        }
    }

    createStars(points) {
        var starMaterial = new THREE.PointsMaterial({
            size: randomInRange(.5, 3),
            vertexColors: true,
            transparent: true,
            opacity: 0.1
        })
        var white = {
            r: randomInRange(0.5, 1),
            g: randomInRange(0.5, 1),
            b: randomInRange(0.5, 1)
        }
        var colors = []
        for (var i = 0; i < points.length; i += 3) {
            colors.push(white.r, white.g, white.b)
        }
        var starGeometry = new THREE.BufferGeometry()
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
        starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

        var mesh = new THREE.Points(starGeometry, starMaterial)
        this.stars = mesh
        view.scene.add(mesh)
    }

    createDome() {
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
            transparent: false
        });

        // Loop through to calculate points in spherical coordinates
        var starPoints = []
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
                var horizonFactor = Math.pow(Math.abs(y / radius), 0.3);  // 0 at horizon, 1 at top
                var skyColor = new THREE.Color(0xbde9ff);  // Sky blue color
                var white = new THREE.Color(0xffffff);  // White at horizon
                var color = new THREE.Color().lerpColors(white, skyColor, horizonFactor);  // Interpolate color

                // Add position to points array
                points.push(x, y, z);

                // Add color to the colors array (r, g, b values)
                colors.push(color.r, color.g, color.b);

                // Store theta and phi for use in lighting updates later
                thetaPhiArray.push({ theta: theta, phi: phi });

                if (Math.random() < 0.09) {
                    for (var k = 0; k < 6; k++) {
                        starPoints.push(randomInRange(x - 25, x  + 25), y - 50, randomInRange(z - 25, z + 25))
                    }
                }

                if (z > maxdist) maxdist = z;
            }
        }

        // create them star pairs


        this.createStars(starPoints)

        // Create buffer geometries to hold the positions and colors for the points
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Store the theta and phi for each point inside the geometry
        geometry.userData = { thetaPhiArray: thetaPhiArray };

        // Create the points cloud and add it to the scene
        var pointCloud = new THREE.Points(geometry, pointMaterial);
        this.sky.push(pointCloud);  // Add the point cloud to the sky array for updates
        view.scene.add(pointCloud);  // Add the point cloud to the scene
    }

    update() {
        if (this.time > Math.PI * 2) {
            this.time = 0;
        }

        // Update the sun's position based on time
        var sunX = (this.sceneRadius * 0.95) * Math.cos(this.time);
        var sunY = (this.sceneRadius * 0.95) * Math.sin(this.time);
        var sunZ = 0;
        this.sun.position.set(sunX, sunY, sunZ);
        this.sphere.position.set(sunX, sunY, sunZ);  // Optional visualization of the sun

        // Base colors for each sky state
        const skyDay = new THREE.Color(0xbde9ff);
        const skyDawnDusk = new THREE.Color(0x74c1e8);
        const skyNight = new THREE.Color(0x000000);
        const skyNightHorizon = new THREE.Color(0x001f3f)
        const horizonDay = new THREE.Color(0xffffff);
        const horizonDawnDusk = new THREE.Color(0xffc0cb);

        // 0 for day
        // 1 for dawn/dusk
        // 2 for night
        let transitionFactor = (
            (
                this.time > Math.PI * 2 - Math.PI / 16
                || this.time < Math.PI / 16
            ) ||
            (
                this.time < Math.PI + Math.PI / 16
                && this.time > Math.PI - Math.PI / 16
            )
        ) ? 1 : (
            this.time < Math.PI ? 0 : 2
        )

        if (transitionFactor == 2) {
            this.stars.material.opacity = 1
            this.stars.needsUpdate = true
            this.sun.intensity = 0
            view.scene.add(this.stars)
        } else {
            view.scene.remove(this.stars)
        }


        // Access geometry's color attribute to update individual vertex colors
        const colorAttribute = this.sky[0].geometry.attributes.color;


        for (let i = 0; i < colorAttribute.count; i++) {
            // Retrieve position of each vertex
            let x = this.sky[0].geometry.attributes.position.getX(i);
            let y = this.sky[0].geometry.attributes.position.getY(i);
            let z = this.sky[0].geometry.attributes.position.getZ(i);

            if (transitionFactor == 2) {
                this.sky[0].material.opacity = 0.8
            } else {
                this.sky[0].material.opacity = 1
            }

            let theta = Math.atan2(y, x);
            let sunsetAngle = Math.PI / 8; 
            let edgeFalloff = sunsetAngle * 1.5;
            let skyColor, horizonColor;
            if (transitionFactor === 0) {
                skyColor = new THREE.Color().lerpColors(skyDay, skyDawnDusk, transitionFactor);
                horizonColor = new THREE.Color().lerpColors(horizonDay, horizonDawnDusk, transitionFactor);
            } else if (transitionFactor === 1) {
                skyColor = new THREE.Color().lerpColors(skyDawnDusk, skyNight, transitionFactor - 1);
                horizonColor = new THREE.Color().lerpColors(horizonDawnDusk, skyNight, transitionFactor - 1);
            } else if (transitionFactor === 2) {
                skyColor = new THREE.Color().lerpColors(skyNight, skyNight, transitionFactor - 1);
                horizonColor = new THREE.Color().lerpColors(skyNightHorizon, skyNightHorizon, transitionFactor - 1);
            }

            let horizonFactor = Math.pow(Math.abs(y / this.sceneRadius), 0.5);
            let baseColor = new THREE.Color().lerpColors(horizonColor, skyColor, horizonFactor);
            let thetaOffset = Math.abs(theta) - sunsetAngle;
            let isNearSunsetZone = transitionFactor === 1 && Math.abs(theta) < edgeFalloff;

            let sunsetBlendFactor = isNearSunsetZone
                ? Math.max(0, 1 - (thetaOffset / (edgeFalloff - sunsetAngle)))
                : 0;

            let sunColors = transitionFactor == 1 ? [
                new THREE.Color(0xffc099),  // Soft yellow
                baseColor
            ] : [
                horizonColor,
                skyColor
            ]

            let twilightspan = 300
            let distanceFromCenter = new THREE.Vector3(x, y, z).distanceTo(this.sun.position);
            let distanceFactor = Math.min(distanceFromCenter / twilightspan, 1); // Normalize to range [0, 1]
            let colorIndex = Math.floor(distanceFactor * (sunColors.length - 1));
            let nextColorIndex = Math.min(colorIndex + 1, sunColors.length - 1);
            let blendFactor = distanceFactor * (sunColors.length - 1) - colorIndex;

            let positionFactor = (Math.sin(x * 0.1 + y * 0.1 + z * 0.1) + 1) / 2; 
            let sunEffectColor = new THREE.Color(sunColors[Math.floor(Math.random() * sunColors.length)])
            let vertexColor = new THREE.Color().lerpColors(sunColors[colorIndex], sunColors[nextColorIndex], blendFactor);

            let distanceToSun = new THREE.Vector3(x, y, z).distanceTo(this.sun.position);
            let dist = transitionFactor == 1 ? twilightspan : 80
            vertexColor = distanceToSun < dist
                ? new THREE.Color().lerpColors(transitionFactor == 1 ? vertexColor : baseColor, new THREE.Color(0xffffff), 1 - (distanceToSun / dist))
                : baseColor;

            colorAttribute.setXYZ(i, vertexColor.r, vertexColor.g, vertexColor.b);
        }

        colorAttribute.needsUpdate = true;

        this.time += 0.0001;
    }
}

class User {
    width = 1.5
    height = 5.11
    depth = 1
    aS = .5
    wS = .5
    sS = .5
    dS = .5
    tS = .2
    shift = false
    falling = true
    jumpVelocity = 1
    gravityVelocity = -0.5
    lastKnownPosition = undefined

    constructor() {
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.setupKeyBindings();
    }

    setupKeyBindings() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    handleKeyDown(e) {
        const key = e.key.toUpperCase();
        switch (key) {
            case 'W': this.w = true; break;
            case 'A': this.a = true; break;
            case 'S': this.s = true; break;
            case 'D': this.d = true; break;
            case ' ': this.startJumping(); break;
            case 'SHIFT': this.shift = true; break;
            case 'META': this.meta = true; break;
            case 'ARROWUP': this.ArrowUp = true; break;
            case 'ARROWDOWN': this.ArrowDown = true; break;
            case 'ARROWLEFT': this.ArrowLeft = true; break;
            case 'ARROWRIGHT': this.ArrowRight = true; break;
            default: break;
        }
    }

    handleKeyUp(e) {
        const key = e.key.toUpperCase();
        switch (key) {
            case 'W': this.w = false; break;
            case 'A': this.a = false; break;
            case 'S': this.s = false; break;
            case 'D': this.d = false; break;
            case ' ': this.space = false; break;
            case 'SHIFT': this.shift = false; break;
            case 'META': this.meta = false; break;
            case 'ARROWUP': this.ArrowUp = false; break;
            case 'ARROWDOWN': this.ArrowDown = false; break;
            case 'ARROWLEFT': this.ArrowLeft = false; break;
            case 'ARROWRIGHT': this.ArrowRight = false; break;
            default: break;
        }
    }

    startJumping() {
        this.jumping = true;
        this.jumpVelocity = 1
        this.falling = true;
    }

    handleMovement() {
        this.surround()

        var downMovement = new THREE.Vector3(0, 0, 0)

        // if (this.jumping) {
        //     this.camera.position.y += this.jumpVelocity;
        //     this.jumpVelocity -= 0.05;
        //     console.log(this.jumpVelocity)
        // }

        // if (this.falling) {
        //     downMovement.y = this.gravityVelocity
        // }


        var combinedMovement = new THREE.Vector3();

       if (this.w || this.a || this.s || this.d) {
            // Step size or speed of movement
            const stepSize = 1;

            // Get the direction the user is facing in world space
            let direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);

            // Adjust direction based on key pressed
            if (this.w) {
                // Forward (no change needed)
                direction.multiplyScalar(stepSize);
            } else if (this.s) {
                // Backward
                direction.multiplyScalar(-stepSize);
            } else if (this.a) {
                // Left (rotate 90 degrees counter-clockwise from forward)
                direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).multiplyScalar(stepSize);
            } else if (this.d) {
                // Right (rotate 90 degrees clockwise from forward)
                direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2).multiplyScalar(stepSize);
            }

            // Calculate the new position by adding the scaled direction to the current position
            let newPosition = new THREE.Vector3().copy(this.camera.position).add(direction);

            // Ensure the new position is within the bounds of the height map
            let roundedX = Math.round(newPosition.x);
            let roundedZ = Math.round(newPosition.z);

            // Check if the new position is valid in the heightMap
            if (world.heightMap[roundedX] && world.heightMap[roundedX][roundedZ] !== undefined) {
                // Adjust the new position to the terrain height
                newPosition.y = world.heightMap[roundedX][roundedZ] + user.height / 2;

                // Move the user to the new position
                this.camera.position.set(newPosition.x, newPosition.y, newPosition.z);
            } else {
                console.log("New position is out of bounds or invalid.");
            }
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

        this.camera.position.add(combinedMovement);

        try {
            var xkey = Math.round(this.camera.position.x)
            var zkey = Math.round(this.camera.position.z)
            var y = world.heightMap[xkey][zkey] + user.height / 2
            if (Number.isNaN(y) == false) {
                this.camera.position.y = y
            } else {
                while (Number.isNaN(y)) {
                    xkey++
                    y = world.heightMap[xkey][zkey] + user.height / 2
                }
                this.camera.position.y = y
            }
        } catch {
            
        }
        
    }

    init(scene) {
        // const savedPosition = JSON.parse(sessionStorage.getItem('position') || '{}');
        // const savedRotation = JSON.parse(sessionStorage.getItem('rotation') || '{}');
        
        this.camera.position.copy(world.startingPoint)

        // this.camera.position.set(savedPosition.x || 0, savedPosition.y || 0, savedPosition.z || 0);
        // this.camera.rotation.set(savedRotation.x || 0, savedRotation.y || 0, savedRotation.z || 0);
        
        scene.add(this.camera);

        const gridSize = 1;
        const spacing = .2;
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.1 });
        const gridGroup = new THREE.Group();

        for (let x = -gridSize; x <= gridSize; x += spacing) {
            for (let y = -gridSize; y <= gridSize; y += spacing) {
                const lineZ = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(x, y, -gridSize),
                    new THREE.Vector3(x, y, gridSize)
                ]);
                const lineMeshZ = new THREE.Line(lineZ, lineMaterial);
                gridGroup.add(lineMeshZ);
            }
        }

        for (let x = -gridSize; x <= gridSize; x += spacing) {
            for (let z = -gridSize; z <= gridSize; z += spacing) {
                const lineY = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(x, -gridSize, z),
                    new THREE.Vector3(x, gridSize, z)
                ]);
                const lineMeshY = new THREE.Line(lineY, lineMaterial);
                gridGroup.add(lineMeshY);
            }
        }

        for (let y = -gridSize; y <= gridSize; y += spacing) {
            for (let z = -gridSize; z <= gridSize; z += spacing) {
                const lineX = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(-gridSize, y, z),
                    new THREE.Vector3(gridSize, y, z)
                ]);
                const lineMeshX = new THREE.Line(lineX, lineMaterial);
                gridGroup.add(lineMeshX);
            }
        }

        this.grid = gridGroup
        view.scene.add(this.grid);
    }

    saveCameraState() {
        sessionStorage.setItem('position', JSON.stringify(this.camera.position));
        sessionStorage.setItem('rotation', JSON.stringify(this.camera.rotation));
    }

    surround() {
        this.grid.position.copy(this.camera.position)
        view.renderer.render(view.scene, this.camera);


        if (this.shift && this.camera.position !== this.lastKnownPosition) {
            this.lastKnownPosition = new THREE.Vector3(this.camera.position.x, this.camera.position.y, this.camera.position.z)
            const cameraBox = new THREE.Mesh(
                new THREE.BoxGeometry(1.5, 5.11, 1),
                new THREE.MeshBasicMaterial({
                    wireframe: false,
                    color: this.falling ? 'red' : 'blue',
                    transparent: true,
                    opacity: 0.5
                })
            );
            cameraBox.position.copy(this.lastKnownPosition)
            view.scene.add(cameraBox)
        }
    }


    handleCollision() {
        const cameraBox = new THREE.Box3().setFromCenterAndSize(
            this.camera.position.clone(),
            new THREE.Vector3(1.5, 5.11, 1)
        );

        const directions = [
            new THREE.Vector3(0, -1, 0),   // Down
            new THREE.Vector3(0, 1, 0),    // Up
            new THREE.Vector3(1, 0, 0),    // Right
            new THREE.Vector3(-1, 0, 0),   // Left
            new THREE.Vector3(0, 0, 1),    // Forward
            new THREE.Vector3(0, 0, -1),   // Backward
        ];

        var hasIntersection = false
        var eyeLevel = this.camera.position.clone()
        eyeLevel.y -= 3
        for (const direction of directions) {
            // Set up raycasting from the camera position in each direction
            const raycaster = new THREE.Raycaster(eyeLevel, direction);

            // Limit the raycast distance to the camera box's diagonal for precise, close-range detection
            const cameraBoxDiagonal = cameraBox.getSize(new THREE.Vector3()).length();
            raycaster.near = 0.01
            raycaster.far = cameraBoxDiagonal;

            // Perform the intersection test with the terrain mesh
            const intersects = raycaster.intersectObject(window.world.terrain, true);

            if (intersects.length > 0) {
                hasIntersection = true
                var intersectionPoint = intersects[0].point;
                const intersectionDistance = intersects[0].distance
                intersectionPoint.y += 3
                if (intersectionDistance < 1.5 && direction.y == 1) {
                    this.camera.position.copy(intersectionPoint)
                    this.falling = false
                }                
                
            }
        }

        if (!hasIntersection) {
            this.falling = true
        }
    }
}

class View {
    constructor() {
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.domElement.id = "view";
        document.body.appendChild(this.renderer.domElement);
        
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    onWindowResize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }
    }

    init(model, user) {
        this.user = user;
        this.camera = user.camera;
        this.user.init(this.scene);
        this.animate();
    }

    animate() {
        user.handleMovement()
        user.handleCollision()
        sky.update()
        world.update()
        this.renderer.render(this.scene, user.camera);
        requestAnimationFrame(this.animate.bind(this));
    }
}

window.VM = new ViewModel();
window.view = new View();
window.world = new World(window.view.scene);
window.user = new User();
window.sky = new $ky(user)

VM.init('peter', function() {
    window.view.init(window.VM, window.user);
});



function randomInRange(from, to, startDistance = 0) {
   const min = Math.min(from, to) + startDistance;
   const max = Math.max(from, to) + startDistance;
   const val = Math.random() * (max - min) + min;
   return val;
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


