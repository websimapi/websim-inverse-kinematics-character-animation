import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { IK, IKChain, IKJoint, IKBallConstraint, IKHelper } from 'ik';

let scene, camera, renderer, controls, clock;
let character, ik, ikHelper, targetMesh;
let bones = {};
let targetPosition = new THREE.Vector3(20, 100, 50); // Initial target position

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    scene.fog = new THREE.Fog(0xf0f0f0, 200, 1000);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 150, 300);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    scene.add(dirLight);

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 100, 0);
    controls.update();

    // Load Character Model
    const loader = new GLTFLoader();
    // Using a simple rigged model from Mixamo for demonstration
    // Replace with your skinned mesh model URL if you have one
    loader.load('https://threejs.org/examples/models/gltf/Michelle.glb', (gltf) => {
        character = gltf.scene;
        character.scale.set(80, 80, 80); // Scale appropriately
        character.traverse((object) => {
            if (object.isMesh) object.castShadow = true;
            if (object.isBone) {
                bones[object.name] = object; // Store bones by name
            }
        });

        scene.add(character);

        // Skeleton Helper (Optional: Visualizes the bones)
        const skeletonHelper = new THREE.SkeletonHelper(character);
        skeletonHelper.visible = true; // Toggle visibility
        scene.add(skeletonHelper);

        setupIK();
        setupTarget();

    }, undefined, (error) => {
        console.error('An error happened loading the model:', error);
        const infoDiv = document.getElementById('info');
        infoDiv.innerHTML = 'Error loading model. Please check console.';
    });


    window.addEventListener('resize', onWindowResize);
}

function setupIK() {
    if (!character || Object.keys(bones).length === 0) {
        console.error("Character or bones not loaded yet.");
        return;
    }

    ik = new IK();
    const chain = new IKChain();

    // --- Define the IK Chain (Example: Right Arm) ---
    // This requires knowing the exact bone names from your model.
    // Inspect your model's bone structure (e.g., in Blender or by logging `bones`)
    // Adjust bone names based on the 'Michelle.glb' model or your own.
    const rightShoulder = bones['mixamorigRightShoulder'];
    const rightArm = bones['mixamorigRightArm'];
    const rightForeArm = bones['mixamorigRightForeArm'];
    const rightHand = bones['mixamorigRightHand']; // This is the end effector

    if (!rightShoulder || !rightArm || !rightForeArm || !rightHand) {
        console.error("Could not find all required bones for the right arm IK chain. Available bones:", Object.keys(bones));
        const infoDiv = document.getElementById('info');
        infoDiv.innerHTML = 'Error: Could not find required bones for IK. Check console.';
        return;
    }

    // Create joints for the chain
    // Base joint (Shoulder) - often fixed or with limited rotation
    const shoulderJoint = new IKJoint(rightShoulder, { constraints: [new IKBallConstraint(90)] }); // Limit rotation

    // Elbow joint - typically hinge-like (adjust constraints as needed)
    // For simplicity, using a ball constraint, refine later if needed.
    const elbowJoint = new IKJoint(rightArm, { constraints: [new IKBallConstraint(120)] });

    // Wrist joint
    const wristJoint = new IKJoint(rightForeArm, { constraints: [new IKBallConstraint(90)] }); // Target is attached here


    // Add joints to the chain IN ORDER from base to end effector
    chain.add(shoulderJoint);
    chain.add(elbowJoint);
    chain.add(wristJoint, { target: rightHand }); // Specify the target bone (end effector)

    // Add the chain to the IK system
    ik.add(chain);

    // --- Visualize the IK system (Optional) ---
    ikHelper = new IKHelper(ik);
    scene.add(ikHelper);

    console.log("IK system initialized for the right arm.");
}


function setupTarget() {
    // Simple sphere as the target
    const targetGeometry = new THREE.SphereGeometry(5, 32, 32);
    const targetMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, depthTest: false, transparent: true, opacity: 0.8 });
    targetMesh = new THREE.Mesh(targetGeometry, targetMaterial);
    targetMesh.position.copy(targetPosition);
    targetMesh.renderOrder = 1; // Render on top
    scene.add(targetMesh);

    // Drag Controls for the target
    const dragControls = new DragControls([targetMesh], camera, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) {
        controls.enabled = false; // Disable orbit controls while dragging
    });
    dragControls.addEventListener('drag', function (event) {
        targetPosition.copy(event.object.position);
        updateSliderValues();
    });
    dragControls.addEventListener('dragend', function (event) {
        controls.enabled = true;
    });

    // Slider Controls
    const targetXSlider = document.getElementById('targetX');
    const targetYSlider = document.getElementById('targetY');
    const targetZSlider = document.getElementById('targetZ');

    targetXSlider.addEventListener('input', (event) => {
        targetPosition.x = parseFloat(event.target.value);
        targetMesh.position.x = targetPosition.x;
    });
    targetYSlider.addEventListener('input', (event) => {
        targetPosition.y = parseFloat(event.target.value);
        targetMesh.position.y = targetPosition.y;
    });
    targetZSlider.addEventListener('input', (event) => {
        targetPosition.z = parseFloat(event.target.value);
        targetMesh.position.z = targetPosition.z;
    });

    updateSliderValues(); // Initialize slider values
}

function updateSliderValues() {
    document.getElementById('targetX').value = targetPosition.x;
    document.getElementById('targetY').value = targetPosition.y;
    document.getElementById('targetZ').value = targetPosition.z;
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (ik && targetMesh && ik.chains.length > 0 && ik.chains[0].joints.length > 0) {
         // Check if IK is set up and has chains/joints
        const targetBone = ik.chains[0].joints[ik.chains[0].joints.length - 1].target;
        if (targetBone) {
            // Set the target position for the IK solver
            targetBone.position.copy(targetPosition);
            // Alternatively, you could directly set ik.chains[0].target = targetMesh.position;
            // but setting the bone's position seems more direct for the solver.

            // Update the IK solver
            ik.solve();
        }

        // Update the IK Helper visualization
        if (ikHelper) {
            ikHelper.updateMatrixWorld(true);
        }
    }


    renderer.render(scene, camera);
}
`````` index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inverse Kinematics Character Animation</title>
    <style>
        body { margin: 0; overflow: hidden; background-color: #f0f0f0; }
        canvas { display: block; }
        #info {
            position: absolute;
            top: 10px;
            width: 100%;
            text-align: center;
            z-index: 100;
            display:block;
            color: #333;
            font-family: Arial, sans-serif;
        }
        #target-controls {
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: rgba(255, 255, 255, 0.7);
            padding: 10px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
        }
        #target-controls label {
            display: block;
            margin-bottom: 5px;
        }
        #target-controls input[type="range"] {
            width: 150px;
        }
    </style>
</head>
<body>
    <div id="info">Inverse Kinematics Character Animation with Three.js<br/>Drag the red target sphere</div>
    <div id="target-controls">
        <label for="targetX">Target X:</label>
        <input type="range" id="targetX" min="-150" max="150" value="20">
        <label for="targetY">Target Y:</label>
        <input type="range" id="targetY" min="0" max="250" value="100">
        <label for="targetZ">Target Z:</label>
        <input type="range" id="targetZ" min="-100" max="150" value="50">
    </div>

    <script type="importmap">
    {
        "imports": {
            "three": "https://unpkg.com/three@0.163.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.163.0/examples/jsm/",
            "ik": "https://unpkg.com/three-ik@0.4.1/build/three-ik.module.js"
        }
    }
    </script>
    <script type="module" src="main.js"></script>
</body>
</html>

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { IK, IKChain, IKJoint, IKBallConstraint, IKHelper } from 'ik';

let scene, camera, renderer, orbitControls, clock;
let character, ik, ikHelper, targetMesh;
let bones = {};
let targetPosition = new THREE.Vector3(20, 100, 50); // Initial target position
let targetDragControls;

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    scene.fog = new THREE.Fog(0xf0f0f0, 200, 1000);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 150, 300);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5); // Increased intensity
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); // Increased intensity
    dirLight.position.set(50, 200, 100); // Adjusted position
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    scene.add(dirLight);
    // scene.add( new THREE.CameraHelper( dirLight.shadow.camera ) ); // Optional: visualize shadow camera

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Orbit Controls
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.target.set(0, 100, 0);
    orbitControls.update();

    // Load Character Model
    const loader = new GLTFLoader();
    // Using a simple rigged model from Mixamo for demonstration
    loader.load('https://threejs.org/examples/models/gltf/Michelle.glb', (gltf) => {
        character = gltf.scene;
        character.scale.set(80, 80, 80); // Scale appropriately
        character.position.y = 0; // Ensure character is grounded
        character.traverse((object) => {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = false; // Usually characters don't receive shadows on themselves
                 // Ensure meshes update matrices for IK
                object.matrixAutoUpdate = true;
            }
            if (object.isBone) {
                bones[object.name] = object; // Store bones by name
            }
        });

        scene.add(character);
        console.log("Character loaded. Available bones:", Object.keys(bones));

        // Skeleton Helper (Optional: Visualizes the bones)
        // const skeletonHelper = new THREE.SkeletonHelper(character);
        // skeletonHelper.visible = true; // Toggle visibility
        // scene.add(skeletonHelper);

        setupIK();
        setupTarget();

    }, undefined, (error) => {
        console.error('An error happened loading the model:', error);
        const infoDiv = document.getElementById('info');
        infoDiv.innerHTML = 'Error loading model. Please check console.';
    });


    window.addEventListener('resize', onWindowResize);
}

function setupIK() {
    if (!character || Object.keys(bones).length === 0) {
        console.error("Character or bones not loaded yet.");
        return;
    }

    ik = new IK();
    const chain = new IKChain();

    // --- Define the IK Chain (Right Arm for Michelle model) ---
    // Bone names are specific to the 'Michelle.glb' model from Three.js examples
    const boneNames = [
        'mixamorigSpine',       // Base constraint, part of torso
        'mixamorigSpine1',
        'mixamorigSpine2',
        'mixamorigNeck',        // Included for more natural shoulder movement linkage
        'mixamorigRightShoulder',
        'mixamorigRightArm',       // Upper Arm
        'mixamorigRightForeArm',   // Forearm
        'mixamorigRightHand'       // End effector bone
    ];

    let chainBones = [];
    let missingBones = false;
    boneNames.forEach(name => {
        const bone = bones[name];
        if (!bone) {
            console.error(`Could not find bone: ${name}. IK setup failed.`);
            missingBones = true;
        }
        chainBones.push(bone);
    });

    if (missingBones) {
         console.error("Available bones:", Object.keys(bones));
         const infoDiv = document.getElementById('info');
         infoDiv.innerHTML = 'Error: Could not find required bones for IK. Check console.';
         ik = null; // Prevent errors later
         return;
    }


    // Create joints for the chain with constraints
    // Base constraints (Spine/Neck) - limit rotation significantly
    chain.add(new IKJoint(chainBones[0], { constraints: [new IKBallConstraint(30)] }));
    chain.add(new IKJoint(chainBones[1], { constraints: [new IKBallConstraint(30)] }));
    chain.add(new IKJoint(chainBones[2], { constraints: [new IKBallConstraint(30)] }));
    chain.add(new IKJoint(chainBones[3], { constraints: [new IKBallConstraint(45)] })); // Neck

    // Shoulder - More freedom
    chain.add(new IKJoint(chainBones[4], { constraints: [new IKBallConstraint(90)] }));

    // Elbow (RightArm bone) - Should ideally be a hinge, using ball constraint for simplicity
    chain.add(new IKJoint(chainBones[5], { constraints: [new IKBallConstraint(160)] })); // Generous elbow range

    // Wrist (RightForeArm bone) - Add with target (RightHand)
    chain.add(new IKJoint(chainBones[6], { constraints: [new IKBallConstraint(90)] }), { target: chainBones[7] }); // Target is the RightHand bone


    // Add the chain to the IK system
    ik.add(chain);

    // --- Visualize the IK system (Optional but helpful) ---
    ikHelper = new IKHelper(ik);
    scene.add(ikHelper);

    console.log("IK system initialized successfully.");
}


function setupTarget() {
    // Simple sphere as the target
    const targetGeometry = new THREE.SphereGeometry(5, 16, 16); // Slightly lower poly
    const targetMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        depthTest: false, // Render on top
        transparent: true,
        opacity: 0.8
    });
    targetMesh = new THREE.Mesh(targetGeometry, targetMaterial);
    targetMesh.position.copy(targetPosition);
    targetMesh.renderOrder = 999; // Ensure it renders above other things
    targetMesh.material.needsUpdate = true; // Ensure depthTest: false takes effect
    scene.add(targetMesh);

    // Drag Controls for the target
    targetDragControls = new DragControls([targetMesh], camera, renderer.domElement);
    targetDragControls.addEventListener('dragstart', function (event) {
        orbitControls.enabled = false; // Disable orbit controls while dragging target
    });
    targetDragControls.addEventListener('drag', function (event) {
        // Constrain Y to be >= 0 if needed
        // event.object.position.y = Math.max(0, event.object.position.y);
        targetPosition.copy(event.object.position);
        updateSliderValues(); // Update sliders when dragging the sphere
    });
    targetDragControls.addEventListener('dragend', function (event) {
        orbitControls.enabled = true;
    });

    // Slider Controls
    const targetXSlider = document.getElementById('targetX');
    const targetYSlider = document.getElementById('targetY');
    const targetZSlider = document.getElementById('targetZ');

    targetXSlider.addEventListener('input', (event) => {
        targetPosition.x = parseFloat(event.target.value);
        targetMesh.position.x = targetPosition.x;
    });
    targetYSlider.addEventListener('input', (event) => {
        targetPosition.y = parseFloat(event.target.value);
        targetMesh.position.y = targetPosition.y;
    });
    targetZSlider.addEventListener('input', (event) => {
        targetPosition.z = parseFloat(event.target.value);
        targetMesh.position.z = targetPosition.z;
    });

    // Initialize slider values from initial targetPosition
    updateSliderValues();
}

function updateSliderValues() {
    document.getElementById('targetX').value = targetPosition.x;
    document.getElementById('targetY').value = targetPosition.y;
    document.getElementById('targetZ').value = targetPosition.z;
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    //const delta = clock.getDelta(); // Delta time if needed for animations

    // Update IK solver if it's initialized
    if (ik && ik.chains.length > 0 && ik.chains[0] && ik.chains[0].target) {
        // Update the target position for the IK chain's end effector
        // The target object (mesh) position is already updated by drag/sliders
        // The IK system needs the target position in the local space of the chain's root parent
        // For simplicity here, assuming the character is at the world origin or the target mesh position
        // is already relative. If character moves, need to transform target position.
        ik.chains[0].target.copy(targetMesh.position);

        // Solve the IK chain
        ik.solve();

        // Optional: Update the IK Helper visualization
        // if (ikHelper) {
        //    ikHelper.updateMatrixWorld(true); // Ensure helper reflects latest bone positions
        // }
    }

    // Update controls (like orbit controls)
    orbitControls.update();

    // Render the scene
    renderer.render(scene, camera);
}

// Cleanup on drag control disposal if needed
// targetDragControls.dispose();

