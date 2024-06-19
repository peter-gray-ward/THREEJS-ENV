import * as THREE from '/three';

var scene = new THREE.Scene();
var origin = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), new THREE.MeshStandardMaterial({ color: 'turquoise' }));
origin.position.set(0, 0, 0);
scene.add(origin);

var camera = new THREE.PerspectiveCamera(75, (window.innerWidth * 0.75) / window.innerHeight, 0.1, 100000);
scene.add(camera);
camera.floor = 0;
camera.position.set(3, 0.5, 3);
camera.up = new THREE.Vector3(0, 1, 0);
camera.lookAt(new THREE.Vector3(0, 0, 0));

var priorPosition = camera.position.clone();

var axisLength = 100;

var actives = [];

function Intersects(Camera, Triangle) {
    var cameraMinX = Camera.position.x - 0.1;
    var cameraMaxX = Camera.position.x + 0.1;
    var cameraMinY = Camera.position.y - 0.25;
    var cameraMaxY = Camera.position.y + 0.25;
    var cameraMinZ = Camera.position.z - 0.01;
    var cameraMaxZ = Camera.position.z + 0.01;

    function isVertexInBox(vertex) {
        return vertex.x >= cameraMinX && vertex.x <= cameraMaxX &&
               vertex.y >= cameraMinY && vertex.y <= cameraMaxY &&
               vertex.z >= cameraMinZ && vertex.z <= cameraMaxZ;
    }

    function isEdgeIntersectingBox(v1, v2, min, max) {
        var tmin = (min - v1) / (v2 - v1);
        var tmax = (max - v1) / (v2 - v1);

        if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

        if (tmax < 0 || tmin > 1) return false;

        return true;
    }

    function isTriangleIntersectingBox(vertices, min, max) {
        for (var i = 0; i < 3; i++) {
            for (var j = i + 1; j < 3; j++) {
                if (isEdgeIntersectingBox(vertices[i].x, vertices[j].x, cameraMinX, cameraMaxX) &&
                    isEdgeIntersectingBox(vertices[i].y, vertices[j].y, cameraMinY, cameraMaxY) &&
                    isEdgeIntersectingBox(vertices[i].z, vertices[j].z, cameraMinZ, cameraMaxZ)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Check if any of the triangle's vertices are within the camera's bounding box
    var triangleVertices = [Triangle.a, Triangle.b, Triangle.c];
    for (var i = 0; i < triangleVertices.length; i++) {
        if (isVertexInBox(triangleVertices[i])) {
            return true;
        }
    }

    // Check if any of the triangle's edges intersect the camera's bounding box
    if (isTriangleIntersectingBox(triangleVertices, cameraMinX, cameraMaxX) ||
        isTriangleIntersectingBox(triangleVertices, cameraMinY, cameraMaxY) ||
        isTriangleIntersectingBox(triangleVertices, cameraMinZ, cameraMaxZ)) {
        return true;
    }

    // You can add additional logic here to check if the triangle's plane intersects the bounding box

    return false;
}



// Helper function to create a dotted axis line
function createDottedAxis(color, start, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineDashedMaterial({
        color: color,
        dashSize: 2, // size of the dashes
        gapSize: 0.5, // size of the gaps
        linewidth: 5
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances(); // This is necessary for the dashed effect
    scene.add(line);
}

// Create dotted axes with different colors
createDottedAxis('red', new THREE.Vector3(0, 0, 0), new THREE.Vector3(axisLength, 0, 0)); // X-axis
createDottedAxis('yellow', new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, axisLength, 0)); // Y-axis
createDottedAxis('green', new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, axisLength)); // Z-axis



// var _camera_ = new THREE.Mesh(
// 	new THREE.BoxGeometry(.5, 1, 0.2),
// 	new THREE.MeshBasicMaterial({ color: 'red', transparent: true, opacity: 0.5})
// );
// _camera_.position.set(3, 0.5, 3);
// scene.add(_camera_);
var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.75, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = "view";
document.body.appendChild(renderer.domElement);

var al = new THREE.AmbientLight(0xffffce, .03);
al.position.set(0, 0, 0);
scene.add(al);

function xhr(options = { body: {} }) {
	var x = new XMLHttpRequest();
	x.open(options.method, options.url);
	x.addEventListener('load', options.load);
	x.send(JSON.stringify(options.body));
}

const N = 3;
var display = {
	devGridDots: true,
	cyberpunkBoxMemory: false,
	camera: {
		boxType: 'person'
	}
}

function getChildIndex(child) {
    const parent = child.parentNode;
    const childrenArray = Array.from(parent.children);
    return childrenArray.indexOf(child);
}


class User {
	name = "Peter";
	space = "Playground";
	touchedObjects = [];
	addTouchedObject(to) {
		var exists = false
		for (var i = 0; i < this.touchedObjects.length; i++) {
			if (this.touchedObjects[i].name == to.name) {
				exists = true;
				for (var key in to) {
					this.touchedObjects[i][key] = to[key];
				}
				break;
			}
		}
		if (!exists) {
			this.touchedObjects.push(to);
		}
	}
	removeTouchedObject(pto) {
		for (var i = 0; i < this.touchedObjects.length; i++) {
			if (this.touchedObjects[i].name == pto.name) {
				this.touchedObjects.splice(i, 1);
				return;
			}
		}
	}
}



let user = new User();

function BoxHelper(object, boxSize = new THREE.Vector3()) {
	var cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(object.position.clone(), boxSize);

	// Apply rotation to the bounding box
	const matrix = new THREE.Matrix4().makeRotationFromQuaternion(object.quaternion);
	const vertices = [
	    new THREE.Vector3(boxSize.x / 2, boxSize.y / 2, boxSize.z / 2),
	    new THREE.Vector3(-boxSize.x / 2, boxSize.y / 2, boxSize.z / 2),
	    new THREE.Vector3(boxSize.x / 2, -boxSize.y / 2, boxSize.z / 2),
	    new THREE.Vector3(-boxSize.x / 2, -boxSize.y / 2, boxSize.z / 2),
	    new THREE.Vector3(boxSize.x / 2, boxSize.y / 2, -boxSize.z / 2),
	    new THREE.Vector3(-boxSize.x / 2, boxSize.y / 2, -boxSize.z / 2),
	    new THREE.Vector3(boxSize.x / 2, -boxSize.y / 2, -boxSize.z / 2),
	    new THREE.Vector3(-boxSize.x / 2, -boxSize.y / 2, -boxSize.z / 2),
	];

	vertices.forEach(v => v.applyMatrix4(matrix).add(object.position.clone()));

	const rotatedBoundingBox = new THREE.Box3().setFromPoints(vertices);
	// Optionally visualize the bounding box for debugging
	const boxHelper = new THREE.Box3Helper(rotatedBoundingBox, 0xffff00);

	return boxHelper;
}

class Level {
	PhysicalObjects = {}
	sun = undefined;
	floorGroup = new THREE.Group();
}

let level = new Level();

class Page {
	width = window.innerWidth * 0.75;
	height = window.innerHeight;
}

let page = new Page();
let devgrid = {};

class Creator {
	addChild = false;
	activePolygonVerticesIndex = -1;
	polygonVertices = [];
	ConnectTheDotsWithPolygons() {
	    const geometry = new THREE.BufferGeometry();

	    // Create an array for the vertices
	    const vertices = [];

	    // Add vertices to the array
	    this.polygonVertices[this.activePolygonVerticesIndex].forEach(p => {
			add2DText(
				scene, 
				`(${p.x}, ${p.y}, ${p.z})`, 
				0.5, 
				'white', 
				{ x: p.x, y: p.y, z: p.z }, 
				true,
				'transparent'
			);
	        vertices.push(p.x, p.y, p.z);
	    });

	    // Convert the vertices array to a Float32Array
	    const verticesArray = new Float32Array(vertices);

	    // Set the vertices to the BufferGeometry
	    geometry.setAttribute('position', new THREE.BufferAttribute(verticesArray, 3));

	    // Create an array for the indices
	    const indices = [];

	    // Define faces from the vertices (triangulate the this.polygonVertices)
	    // Here we'll assume the this.polygonVertices are ordered and form a convex polygon
	    for (let i = 1; i < this.polygonVertices[this.activePolygonVerticesIndex].length - 1; i++) {
	        indices.push(0, i, i + 1);
	    }

	    // Set the indices to the BufferGeometry
	    geometry.setIndex(indices);

	    // Compute normals for shading
	    geometry.computeVertexNormals();

	    // Create a material for the mesh
	    const material = new THREE.MeshStandardMaterial({ 
	    	color: new THREE.Color(Math.random(), Math.random(), Math.random()), 
	    	side: THREE.DoubleSide 
	    });

	    // Create the mesh
	    const mesh = new THREE.Mesh(geometry, material);
	    scene.add(mesh);

	    mesh.receiveShadow = true;
	    mesh.castShadow = true;
	    mesh.name = "touchable::polygon::" + JSON.stringify(vertices);

		// const itemBoundingBox = new THREE.Box3().setFromObject(mesh);

		// // Create a BoxHelper to visualize the bounding box
		// const boxHelper = new THREE.BoxHelper(mesh, 0xff0000);

		// // Add the BoxHelper to the scene
		// scene.add(boxHelper);


	}

	AddFloor() {}
	AddDoor() {}
	AddWall() {}
	AddWindow() {}
	AddCeiling() {}
	AddStairs() {}

	selectPointGroup(event) {
		

		var src = event.srcElement;
		var activeIndex = this.activePolygonVerticesIndex;

		if (src.parentElement.classList.contains('active')) {
			src.parentElement.classList.remove('active');
			src.id = '';
			this.activePolygonVerticesIndex = null;

			console.log('deactivating point group');
		} else {
			src.parentElement.classList.add('active')
			src.id = 'selected-point-group';
			this.activePolygonVerticesIndex = +src.dataset.id;
			activeIndex = this.activePolygonVerticesIndex

			console.log('activating point group');
		}


		for (var i = 0; i < scene.children.length; i++) {
			if (/^devdot/.test(scene.children[i].name)) {
				for (var j = 0; j < this.polygonVertices[activeIndex].length; j++) {
					const a = this.polygonVertices[activeIndex][j].x == scene.children[i].position.x 
					const b = this.polygonVertices[activeIndex][j].y == scene.children[i].position.y 
					const c = this.polygonVertices[activeIndex][j].z == scene.children[i].position.z
					if (a && b && c) {
						if (this.activePolygonVerticesIndex !== null) {
							scene.children[i].material.color.set('red');
						} else {
							scene.children[i].material.color.set('white');
						}
					}
				}
			}
		}
	} //askdhifaskldhjfs

	update() {
		for (var i = 0; i < this.polygonVertices.length; i++) {
			document.querySelectorAll('.point-group').forEach((pre, i) => {
				pre.innerHTML = JSON.stringify(this.polygonVertices[i], null, 2);
			});
		}



		document.getElementById('touched-objects').innerHTML = user.touchedObjects.map(to => `<div class="row"><div>${to.name}</div><div>${JSON.stringify(to.center, null, 1)}</div><div>${to.cameraFaceTouched}</div></div>`).join('')
		
		// xhr({
		// 	method: 'POST',
		// 	url: `/items?user=${user.name}&space=${user.space}`,
		// 	body: this.polygonVertices
		// });
	}
}


class Controller {
    w = false;
    a = false;
    s = false;
    d = false;
    wS = 0.05;
    aS = 0.05;
    sS = 0.05;
    dS = 0.05;
    space = false;
    ArrowUp = false;
    ArrowRight = false;
    ArrowDown = false;
    ArrowLeft = false;
    isJumping = false;
    velocity = new THREE.Vector3();
    gravity = -0.01;
    jumpStrength = .2;
    mouse = {
    	x: 0,
    	y: 0
    }
    raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector2();
	hoverPlane = null;
	page = 'generate-polygon';
	tabs = ['create-outside', 'generate-polygon', 'apply-images', 'manage-spaces'];
	creator = new Creator();

    constructor() {}
    Self() {
        window.addEventListener('keydown', this.listen.bind(this));
        window.addEventListener('keyup', this.unlisten.bind(this));
        window.addEventListener('click', this.click.bind(this))
    }
    calculateTrajectory(prior, current) {
	    const dx = current.x - prior.x;
	    const dy = current.y - prior.y;

	    let direction = '';

	    if (dy > 0) {
	        direction += 'w';
	    } else if (dy < 0) {
	        direction += 's';
	    }

	    if (dx > 0) {
	        direction += 'd';
	    } else if (dx < 0) {
	        direction += 'a';
	    }

	    return direction || 'idle';
	}

    click(e) {
    	if (this.creator.activePolygonVerticesIndex == -1) return;

    	this.mouse.x = (e.clientX / page.width) * 2 - 1;
		this.mouse.y = - (e.clientY / page.height) * 2 + 1;
		this.raycaster.setFromCamera(this.mouse, camera);

		const intersects = this.raycaster.intersectObjects(scene.children, true);

		
		if (intersects.length > 0) {

			var i = 0;
			var target = intersects[i++];
			while (target && target.object && !target.object.isMesh) target = intersects[i++];

			if (target) {
				target = target.object;
				if (/^devdot/.test(target.name)) {
					if (target.material.color.g == 0) {
						
					} else {
						target.material.color.set('red');
						this.creator.polygonVertices[this.creator.activePolygonVerticesIndex].push({ 
							x: target.position.x, 
							y: target.position.y, 
							z: target.position.z 
						});
					}
				}
				
				this.creator.update();
			}

		}
    }
    listen(e) {
        if (e.key == 'w') {
            this.w = true;
        } else if (e.key == 'a') {
            this.a = true;
        } else if (e.key == 's') {
            this.s = true;
        } else if (e.key == 'd') {
            this.d = true;
        } else if (e.key == ' ') {
            this.space = true;
        } else if (e.key == 'ArrowUp') {
            this.ArrowUp = true;
        } else if (e.key == 'ArrowDown') {
            this.ArrowDown = true;
        } else if (e.key == 'ArrowLeft') {
            this.ArrowLeft = true;
        } else if (e.key == 'ArrowRight') {
            this.ArrowRight = true;
        } else if (e.key == 't') {
        	display.devGridDots = !display.devGridDots;
        	DevGrid(N, display.devGridDots);
        } else if (e.key == 'y') {
        	display.cyberpunkBoxMemory = !display.cyberpunkBoxMemory;
        	//DevGrid(N, display.cyberpunkBoxMemory);
        }
    }
    unlisten(e) {
        if (e.key == 'w') {
            this.w = false;
        } else if (e.key == 'a') {
            this.a = false;
        } else if (e.key == 's') {
            this.s = false;
        } else if (e.key == 'd') {
            this.d = false;
        } else if (e.key == ' ') {
            this.space = false;
        } else if (e.key == 'ArrowUp') {
            this.ArrowUp = false;
        } else if (e.key == 'ArrowDown') {
            this.ArrowDown = false;
        } else if (e.key == 'ArrowLeft') {
            this.ArrowLeft = false;
        } else if (e.key == 'ArrowRight') {
            this.ArrowRight = false;
        }
    }
    activate() {
    	priorPosition = camera.position;
        if (this.w) {
            var direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            direction.multiplyScalar(this.wS);
            camera.position.add(direction);
            // _camera_.position.add(direction);
        }
        if (this.a) {
            var direction = new THREE.Vector3();
            var right = new THREE.Vector3();
            camera.getWorldDirection(direction);
            right.crossVectors(camera.up, direction).normalize();
            right.multiplyScalar(this.aS);
            camera.position.add(right);
            // _camera_.position.add(right);
        }
        if (this.s) {
            var direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            direction.multiplyScalar(-this.sS);
            camera.position.add(direction);
            // _camera_.position.add(direction);
        }
        if (this.d) {
            var direction = new THREE.Vector3();
            var right = new THREE.Vector3();
            camera.getWorldDirection(direction);
            right.crossVectors(camera.up, direction).normalize();
            right.multiplyScalar(-this.dS);
            camera.position.add(right);
            // _camera_.position.add(right);
        }
        if (this.ArrowUp) {
            camera.rotateX(0.1);
            // _camera_.rotateX(0.1);
        }
        if (this.ArrowDown) {
            camera.rotateX(-0.1);
            // _camera_.rotateX(-0.1);
        }
        if (this.ArrowLeft || this.ArrowRight) {
            let quaternionY = new THREE.Quaternion();
	        let quaternionX = new THREE.Quaternion();

	        // Yaw rotation - Turning left or right
	        if (this.ArrowLeft) {
	            quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.1);
	        }

	        if (this.ArrowRight) {
	            quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.1);
	        }

	        camera.quaternion.multiplyQuaternions(quaternionY, camera.quaternion);
	        // _camera_.quaternion.multiplyQuaternions(quaternionY, camera.quaternion);
        }

        if (this.space && !this.isJumping) {
            this.velocity.y = this.jumpStrength;
            this.isJumping = true;
        }

        this.velocity.y += this.gravity;
        camera.position.y += this.velocity.y;

        if (camera.position.y <= camera.floor + 0.5) {
            this.velocity.y = 0;
            camera.position.y = camera.floor + 0.5;
            this.isJumping = false;
        }
    }
    touch() {

    	this.wS = 0.05;
	    this.aS = 0.05;
	    this.sS = 0.05;
	    this.dS = 0.05;

    	actives.forEach(atc => scene.remove(atc));
    	actives = [];
		let boxSize;
		var cameraPosition = camera.position.clone();
		

		if (display.camera.boxType == 'person') {
			boxSize = new THREE.Vector3(.2, .5, .01); // Adjust the size as needed
			cameraPosition.y -= .2;
		} else if (display.camera.boxType == 'ediface-small') {
			boxSize = new THREE.Vector3(1, 6, 3);
		}
		

		// Create a bounding box around the camera
		var cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(cameraPosition, boxSize);

		if (display.cyberpunkBoxMemory) {

			// Apply rotation to the bounding box
			const matrix = new THREE.Matrix4().makeRotationFromQuaternion(camera.quaternion);
			const vertices = [
			    new THREE.Vector3(boxSize.x / 2, boxSize.y / 2, boxSize.z / 2),
			    new THREE.Vector3(-boxSize.x / 2, boxSize.y / 2, boxSize.z / 2),
			    new THREE.Vector3(boxSize.x / 2, -boxSize.y / 2, boxSize.z / 2),
			    new THREE.Vector3(-boxSize.x / 2, -boxSize.y / 2, boxSize.z / 2),
			    new THREE.Vector3(boxSize.x / 2, boxSize.y / 2, -boxSize.z / 2),
			    new THREE.Vector3(-boxSize.x / 2, boxSize.y / 2, -boxSize.z / 2),
			    new THREE.Vector3(boxSize.x / 2, -boxSize.y / 2, -boxSize.z / 2),
			    new THREE.Vector3(-boxSize.x / 2, -boxSize.y / 2, -boxSize.z / 2),
			];

			vertices.forEach(v => v.applyMatrix4(matrix).add(cameraPosition));

			const rotatedBoundingBox = new THREE.Box3().setFromPoints(vertices);
			// Optionally visualize the bounding box for debugging
			const boxHelper = new THREE.Box3Helper(rotatedBoundingBox, 0xffff00);

			scene.add(boxHelper);

		}
	    
	    var touchablePolygons = scene.children.filter(child => /[^devdot]/.test(child.name));


	   	window.intersects = false
		// Main loop
		for (var i = 0; i < touchablePolygons.length; i++) {
		    var polygon = touchablePolygons[i];
		    var positionAttribute = polygon.geometry.attributes.position;
		    var indexAttribute = polygon.geometry.index;

		    if (indexAttribute) {
		        for (var j = 0; j < indexAttribute.count; j += 3) {
		            var a = indexAttribute.getX(j);
		            var b = indexAttribute.getX(j + 1);
		            var c = indexAttribute.getX(j + 2);

		            var triangle = new THREE.Triangle(
		                new THREE.Vector3(positionAttribute.getX(a), positionAttribute.getY(a), positionAttribute.getZ(a)),
		                new THREE.Vector3(positionAttribute.getX(b), positionAttribute.getY(b), positionAttribute.getZ(b)),
		                new THREE.Vector3(positionAttribute.getX(c), positionAttribute.getY(c), positionAttribute.getZ(c))
		            );


		            if (Intersects(camera, triangle)) {
		            	display.cyberpunkBoxMemory = true;
		            	user.addTouchedObject({
		            		name: polygon.name + '::' + j,
		            		center: {
		            			x: (triangle.a.x + triangle.b.x + triangle.c.x) / 3,
		            			y: (triangle.a.y + triangle.b.y + triangle.c.y) / 3,
		            			z: (triangle.a.z + triangle.b.z + triangle.c.z) / 3
		            		},
		            		cameraFaceTouched: undefined
		            	})

						if (this.w) this.wS = 0;
						if (this.a) this.aS = 0;
						if (this.s) this.sS = 0;
						if (this.d) this.dS = 0;

						if (camera.isJumping) {
							camera.floor = camera.position.y;
							camera.isJumping = false;
							camera.velocity.y = 0;
						}

		            	var geometry = new THREE.BufferGeometry().setFromPoints([triangle.a, triangle.b, triangle.c, triangle.a]);
		                var material = new THREE.MeshBasicMaterial({ color: 'lawngreen' });
		                var viz = new THREE.Line(geometry, material);
		                scene.add(viz);
		                actives.push(viz);


		            } else {
		            	display.cyberpunkBoxMemory = false
		            	user.removeTouchedObject({ name: polygon.name + '::' + j })
		            }


	                this.creator.update();
		        }	
		    }
		}
	}

    navigate() {
    	this.tabs.forEach(tab => {
    		if (tab !== this.page) {
    			document.getElementById(tab).classList.remove('active');
    			document.querySelector('.' + tab).classList.remove('active');
    		} else {
    			document.getElementById(tab).classList.add('active');
    			document.querySelector('.' + tab).classList.add('active');
    		}
    	});
    }
}


function Control() {
	var controller = new Controller();


	/********/ /********/ /********/
	/********/ /********/ /********/
	/********/ /********/ /********/

	var c = document.createElement('section');
	c.id = 'controller';
	document.body.appendChild(c);

	var controllerTabs = document.createElement('div');
	controllerTabs.id = 'controller-tabs';
	controllerTabs.innerHTML = `<button id="create-outside">Nature</button><button id="generate-polygon" class="active">Build Objects</button><button id="apply-images">Search Images</button><button id="manage-spaces">Manage Spaces</button>`

	document.getElementById('controller').appendChild(controllerTabs);
	document.querySelectorAll('#controller-tabs > button').forEach(button => {
		button.addEventListener('click', function(e) {
			for (var i = 0; i < controller.tabs.length; i++) {
				if (e.srcElement.id == controller.tabs[i]) {
					document.getElementById(controller.tabs[i]).classList.add('active');
					document.querySelector('.' + controller.tabs[i]).classList.add('active');
				} else {
					document.getElementById(controller.tabs[i]).classList.remove('active');
					document.querySelector('.' + controller.tabs[i]).classList.remove('active');
				}
			}
			controller.page = e.srcElement.id;
			controller.navigate();
		});
	})


	var createOutside = document.createElement('section');
	createOutside.classList.add('page');
	createOutside.classList.add('create-outside');
	createOutside.innerHTML = `?`;

	c.appendChild(createOutside);


	var candidatePoints = document.createElement('section');
	candidatePoints.classList.add('page');
	candidatePoints.classList.add('active');
	candidatePoints.classList.add('generate-polygon');
	candidatePoints.innerHTML = `<div id="touch">
		<div class="header"><div>name</div><div>center</div><div>camera face touched</div></div>
		<div id="touched-objects">${
			user.touchedObjects.map(to => `<div class="row"><div>${to.name}</div><div>${JSON.stringify(to.center, null, 1)}</div><div>${to.cameraFaceTouched}</div></div>`).join('')
		}</div>
	</div>
	<div class="header"><div>Points</div><div>Actions</div></div>
	<div id="add-polygon-row" class="row"><button id="add-polygon">+</button></div>`;

	c.appendChild(candidatePoints);

	document.getElementById('add-polygon').addEventListener('click', (e) => {
		e.preventDefault();


		var id = controller.creator.polygonVertices.length;
		controller.creator.polygonVertices.push([]);

		var pg = document.createElement('div');
		['row', 'three', 'polygonpoints'].forEach(c => pg.classList.add(c));
		pg.innerHTML = `<pre class="point-group" data-id="${id}"></pre>
			<div>
				<button class="generate-polygon">Make Polygon Path</button>
				<button class="add-floor">Add a Floor</button>
				<button class="add-door">Add a Door</button>
				<button class="add-ceiling">Add a Ceiling</button>
				<button class="add-wall">Add a Wall</button>
				<button class="add-window">Add a Window</button>
			</div>`;

		document.getElementById('add-polygon-row').insertAdjacentElement('beforebegin', pg);
		
		pg.children[0].addEventListener('click', controller.creator.selectPointGroup.bind(controller.creator));

		pg.children[1].children[0].addEventListener('click', e => {
			controller.creator.addChild = true;
			controller.creator.ConnectTheDotsWithPolygons.bind(controller.creator);
			controller.creator.ConnectTheDotsWithPolygons();
			controller.creator.addChild = false;
		});

		pg.children[1].children[1].addEventListener('click', controller.creator.AddFloor.bind(controller.creator));
	})	


	var applyImages = document.createElement('section');
	applyImages.classList.add('page');
	applyImages.classList.add('apply-images');
	applyImages.innerHTML = `?`;


	c.appendChild(applyImages);

	var manageSpaces = document.createElement('section');
	manageSpaces.classList.add('page');
	manageSpaces.classList.add('manage-spaces');
	manageSpaces.innerHTML = `<pre>
${JSON.stringify(camera.intersects, null, 1)}
	</pre>`;


	c.appendChild(manageSpaces);


	controller.Self();

	return controller
}

var controller = Control()

/********/ /********/ /********/
/********/ /********/ /********/
/********/ /********/ /********/
window.devGridDots = [];
function DevGrid(radius, display) {
	window.devGridDots.forEach(function(dgd) {
		scene.remove(dgd);
		dgd.geometry.dispose();
		dgd.material.dispose();
	});
	window.devGridDots = [];
	if (display) {
		var gridstep = .45// 0.75;
	    for (var x = -radius; x < radius; x += gridstep) {
	        for (var y = -radius; y < radius; y += gridstep) {
	            for (var z = -radius; z < radius; z += gridstep) {
	            	let _x = Math.round(x * 100) / 100; 
	            	let _y = Math.round(y * 100) / 100;
	            	let _z = Math.round(z * 100) / 100;
	                var dot = new THREE.Mesh(
	                    new THREE.SphereGeometry(.02, 11, 11),
	                    new THREE.MeshStandardMaterial({
	                        color: 'white',
	                        side: THREE.DoubleSide
	                    })
	                );
	                dot.position.set(_x, _y, _z);
	                dot.castShadow = true;
	                dot.receiveShadow = true;
	                dot.name = 'devdot';
	                dot.uid = `${_x}_${_y}_${_z}`;
	                // add2DText(scene, dot.uid, .31, 'yellow', {x,y,z}, true, 'transparent');
	                
	                scene.add(dot);
	                devGridDots.push(dot);
	            }
	        }
	    }
	}

    // var g = new THREE.PlaneGeometry(radius * 2, radius * 2, 300, 300);
    // var m = new THREE.MeshStandardMaterial({
    //     color: 'blue',
    //     wireframe: false,
    //     side: THREE.DoubleSide
    // });
    // var plane = new THREE.Mesh(g, m);
    // plane.name = 'ground';
    // plane.receiveShadow = true;
    // plane.position.set(0, 0, 0);
    // plane.rotation.x = -Math.PI / 2;
    // scene.add(plane);
}

function Sun() {
    var pointLight = new THREE.PointLight(0xfffffe, 100000, 1000);
    pointLight.position.set(100, 100, 0);
    pointLight.lookAt(0, 0, 0);
    pointLight.castShadow = true;
    scene.add(pointLight);

    var counter = 0;
    var sway = false;
    function move() {
        window.requestAnimationFrame(move);
        pointLight.position.x += sway ? -0.1 : 0.1;
        pointLight.position.z += sway ? 0.1 : -0.1;
        counter += sway ? -1 : 1;
        if (Math.abs(counter) == 122) {
            sway = !sway;
        }
    }

    level.sun = new THREE.Mesh(
    	new THREE.SphereGeometry(1, 10, 10),
    	new THREE.MeshBasicMaterial({ color: 0xffffec })
    );
    level.sun.position.set(100, 100, 0);
    // let center = level.sun.ge
    // for (var i = 0; i < level.sun.geometry.attributes.position.array.length; i++) {
    // 	var vertexPosition = new THREE.Vector3(level.sun.geometry.attributes.position.array[i], level.sun.geometry.attributes.position.array[i + 1],level.sun.geometry.attributes.position.array[i + 2]);
    // 	var direction = level.sun.position.clone().sub(vertexPosition).normalize();

    // }
    scene.add(level.sun);
}

function createTextTexture(message, fontSize = 50, fontColor = 'white', backgroundColor = 'transparent') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const padding = 10;
    const dpi = 700; // Increase DPI for better resolution
    const scaleFactor = dpi / 72; // Scale factor based on DPI

    context.font = `${fontSize * scaleFactor}px Arial`;
    const textWidth = context.measureText(message).width;
    canvas.width = (textWidth + padding * 2) * scaleFactor;
    canvas.height = (fontSize + padding * 2) * scaleFactor;

    context.font = `${fontSize * scaleFactor}px Arial`;
    context.scale(scaleFactor, scaleFactor); // Apply scale factor to context
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor);

    context.fillStyle = fontColor;
    context.fillText(message, padding, fontSize + padding);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    return texture;
}

function add2DText(scene, message, fontSize, fontColor, position, isSprite, backgroundColor) {
    const texture = createTextTexture(message, fontSize, fontColor, backgroundColor);
    const scale = .001; // Adjust scale as needed for the desired size
    if (isSprite) {
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(position.x, position.y, position.z);
        sprite.scale.set(texture.image.width * scale, texture.image.height * scale, 1);
        scene.add(sprite);
    } else {
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
        const geometry = new THREE.PlaneGeometry(texture.image.width * scale, texture.image.height * scale); // Adjust size as needed
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, position.z);
        scene.add(mesh);
    }
}

function RenderAll() {
	add2DText(
		scene, '(0,0,0)', 2, 'lawngreen', { x: 0, y: 2, z: 0 }, true, 'transparent');

	devGridDots.forEach(dgd => scene.remove(dgd));
	devGridDots = [];

	DevGrid(N, true);
	
	Sun();

	Animate();
}

RenderAll();


function Animate() { 
    window.requestAnimationFrame(() => Animate());

    controller.activate();
    controller.touch();

    renderer.render(scene, camera);
}

