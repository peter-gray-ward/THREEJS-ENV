import {GLBModelApi} from '/lib/GLBModelApi.js'


class Model {
    animations= []//Array(7) [ {…}, {…}, {…}, … ]
    asset= {}//Object { generator: "Khronos glTF Blender I/O v1.1.46", version: "2.0" }
    cameras= []//Array []
    parser= {}//Object { json: {…}, extensions: {…}, plugins: {…}, … }
    scene= {}//Object { isObject3D: true, uuid: "2ee98eb1-8fe2-482b-b5b8-38116e807540", name: "Scene", … }
}

export function Anima(gltfLoader, resourceUrl) {
	this.model = undefined

	this.API = undefined
	

    this.scaleVisibleMeshes = (object3d, scaleFactor = 1, speed = 0.0001) => {
        if (object3d) {
            if (object3d.isMesh) {
                // Apply scaling to visible mesh, e.g., "Beta_Surface"
                console.log(object3d, scaleFactor)
                object3d.scale.set(scaleFactor, scaleFactor, scaleFactor);
            }

            // Update the scale factor for pulsing effect
            scaleFactor += speed;
            if (scaleFactor > 1.5 || scaleFactor < 0.5) speed *= -1; // Reverse at limits

            // Recursive call for children
            object3d.children.forEach((child) => {
                this.scaleVisibleMeshes(child, scaleFactor, speed);
            });
        }
    }

	this.load  = () => {
		return new Promise(resolve => {
			new gltfLoader().load(resourceUrl, 
				async (object) => {
                    console.log("what is this?", object)

                    this.model = object



					object.scene.isPerson = true













					this.API = new GLBModelApi(object)

		            this.minX = Infinity
		            this.maxX = -Infinity
		            this.minY = Infinity
		            this.maxY = -Infinity
		            this.minZ = Infinity
		            this.maxZ = -Infinity

		            this.API.model.scene.traverse((object3D) => {
		                // Make sure the object3D's world matrix is up-to-date
		                object3D.updateWorldMatrix(true, false);

		                // Get the object3D's world position if it has one
		                if (object3D.isMesh && object3D.geometry) {
		                    // Create a bounding box from geometry to get its dimensions
		                    const boundingBox = new THREE.Box3().setFromObject(object3D);

		                    // Update min/max values based on the bounding box
		                    this.minX = Math.min(this.minX, boundingBox.min.x);
		                    this.maxX = Math.max(this.maxX, boundingBox.max.x);
		                    this.minY = Math.min(this.minY, boundingBox.min.y);
		                    this.maxY = Math.max(this.maxY, boundingBox.max.y);
		                    this.minZ = Math.min(this.minZ, boundingBox.min.z);
		                    this.maxZ = Math.max(this.maxZ, boundingBox.max.z);
		                }
		            });

		            resolve()
				},
				async (e) => { 
		            
		        },
		        (e) => { console.log(e.loaded / e.total) },
		        (e) => { console.log(e) } )
		})
	}


	this.html = () => {
		var div = document.createElement('div')
		div.classList.add('radial-parts-menu')
		var html = ``
		for (var part of Object.keys(this.API)) {
			html += `<button class="radial-parts-button>"
				${part}
			</button>`
		}

	}

    this.enterScene = () => {
        this.API.model.scene.receiveShadow = true
        this.API.model.scene.castShadow = true
        this.API.model.scene.position.set(
            landscape.field.center.x, 
            landscape.field.center.y, 
            landscape.field.center.z
        )
        this.API.model.scene.rotation.set(
            0, Math.PI / 2, 0
        )

        this.API.model.scene.scale.set(
            6, 6, 6
        )
            
        scene.add(this.API.model.scene)
    }
}




/**  
 *      
 *      
 *   
 * 
 * 
 * ["A]nima is the archetype of life itself. (1954, par. 66)[".][9]

— Carl Jung

 * 
 * Anima
 * 
 * Eve – Object of desire, provider of nourishment, security and love
 * Helen – Worldly achiever, intelligent and talented
 * Mary – Righteous and a paragon of virtue
 * Sophia – Wise and fully human, equal and not at all an object
 * 
 * 
 * Animus
 * 
 * Tarzan – Man of mere physical power
 * Byron – Man of action or romance
 * Lloyd George – Man as a professor, clergyman, orator
 * Hermes – Man as a spiritual guide
 * 
 * 
 Scene
    Armature
        Beta_Joints
        Beta_Surface
        mixamorigHips
            mixamorigSpine
                mixamorigSpine1
                    mixamorigSpine2
                        mixamorigNeck
                            mixamorigHead
                                mixamorigHeadTop_End
                                mixamorigLeftEye
                                mixamorigRightEye
                        mixamorigLeftShoulder
                            mixamorigLeftArm
                                mixamorigLeftForeArm
                                    mixamorigLeftHand
                                        mixamorigLeftHandThumb1
                                            mixamorigLeftHandThumb2
                                                mixamorigLeftHandThumb3
                                                    mixamorigLeftHandThumb4
                                        mixamorigLeftHandIndex1
                                            mixamorigLeftHandIndex2
                                                mixamorigLeftHandIndex3
                                                    mixamorigLeftHandIndex4
                                        mixamorigLeftHandMiddle1
                                            mixamorigLeftHandMiddle2
                                                mixamorigLeftHandMiddle3
                                                    mixamorigLeftHandMiddle4
                                        mixamorigLeftHandRing1
                                            mixamorigLeftHandRing2
                                                mixamorigLeftHandRing3
                                                    mixamorigLeftHandRing4
                                        mixamorigLeftHandPinky1
                                            mixamorigLeftHandPinky2
                                                mixamorigLeftHandPinky3
                                                    mixamorigLeftHandPinky4
                        mixamorigRightShoulder
                            mixamorigRightArm
                                mixamorigRightForeArm
                                    mixamorigRightHand
                                        mixamorigRightHandThumb1
                                            mixamorigRightHandThumb2
                                                mixamorigRightHandThumb3
                                                    mixamorigRightHandThumb4
                                        mixamorigRightHandIndex1
                                            mixamorigRightHandIndex2
                                                mixamorigRightHandIndex3
                                                    mixamorigRightHandIndex4
                                        mixamorigRightHandMiddle1
                                            mixamorigRightHandMiddle2
                                                mixamorigRightHandMiddle3
                                                    mixamorigRightHandMiddle4
                                        mixamorigRightHandRing1
                                            mixamorigRightHandRing2
                                                mixamorigRightHandRing3
                                                    mixamorigRightHandRing4
                                        mixamorigRightHandPinky1
                                            mixamorigRightHandPinky2
                                                mixamorigRightHandPinky3
                                                    mixamorigRightHandPinky4
            mixamorigLeftUpLeg
                mixamorigLeftLeg
                    mixamorigLeftFoot
                        mixamorigLeftToeBase
                            mixamorigLeftToe_End
            mixamorigRightUpLeg
                mixamorigRightLeg
                    mixamorigRightFoot
                        mixamorigRightToeBase
                            mixamorigRightToe_End


Scene
    "This is the overall setting, the big picture, where everything takes place. Imagine it as the stage where all elements come together to create a whole."
    Armature
        "The central skeleton or framework. It’s what holds everything in place, providing structure to the entire form."
        Beta_Joints
            "Key connecting points of the armature, where movement and flexibility are determined. Each joint plays a role in how motion and stability come together."
        Beta_Surface
            "The layer covering the structure, adding the outer look to each component of the model. It’s the representation of form over function."
        



        mixamorigHips
            



            "The core center of movement, supporting the upper and lower body with a strong foundation for flexibility."
            



            mixamorigSpine
                "The main support column, carrying the structure upward and connecting the hips to the shoulders."
                mixamorigSpine1
                    "An intermediate segment of the spine, allowing additional flexibility in the torso."
                mixamorigSpine2
                    "Further support in the spine, enabling controlled movement and stability for the upper body."
                mixamorigNeck
                    "Connects the spine to the head, allowing head movement with a balance of stability and flexibility."
                    mixamorigHead
                        "The top of the structure, housing critical sensors like eyes and ears, crucial for perception and interaction."
                        mixamorigHeadTop_End
                            "The very top point of the head, marking the highest point in the model."
                        mixamorigLeftEye
                            "The left point of vision, vital for depth perception and visual balance."
                        mixamorigRightEye
                            "The right point of vision, working with the left eye for a full range of sight."
                mixamorigLeftShoulder
                    "The joint connecting the left arm to the spine, enabling a wide range of arm movement."
                    mixamorigLeftArm
                        "The upper section of the left arm, providing strength and leverage for movement."
                        mixamorigLeftForeArm
                            "The lower section of the left arm, allowing precise movements of the hand."
                            mixamorigLeftHand
                                "The endpoint of the left arm, responsible for interaction and fine motor skills."
                                mixamorigLeftHandThumb1
                                    "The base of the thumb, crucial for grip and dexterity."
                                    mixamorigLeftHandThumb2
                                        "The middle joint of the thumb, adding flexibility to grasp objects."
                                        mixamorigLeftHandThumb3
                                            "Another joint of the thumb, enhancing the hand’s grasping capabilities."
                                            mixamorigLeftHandThumb4
                                                "The tip of the thumb, used for precise movements and control."
                                mixamorigLeftHandIndex1
                                    "The base of the index finger, key for pointing and precision."
                                    mixamorigLeftHandIndex2
                                        "The middle joint of the index finger, adding flexibility to the hand."
                                    mixamorigLeftHandIndex3
                                        "Another joint of the index finger, supporting finer movements."
                                    mixamorigLeftHandIndex4
                                        "The tip of the index finger, crucial for detailed interactions."
                                mixamorigLeftHandMiddle1
                                    "The base of the middle finger, providing stability and balance to the hand."
                                    mixamorigLeftHandMiddle2
                                        "The middle joint of the middle finger, supporting flexible movement."
                                    mixamorigLeftHandMiddle3
                                        "Another joint of the middle finger, allowing further control."
                                    mixamorigLeftHandMiddle4
                                        "The tip of the middle finger, adding precision to interactions."
                                mixamorigLeftHandRing1
                                    "The base of the ring finger, which contributes to grip strength."
                                    mixamorigLeftHandRing2
                                        "The middle joint of the ring finger, providing stability."
                                    mixamorigLeftHandRing3
                                        "Another joint of the ring finger, adding dexterity."
                                    mixamorigLeftHandRing4
                                        "The tip of the ring finger, completing the finger’s movement range."
                                mixamorigLeftHandPinky1
                                    "The base of the pinky finger, supporting finer hand balance."
                                    mixamorigLeftHandPinky2
                                        "The middle joint of the pinky, adding flexibility."
                                    mixamorigLeftHandPinky3
                                        "Another joint of the pinky, providing range of movement."
                                    mixamorigLeftHandPinky4
                                        "The tip of the pinky, enabling intricate control."
                mixamorigRightShoulder
                    "The joint connecting the right arm to the spine, allowing arm rotation and movement."
                    mixamorigRightArm
                        "The upper portion of the right arm, enabling strong and controlled motions."
                        mixamorigRightForeArm
                            "The lower right arm, essential for guiding hand movements."
                            mixamorigRightHand
                                "The hand on the right arm, responsible for tasks requiring dexterity and strength."
                                mixamorigRightHandThumb1
                                    "The base of the right thumb, crucial for gripping."
                                    mixamorigRightHandThumb2
                                        "The middle joint of the right thumb, enhancing hand versatility."
                                    mixamorigRightHandThumb3
                                        "Another joint of the right thumb, allowing precision grip."
                                    mixamorigRightHandThumb4
                                        "The tip of the right thumb, enabling detailed actions."
                                mixamorigRightHandIndex1
                                    "The base of the right index finger, key for precision pointing."
                                    mixamorigRightHandIndex2
                                        "The middle joint of the right index finger, adding range of movement."
                                    mixamorigRightHandIndex3
                                        "Another joint of the index finger, allowing control."
                                    mixamorigRightHandIndex4
                                        "The tip of the index finger, essential for delicate actions."
                                mixamorigRightHandMiddle1
                                    "The base of the middle finger, central to hand stability."
                                    mixamorigRightHandMiddle2
                                        "The middle joint of the middle finger, supporting flexibility."
                                    mixamorigRightHandMiddle3
                                        "Another joint of the middle finger, adding control."
                                    mixamorigRightHandMiddle4
                                        "The tip of the middle finger, enhancing precision."
                                mixamorigRightHandRing1
                                    "The base of the ring finger, contributing to grip strength."
                                    mixamorigRightHandRing2
                                        "The middle joint of the ring finger, enabling flexibility."
                                    mixamorigRightHandRing3
                                        "Another joint of the ring finger, adding range."
                                    mixamorigRightHandRing4
                                        "The tip of the ring finger, completing movement capacity."
                                mixamorigRightHandPinky1
                                    "The base of the pinky, supporting finer hand control."
                                    mixamorigRightHandPinky2
                                        "The middle joint of the pinky, allowing more movement."
                                    mixamorigRightHandPinky3
                                        "Another joint of the pinky, adding flexibility."
                                    mixamorigRightHandPinky4
                                        "The tip of the pinky, enabling delicate handling."
            mixamorigLeftUpLeg
                "The upper left leg, providing a strong base for movement and stability."
                mixamorigLeftLeg
                    "The lower left leg, facilitating controlled movement of the foot."
                    mixamorigLeftFoot
                        "The end of the left leg, essential for balance and support."
                        mixamorigLeftToeBase
                            "The base of the toes on the left foot, critical for stability."
                            mixamorigLeftToe_End
                                "The end of the toes, marking the final point of the left foot."
            mixamorigRightUpLeg
                "The upper right leg, contributing strength and stability for movement."
                mixamorigRightLeg
                    "The lower right leg, enabling balance and flexibility of the foot."
                    mixamorigRightFoot
                        "The base of support for the right leg, providing stability."
                        mixamorigRightToeBase
                            "The base of the right foot’s toes, key for maintaining balance."
                            mixamorigRightToe_End
                                "The endpoint of the right toes, crucial for balance."

*/