import React, { useEffect } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import * as THREE from 'three';

function Wall({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  const materials = useLoader(MTLLoader, '/assets/Models/wall.mtl');
  const obj = useLoader(OBJLoader, '/assets/Models/wall.obj', (loader: OBJLoader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  return <primitive object={obj.clone()} position={position} rotation={rotation} />;
}

function Window({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  const materials = useLoader(MTLLoader, '/assets/Models/wall-window.mtl');
  const obj = useLoader(OBJLoader, '/assets/Models/wall-window.obj', (loader: OBJLoader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  return <primitive object={obj.clone()} position={position} rotation={rotation} />;
}

function Door({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  const materials = useLoader(MTLLoader, '/assets/Models/wall-door-rotate.mtl');
  const obj = useLoader(OBJLoader, '/assets/Models/wall-door-rotate.obj', (loader: OBJLoader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  return <primitive object={obj.clone()} position={position} rotation={rotation} />;
}

function Floor() {
  const materials = useLoader(MTLLoader, '/assets/Models/floor.mtl');
  const originalObj = useLoader(OBJLoader, '/assets/Models/floor.obj', (loader: OBJLoader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

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
          position={[
            x * spacing - offset,
            0,
            z * spacing - offset
          ]}
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
          position={[x - offset, 0, -offset - spacing/2]}
          rotation={[0, 0, 0]}
        />
      );
    } else {
      wallsBack.push(
        <Wall
          key={`back-${x}`}
          position={[x - offset, 0, -offset - spacing/2]}
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
          position={[-offset - spacing/2, 0, z - offset]}
          rotation={[0, Math.PI / 2, 0]}
        />
      );
    } else {
      wallsLeft.push(
        <Wall
          key={`left-${z}`}
          position={[-offset - spacing/2, 0, z - offset]}
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
      <directionalLight 
        position={[0, 10, 0]} 
        intensity={0.2} 
        color="#ffffff"
      />
    </>
  );
}

function ShelfBoxes({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  const materials = useLoader(MTLLoader, '/assets/Models/shelf-boxes.mtl');
  const obj = useLoader(OBJLoader, '/assets/Models/shelf-boxes.obj', (loader: OBJLoader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  return <primitive object={obj.clone()} position={position} rotation={rotation} />;
}

function ShelfBags({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  const materials = useLoader(MTLLoader, '/assets/Models/shelf-bags.mtl');
  const obj = useLoader(OBJLoader, '/assets/Models/shelf-bags.obj', (loader: OBJLoader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  return <primitive object={obj.clone()} position={position} rotation={rotation} />;
}

function ShelfEnd({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  const materials = useLoader(MTLLoader, '/assets/Models/shelf-end.mtl');
  const obj = useLoader(OBJLoader, '/assets/Models/shelf-end.obj', (loader: OBJLoader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  return <primitive object={obj.clone()} position={position} rotation={rotation} />;
}

function DisplayFruit({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  const materials = useLoader(MTLLoader, '/assets/Models/display-fruit.mtl');
  const obj = useLoader(OBJLoader, '/assets/Models/display-fruit.obj', (loader: OBJLoader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  return <primitive object={obj.clone()} position={position} rotation={rotation} />;
}

function Shelves() {
  // Create organized aisles
  return (
    <group position={[0, 0, 0]}>
      {/* Aisle 1 */}
      <group position={[-3, 0, 0]}>
        {/* Left side of aisle */}
        <group position={[0, 0, 0]}>
          <ShelfBoxes position={[0, 0, -3]} rotation={[0, 0, 0]} />
          <ShelfBoxes position={[0, 0, -1]} rotation={[0, 0, 0]} />
          <ShelfBoxes position={[0, 0, 1]} rotation={[0, 0, 0]} />
          <ShelfBoxes position={[0, 0, 3]} rotation={[0, 0, 0]} />
        </group>
        {/* Right side of aisle */}
        <group position={[1, 0, 0]}>
          <ShelfBoxes position={[0, 0, -3]} rotation={[0, Math.PI, 0]} />
          <ShelfBoxes position={[0, 0, -1]} rotation={[0, Math.PI, 0]} />
          <ShelfBoxes position={[0, 0, 1]} rotation={[0, Math.PI, 0]} />
          <ShelfBoxes position={[0, 0, 3]} rotation={[0, Math.PI, 0]} />
        </group>
        {/* End caps */}
        <ShelfEnd position={[0.5, 0, -4]} rotation={[0, Math.PI/2, 0]} />
        <ShelfEnd position={[0.5, 0, 4]} rotation={[0, -Math.PI/2, 0]} />
      </group>

      {/* Aisle 2 */}
      <group position={[0, 0, 0]}>
        {/* Left side of aisle */}
        <group position={[0, 0, 0]}>
          <ShelfBags position={[0, 0, -3]} rotation={[0, 0, 0]} />
          <ShelfBags position={[0, 0, -1]} rotation={[0, 0, 0]} />
          <ShelfBags position={[0, 0, 1]} rotation={[0, 0, 0]} />
          <ShelfBags position={[0, 0, 3]} rotation={[0, 0, 0]} />
        </group>
        {/* Right side of aisle */}
        <group position={[1, 0, 0]}>
          <ShelfBags position={[0, 0, -3]} rotation={[0, Math.PI, 0]} />
          <ShelfBags position={[0, 0, -1]} rotation={[0, Math.PI, 0]} />
          <ShelfBags position={[0, 0, 1]} rotation={[0, Math.PI, 0]} />
          <ShelfBags position={[0, 0, 3]} rotation={[0, Math.PI, 0]} />
        </group>
        {/* End caps */}
        <ShelfEnd position={[0.5, 0, -4]} rotation={[0, Math.PI/2, 0]} />
        <ShelfEnd position={[0.5, 0, 4]} rotation={[0, -Math.PI/2, 0]} />
      </group>

      {/* Aisle 3 */}
      <group position={[3, 0, 0]}>
        {/* Left side of aisle */}
        <group position={[0, 0, 0]}>
          <ShelfBoxes position={[0, 0, -3]} rotation={[0, 0, 0]} />
          <ShelfBoxes position={[0, 0, -1]} rotation={[0, 0, 0]} />
          <ShelfBoxes position={[0, 0, 1]} rotation={[0, 0, 0]} />
          <ShelfBoxes position={[0, 0, 3]} rotation={[0, 0, 0]} />
        </group>
        {/* Right side of aisle */}
        <group position={[1, 0, 0]}>
          <ShelfBoxes position={[0, 0, -3]} rotation={[0, Math.PI, 0]} />
          <ShelfBoxes position={[0, 0, -1]} rotation={[0, Math.PI, 0]} />
          <ShelfBoxes position={[0, 0, 1]} rotation={[0, Math.PI, 0]} />
          <ShelfBoxes position={[0, 0, 3]} rotation={[0, Math.PI, 0]} />
        </group>
        {/* End caps */}
        <ShelfEnd position={[0.5, 0, -4]} rotation={[0, Math.PI/2, 0]} />
        <ShelfEnd position={[0.5, 0, 4]} rotation={[0, -Math.PI/2, 0]} />
      </group>

      {/* Produce section along the wall */}
      <group position={[-4.5, 0, 0]}>
        <DisplayFruit position={[0, 0, -3]} rotation={[0, -Math.PI/2, 0]} />
        <DisplayFruit position={[0, 0, -1]} rotation={[0, -Math.PI/2, 0]} />
        <DisplayFruit position={[0, 0, 1]} rotation={[0, -Math.PI/2, 0]} />
        <DisplayFruit position={[0, 0, 3]} rotation={[0, -Math.PI/2, 0]} />
      </group>
    </group>
  );
}

function Scene() {
  return (
    <>
      <Lighting />
      <Floor />
      <Walls />
      <Shelves />
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