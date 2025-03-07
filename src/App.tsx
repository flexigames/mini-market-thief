import React, {
  useRef,
  useEffect,
  useState,
} from "react";
import { Canvas, useLoader, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Environment,
  PerspectiveCamera,
} from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader";
import * as THREE from "three";
import "./App.css";

function Wall({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const materials = useLoader(MTLLoader, "/assets/Models/wall.mtl");
  const obj = useLoader(
    OBJLoader,
    "/assets/Models/wall.obj",
    (loader: OBJLoader) => {
      materials.preload();
      loader.setMaterials(materials);
    }
  );

  return (
    <primitive object={obj.clone()} position={position} rotation={rotation} />
  );
}

function Window({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const materials = useLoader(MTLLoader, "/assets/Models/wall-window.mtl");
  const obj = useLoader(
    OBJLoader,
    "/assets/Models/wall-window.obj",
    (loader: OBJLoader) => {
      materials.preload();
      loader.setMaterials(materials);
    }
  );

  return (
    <primitive object={obj.clone()} position={position} rotation={rotation} />
  );
}

function Door({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const materials = useLoader(MTLLoader, "/assets/Models/wall-door-rotate.mtl");
  const obj = useLoader(
    OBJLoader,
    "/assets/Models/wall-door-rotate.obj",
    (loader: OBJLoader) => {
      materials.preload();
      loader.setMaterials(materials);
    }
  );

  return (
    <primitive object={obj.clone()} position={position} rotation={rotation} />
  );
}

function Floor() {
  const materials = useLoader(MTLLoader, "/assets/Models/floor.mtl");
  const originalObj = useLoader(
    OBJLoader,
    "/assets/Models/floor.obj",
    (loader: OBJLoader) => {
      materials.preload();
      loader.setMaterials(materials);
    }
  );

  const tiles = [];
  const size = 10;
  const spacing = 1;

  // Calculate offset to center the grid
  const offset = (size * spacing) / 2 - spacing / 2;

  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      const clonedObj = originalObj.clone();
      tiles.push(
        <primitive
          key={`${x}-${z}`}
          object={clonedObj}
          position={[x * spacing - offset, 0, z * spacing - offset]}
          scale={[1, 1, 1]}
        />
      );
    }
  }

  return <group>{tiles}</group>;
}

function Walls() {
  const wallsBack = [];
  const wallsLeft = [];
  const size = 10;
  const spacing = 1;
  const offset = (size * spacing) / 2 - spacing / 2;

  // Back wall with windows
  for (let x = 0; x < size; x++) {
    // Add windows at positions 2, 5, and 8
    if (x === 2 || x === 5 || x === 8) {
      wallsBack.push(
        <Window
          key={`back-window-${x}`}
          position={[x - offset, 0, -offset - spacing / 2]}
          rotation={[0, 0, 0]}
        />
      );
    } else {
      wallsBack.push(
        <Wall
          key={`back-${x}`}
          position={[x - offset, 0, -offset - spacing / 2]}
          rotation={[0, 0, 0]}
        />
      );
    }
  }

  // Left wall with door
  for (let z = 0; z < size; z++) {
    // Add door at position 3
    if (z === 3) {
      wallsLeft.push(
        <Door
          key={`left-door-${z}`}
          position={[-offset - spacing / 2, 0, z - offset]}
          rotation={[0, Math.PI / 2, 0]}
        />
      );
    } else {
      wallsLeft.push(
        <Wall
          key={`left-${z}`}
          position={[-offset - spacing / 2, 0, z - offset]}
          rotation={[0, Math.PI / 2, 0]}
        />
      );
    }
  }

  return (
    <group>
      {wallsBack}
      {wallsLeft}
    </group>
  );
}

function ShelfBoxes({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const materials = useLoader(MTLLoader, "/assets/Models/shelf-boxes.mtl");
  const obj = useLoader(
    OBJLoader,
    "/assets/Models/shelf-boxes.obj",
    (loader: OBJLoader) => {
      materials.preload();
      loader.setMaterials(materials);
    }
  );

  return (
    <primitive object={obj.clone()} position={position} rotation={rotation} />
  );
}

function Shelves() {
  return (
    <group position={[0, 0, 0]}>
      {/* Left side of aisle */}
      <group position={[-1.5, 0, 0]}>
        <ShelfBoxes position={[0, 0, -3]} rotation={[0, Math.PI / 2, 0]} />
        <ShelfBoxes position={[0, 0, -1]} rotation={[0, Math.PI / 2, 0]} />
        <ShelfBoxes position={[0, 0, 1]} rotation={[0, Math.PI / 2, 0]} />
        <ShelfBoxes position={[0, 0, 3]} rotation={[0, Math.PI / 2, 0]} />
      </group>

      {/* Right side of aisle */}
      <group position={[1.5, 0, 0]}>
        <ShelfBoxes position={[0, 0, -3]} rotation={[0, -Math.PI / 2, 0]} />
        <ShelfBoxes position={[0, 0, -1]} rotation={[0, -Math.PI / 2, 0]} />
        <ShelfBoxes position={[0, 0, 1]} rotation={[0, -Math.PI / 2, 0]} />
        <ShelfBoxes position={[0, 0, 3]} rotation={[0, -Math.PI / 2, 0]} />
      </group>
    </group>
  );
}

// Collision detection constants
const SHELF_SIZE = { width: 0.7, depth: 0.7 };
const CHARACTER_SIZE = { radius: 0.2 };

function checkCollisionWithShelves(x: number, z: number): boolean {
  // Define shelf positions for our aisle
  const shelfPositions = [
    // Left side of aisle
    { x: -1.5, z: -3 },
    { x: -1.5, z: -1 },
    { x: -1.5, z: 1 },
    { x: -1.5, z: 3 },
    // Right side of aisle
    { x: 1.5, z: -3 },
    { x: 1.5, z: -1 },
    { x: 1.5, z: 1 },
    { x: 1.5, z: 3 },
  ];

  // Check collision with each shelf
  for (const shelf of shelfPositions) {
    const dx = x - shelf.x;
    const dz = z - shelf.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < SHELF_SIZE.width / 2 + CHARACTER_SIZE.radius) {
      return true;
    }
  }

  return false;
}

function Lighting() {
  return (
    <>
      {/* Soft overall ambient light */}
      <ambientLight intensity={0.6} color="#ffffff" />

      {/* Main directional light - soft warm tone */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.7}
        color="#fff6e6"
        castShadow
      />

      {/* Fill light - subtle cool tone */}
      <directionalLight
        position={[-5, 3, -5]}
        intensity={0.3}
        color="#e6f0ff"
      />

      {/* Top light for gentle highlights */}
      <directionalLight position={[0, 10, 0]} intensity={0.2} color="#ffffff" />
    </>
  );
}

function Character() {
  const characterRef = useRef<THREE.Group>();
  const materials = useLoader(
    MTLLoader,
    "/assets/Models/character-employee.mtl"
  );
  const obj = useLoader(
    OBJLoader,
    "/assets/Models/character-employee.obj",
    (loader: OBJLoader) => {
      materials.preload();
      loader.setMaterials(materials);
    }
  );

  const baseSpeed = 0.035;
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const position = useRef<[number, number, number]>([0, 0.15, 0]);
  const rotation = useRef<number>(0);
  const targetRotation = useRef<number>(0);
  const rotationSpeed = 0.15;

  // Animation parameters
  const walkingTime = useRef<number>(0);
  const idleTime = useRef<number>(0);
  const walkingAmplitude = 0.08;
  const walkingFrequency = 10;
  const idleAmplitude = 0.02;
  const idleFrequency = 2;
  const baseHeight = 0.15;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;

      // Prevent default browser scrolling for arrow keys
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(
          e.key.toLowerCase()
        )
      ) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;

      // Prevent default browser scrolling for arrow keys
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(
          e.key.toLowerCase()
        )
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame(({ camera }, delta) => {
    if (!characterRef.current) return;

    const moveForward = keysPressed.current['w'] || keysPressed.current['arrowup'];
    const moveBackward = keysPressed.current['s'] || keysPressed.current['arrowdown'];
    const moveLeft = keysPressed.current['a'] || keysPressed.current['arrowleft'];
    const moveRight = keysPressed.current['d'] || keysPressed.current['arrowright'];

    // Get camera's horizontal rotation
    const cameraAngle = Math.atan2(camera.position.x, camera.position.z);

    // Calculate movement direction relative to camera
    let moveAngle = 0;
    let moving = false;
    let isDiagonal = false;

    if (moveForward || moveBackward || moveLeft || moveRight) {
      moving = true;
      
      // Base movement angles (relative to camera)
      if (moveForward) moveAngle = 0;
      if (moveBackward) moveAngle = Math.PI;
      if (moveLeft) moveAngle = Math.PI / 2;
      if (moveRight) moveAngle = -Math.PI / 2;

      // Diagonal movement
      if ((moveForward || moveBackward) && (moveLeft || moveRight)) {
        isDiagonal = true;
        if (moveForward && moveLeft) moveAngle = Math.PI / 4;
        if (moveForward && moveRight) moveAngle = -Math.PI / 4;
        if (moveBackward && moveLeft) moveAngle = Math.PI * 3/4;
        if (moveBackward && moveRight) moveAngle = -Math.PI * 3/4;
      }

      // Adjust movement angle based on camera rotation
      moveAngle = (moveAngle + cameraAngle + Math.PI) % (Math.PI * 2);
    }

    // Update animation timers
    if (moving) {
      walkingTime.current += delta * walkingFrequency;
    } else {
      walkingTime.current = 0;
    }
    idleTime.current += delta * idleFrequency;

    if (moving) {
      // Calculate new position
      const newX = position.current[0] + Math.sin(moveAngle) * baseSpeed;
      const newZ = position.current[2] + Math.cos(moveAngle) * baseSpeed;

      // Only update position if there's no collision
      if (!checkCollisionWithShelves(newX, newZ)) {
        // Update position with boundary checks
        const bounds = 4.5;
        position.current = [
          Math.max(-bounds, Math.min(bounds, newX)),
          baseHeight,
          Math.max(-bounds, Math.min(bounds, newZ))
        ];
      }

      // Update target rotation to face movement direction
      if (moving) {
        // Calculate the shortest rotation path
        let newTargetRotation = moveAngle;
        let rotationDiff = newTargetRotation - rotation.current;

        // Normalize the rotation difference to [-π, π]
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

        // Set the target rotation using the shortest path
        targetRotation.current = rotation.current + rotationDiff;
      }
    }

    // Apply animations
    const walkingOffset = moving
      ? Math.sin(walkingTime.current) * walkingAmplitude
      : 0;
    const idleOffset = Math.sin(idleTime.current) * idleAmplitude;
    const finalY = baseHeight + Math.abs(walkingOffset) + Math.abs(idleOffset);

    // Set position with animations
    characterRef.current.position.set(
      position.current[0],
      finalY,
      position.current[2]
    );

    // Add slight tilt when walking
    if (moving) {
      characterRef.current.rotation.z = Math.sin(walkingTime.current) * 0.1;
    } else {
      characterRef.current.rotation.z = 0;
    }

    // Smooth rotation for turning
    const currentRotation = rotation.current;
    let rotationDiff = targetRotation.current - currentRotation;

    // Normalize the rotation difference to the shortest path
    if (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    if (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    // Apply smooth rotation
    rotation.current += rotationDiff * rotationSpeed;
    characterRef.current.rotation.y = rotation.current;
  });

  return (
    <primitive
      ref={characterRef}
      object={obj.clone()}
      position={[0, 0, 0]}
      scale={[0.8, 0.8, 0.8]}
    />
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <Lighting />
      <Floor />
      <Walls />
      <Shelves />
      <Character />
      <Grid
        args={[10, 10]}
        position={[0, 0.01, 0]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6e6e6e"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#9d9d9d"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
      />
      <OrbitControls />
      <Environment preset="sunset" />
    </>
  );
}

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas 
        camera={{ position: [10, 10, 10], fov: 50 }}
        shadows
      >
        <color attach="background" args={['#f0f0f0']} />
        <Scene />
      </Canvas>
    </div>
  );
}

export default App;
