import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from "react";
import { Canvas, useLoader, useFrame, extend } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Environment,
  PerspectiveCamera,
  Text,
  shaderMaterial,
} from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader";
import * as THREE from "three";
import "./App.css";

// Create a custom outline shader material
const OutlineMaterial = shaderMaterial(
  {
    color: new THREE.Color("#ffffff"),
    thickness: 0.03,
  },
  // Vertex shader
  `
    uniform float thickness;
    
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vec4 viewPosition = viewMatrix * worldPosition;
      
      // Move vertex along normal direction
      vec3 normal = normalize(normalMatrix * normal);
      viewPosition.xyz += normal * thickness;
      
      gl_Position = projectionMatrix * viewPosition;
    }
  `,
  // Fragment shader
  `
    uniform vec3 color;
    
    void main() {
      gl_FragColor = vec4(color, 1.0);
    }
  `
);

// Extend Three.js with our custom material
extend({ OutlineMaterial });

// Add type declarations for the custom material
declare global {
  namespace JSX {
    interface IntrinsicElements {
      outlineMaterial: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        color?: THREE.Color;
        thickness?: number;
        transparent?: boolean;
      };
    }
  }

  interface Window {
    gameState?: typeof gameState;
    updateItemsFromGameState?: () => void;
  }
}

// Define item types with their properties
const ITEM_TYPES = [
  {
    name: "Cereal",
    color: "#e3c04d",
    scale: [0.25, 0.35, 0.2] as [number, number, number],
  },
  {
    name: "Milk",
    color: "#f0f0f0",
    scale: [0.2, 0.3, 0.2] as [number, number, number],
  },
  {
    name: "Soup",
    color: "#d35400",
    scale: [0.2, 0.25, 0.2] as [number, number, number],
  },
  {
    name: "Pasta",
    color: "#f39c12",
    scale: [0.25, 0.3, 0.15] as [number, number, number],
  },
  {
    name: "Beans",
    color: "#27ae60",
    scale: [0.2, 0.25, 0.2] as [number, number, number],
  },
  {
    name: "Juice",
    color: "#e74c3c",
    scale: [0.2, 0.35, 0.2] as [number, number, number],
  },
];

// Define shelf positions for our aisle
const SHELF_POSITIONS = [
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

// Interface for item objects
interface Item {
  id: number;
  type: (typeof ITEM_TYPES)[number];
  position: [number, number, number];
  onShelf: boolean;
  targetShelf: { x: number; z: number };
}

// Game state context
interface GameStateContextType {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  playerHoldingItem: Item | null;
  setPlayerHoldingItem: React.Dispatch<React.SetStateAction<Item | null>>;
  nextItemId: number;
  setNextItemId: React.Dispatch<React.SetStateAction<number>>;
  stolenItems: number;
  setStolenItems: React.Dispatch<React.SetStateAction<number>>;
}

const GameStateContext = createContext<GameStateContextType | null>(null);

// Custom hook to use game state
function useGameState() {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error("useGameState must be used within a GameStateProvider");
  }
  return context;
}

// Global state for backward compatibility
const gameState = {
  items: [] as Item[],
  nextItemId: 0,
  playerHoldingItem: null as Item | null,
  score: 0,
  characterPosition: null as [number, number, number] | null,
  highlightedShelf: null as { x: number; z: number } | null,
  thiefTargetItem: null as number | null, // ID of the item the thief is targeting
  shelfEffects: [] as {
    position: { x: number; z: number };
    itemType: (typeof ITEM_TYPES)[number];
    createdAt: number;
  }[],
  isPlacingItem: false, // Flag to indicate if an item is currently being placed
};

// Function to check if character is near an item
function isNearItem(
  characterPosition: [number, number, number],
  item: Item
): boolean {
  const dx = characterPosition[0] - item.position[0];
  const dz = characterPosition[2] - item.position[2];
  const distance = Math.sqrt(dx * dx + dz * dz);
  return distance < 0.5; // Pickup radius
}

// Function to check if character is near a shelf
function isNearShelf(
  characterPosition: [number, number, number],
  targetShelf?: { x: number; z: number }
): { x: number; z: number } | null {
  // If a specific shelf is provided, only check that one
  if (targetShelf) {
    const dx = characterPosition[0] - targetShelf.x;
    const dz = characterPosition[2] - targetShelf.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < 0.8) {
      // Placement radius
      return targetShelf;
    }
    return null;
  }

  // Otherwise check all shelves
  for (const shelf of SHELF_POSITIONS) {
    const dx = characterPosition[0] - shelf.x;
    const dz = characterPosition[2] - shelf.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < 0.8) {
      // Placement radius
      return shelf;
    }
  }

  return null;
}

// Function to spawn a random item in the world
function spawnRandomItem(): Item {
  const bounds = 4;
  let x, z;
  let attempts = 0;
  const maxAttempts = 20;

  // Try to find a valid position
  do {
    x = Math.random() * bounds * 2 - bounds;
    z = Math.random() * bounds * 2 - bounds;
    attempts++;

    // If we've tried too many times, just place it somewhere
    if (attempts >= maxAttempts) {
      console.log("Max attempts reached, placing item anyway");
      break;
    }
  } while (checkCollisionWithShelves(x, z));

  // Assign a random target shelf
  const targetShelf =
    SHELF_POSITIONS[Math.floor(Math.random() * SHELF_POSITIONS.length)];

  // Create new item
  const randomType = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
  const newItem: Item = {
    id: gameState.nextItemId++,
    type: randomType,
    position: [x, 0.2, z] as [number, number, number],
    onShelf: false,
    targetShelf: targetShelf,
  };

  // Add to game state
  gameState.items.push(newItem);
  console.log("Spawned item:", newItem);

  return newItem;
}

// Item component to represent pickable items
function ItemObject({ item }: { item: Item }) {
  const { playerHoldingItem } = useGameState();
  const meshRef = useRef<THREE.Mesh>(null);
  const outlineRef = useRef<THREE.Mesh>(null);
  const [isNearPlayer, setIsNearPlayer] = useState(false);
  const [isThiefTarget, setIsThiefTarget] = useState(false);
  const [pulseValue, setPulseValue] = useState(0);
  const [floatOffset, setFloatOffset] = useState(0);

  // Floating animation and check if near player
  useFrame(({ clock }) => {
    if (meshRef.current && !item.onShelf && playerHoldingItem?.id !== item.id) {
      // Enhanced floating animation - more pronounced
      const floatHeight = Math.sin(clock.getElapsedTime() * 1.2) * 0.1;
      setFloatOffset(floatHeight);

      // Apply floating to the item
      meshRef.current.position.y = floatHeight;

      if (outlineRef.current) {
        // Sync outline with item position
        outlineRef.current.position.y = floatHeight;

        // Pulsing animation for outline
        const pulse = Math.sin(clock.getElapsedTime() * 4) * 0.5 + 0.5; // 0 to 1 pulsing
        setPulseValue(pulse);
      }

      // Check if near player to show outline
      const characterPosition = gameState.characterPosition;
      if (characterPosition) {
        const isNear = isNearItem(characterPosition, item);
        setIsNearPlayer(isNear);
      }

      // Check if this item is the thief's target
      setIsThiefTarget(gameState.thiefTargetItem === item.id);
    }
  });

  // Don't render if player is holding this item or if an item is being placed
  if (
    playerHoldingItem?.id === item.id ||
    (gameState.isPlacingItem && playerHoldingItem?.id === item.id)
  ) {
    return null;
  }

  // Calculate outline scale - make it larger and pulsing
  const outlineScale = item.type.scale.map(
    (v) => v * (1.25 + pulseValue * 0.1)
  ) as [number, number, number];

  // Add a slight rotation to the floating items
  const floatRotation = [
    Math.sin(Date.now() * 0.001) * 0.05,
    Math.cos(Date.now() * 0.0015) * 0.05,
    0,
  ] as [number, number, number];

  return (
    <group
      position={[item.position[0], item.position[1] + 0.2, item.position[2]]}
    >
      {/* Double outline effect when player is near */}
      {isNearPlayer && !item.onShelf && (
        <>
          {/* Outer glow */}
          <mesh ref={outlineRef} scale={outlineScale} rotation={floatRotation}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent={true}
              opacity={0.7 + pulseValue * 0.3}
              side={THREE.BackSide}
            />
          </mesh>

          {/* Inner outline */}
          <mesh
            scale={
              item.type.scale.map((v) => v * 1.1) as [number, number, number]
            }
            rotation={floatRotation}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent={true}
              opacity={0.5}
              side={THREE.BackSide}
            />
          </mesh>
        </>
      )}

      {/* Thief target indicator */}
      {isThiefTarget && !item.onShelf && (
        <mesh
          scale={
            item.type.scale.map((v) => v * 1.3) as [number, number, number]
          }
          rotation={floatRotation}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color="#ff0000"
            transparent={true}
            opacity={0.3 + pulseValue * 0.3}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* The actual item */}
      <mesh ref={meshRef} scale={item.type.scale} rotation={floatRotation}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={item.type.color} />
      </mesh>
    </group>
  );
}

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
  // Check collision with each shelf
  for (const shelf of SHELF_POSITIONS) {
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
  const {
    items,
    setItems,
    playerHoldingItem,
    setPlayerHoldingItem,
    score,
    setScore,
    nextItemId,
    setNextItemId,
  } = useGameState();
  const characterRef = useRef<THREE.Group>();

  // Add a ref to track if we're currently placing an item
  // This will help prevent race conditions between state updates
  const isPlacingItem = useRef(false);

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

  // Convert refs to React state
  const [position, setPosition] = useState<[number, number, number]>([
    0, 0.15, 0,
  ]);
  const [rotation, setRotation] = useState<number>(0);
  const [targetRotation, setTargetRotation] = useState<number>(0);
  const [walkingTime, setWalkingTime] = useState<number>(0);
  const [idleTime, setIdleTime] = useState<number>(0);

  // Keep refs for frequently changing values that don't need to trigger re-renders
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Constants
  const baseSpeed = 0.035;
  const rotationSpeed = 0.15;
  const walkingAmplitude = 0.08;
  const walkingFrequency = 10;
  const idleAmplitude = 0.02;
  const idleFrequency = 2;
  const baseHeight = 0.15;

  // Update global character position for item interaction
  useEffect(() => {
    gameState.characterPosition = position;
  }, [position]);

  // Simplified item interaction
  const handleItemInteraction = useCallback(() => {
    if (playerHoldingItem) {
      // Try to place item on shelf
      const nearbyShelf = isNearShelf(position, playerHoldingItem.targetShelf);
      if (nearbyShelf) {
        // Set the placing flag to true to prevent useFrame from updating the item
        isPlacingItem.current = true;
        gameState.isPlacingItem = true;

        // Store a reference to the current item before clearing it
        const placedItem = { ...playerHoldingItem };

        // Clear held item and highlighted shelf FIRST to prevent race conditions
        setPlayerHoldingItem(null);
        gameState.highlightedShelf = null;

        // Then remove the item from the items array
        setItems((currentItems) =>
          currentItems.filter((item) => item.id !== placedItem.id)
        );

        // Show a brief visual effect at the shelf position
        createShelfPlacementEffect(nearbyShelf);

        // Update score
        setScore((s) => s + 10);

        // Spawn a new item
        const bounds = 4;
        let x, z;
        let attempts = 0;
        const maxAttempts = 20;
        
        // Try to find a valid position that's not on a shelf
        do {
          x = Math.random() * bounds * 2 - bounds;
          z = Math.random() * bounds * 2 - bounds;
          attempts++;
          
          // If we've tried too many times, just place it somewhere
          if (attempts >= maxAttempts) {
            console.log("Max attempts reached, placing item anyway");
            break;
          }
        } while (checkCollisionWithShelves(x, z));

        // Assign a random target shelf
        const targetShelf =
          SHELF_POSITIONS[Math.floor(Math.random() * SHELF_POSITIONS.length)];

        const newItem: Item = {
          id: nextItemId,
          type: ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)],
          position: [x, 0.2, z] as [number, number, number],
          onShelf: false,
          targetShelf: targetShelf,
        };

        setItems((currentItems) => [...currentItems, newItem]);
        setNextItemId((id) => id + 1);

        // Reset the placing flags after a short delay to ensure all state updates have completed
        setTimeout(() => {
          isPlacingItem.current = false;
          gameState.isPlacingItem = false;
        }, 100);
      }
    } else {
      // Try to pick up an item
      const itemToPickup = items.find(
        (item) => !item.onShelf && isNearItem(position, item)
      );

      if (itemToPickup) {
        setPlayerHoldingItem(itemToPickup);

        // Highlight the target shelf
        gameState.highlightedShelf = itemToPickup.targetShelf;
      }
    }
  }, [
    playerHoldingItem,
    position,
    items,
    setPlayerHoldingItem,
    setItems,
    setScore,
    nextItemId,
    setNextItemId,
  ]);

  // Add a utility function for playing sounds
  function playSound(url: string) {
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch((error) => {
      console.error("Error playing sound:", error);
    });
  }

  // Function to create a visual effect when an item is placed on a shelf
  const createShelfPlacementEffect = (shelfPosition: {
    x: number;
    z: number;
  }) => {
    if (gameState.playerHoldingItem) {
      // Add a new effect to the gameState
      gameState.shelfEffects.push({
        position: shelfPosition,
        itemType: gameState.playerHoldingItem.type,
        createdAt: Date.now(),
      });

      // Remove old effects after 2 seconds to prevent memory leaks
      setTimeout(() => {
        if (gameState.shelfEffects.length > 0) {
          gameState.shelfEffects.shift();
        }
      }, 2000);

      // Play a success sound
      playSound("/assets/sounds/success.mp3");
    }
  };

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

      // Handle item interaction with space key
      if (e.key === " ") {
        handleItemInteraction();
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
  }, [handleItemInteraction]);

  useFrame(({ camera }, delta) => {
    if (!characterRef.current) return;

    const moveForward =
      keysPressed.current["w"] || keysPressed.current["arrowup"];
    const moveBackward =
      keysPressed.current["s"] || keysPressed.current["arrowdown"];
    const moveLeft =
      keysPressed.current["a"] || keysPressed.current["arrowleft"];
    const moveRight =
      keysPressed.current["d"] || keysPressed.current["arrowright"];

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
        if (moveBackward && moveLeft) moveAngle = (Math.PI * 3) / 4;
        if (moveBackward && moveRight) moveAngle = (-Math.PI * 3) / 4;
      }

      // Adjust movement angle based on camera rotation
      moveAngle = (moveAngle + cameraAngle + Math.PI) % (Math.PI * 2);
    }

    // Update animation timers
    let newWalkingTime = walkingTime;
    let newIdleTime = idleTime;

    if (moving) {
      newWalkingTime += delta * walkingFrequency;
    } else {
      newWalkingTime = 0;
    }
    newIdleTime += delta * idleFrequency;

    setWalkingTime(newWalkingTime);
    setIdleTime(newIdleTime);

    if (moving) {
      // Calculate new position
      const newX = position[0] + Math.sin(moveAngle) * baseSpeed;
      const newZ = position[2] + Math.cos(moveAngle) * baseSpeed;

      // Only update position if there's no collision
      if (!checkCollisionWithShelves(newX, newZ)) {
        // Update position with boundary checks
        const bounds = 4.5;
        setPosition([
          Math.max(-bounds, Math.min(bounds, newX)),
          baseHeight,
          Math.max(-bounds, Math.min(bounds, newZ)),
        ]);
      }

      // Update target rotation to face movement direction
      if (moving) {
        // Calculate the shortest rotation path
        let newTargetRotation = moveAngle;
        let rotationDiff = newTargetRotation - rotation;

        // Normalize the rotation difference to [-π, π]
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

        // Set the target rotation using the shortest path
        setTargetRotation(rotation + rotationDiff);
      }
    }

    // Apply animations
    const walkingOffset = moving
      ? Math.sin(newWalkingTime) * walkingAmplitude
      : 0;
    const idleOffset = Math.sin(newIdleTime) * idleAmplitude;
    const finalY = baseHeight + Math.abs(walkingOffset) + Math.abs(idleOffset);

    // Set position with animations
    characterRef.current.position.set(position[0], finalY, position[2]);

    // Add slight tilt when walking
    const tiltAmount = moving ? Math.sin(newWalkingTime) * 0.1 : 0;
    characterRef.current.rotation.z = tiltAmount;

    // Smooth rotation for turning
    const currentRotation = rotation;
    let rotationDiff = targetRotation - currentRotation;

    // Normalize the rotation difference to the shortest path
    if (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    if (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    // Apply smooth rotation
    const newRotation = rotation + rotationDiff * rotationSpeed;
    setRotation(newRotation);
    characterRef.current.rotation.y = newRotation;

    // If holding an item, update its position to follow the character
    // Only update if we're not currently placing an item
    if (playerHoldingItem && !isPlacingItem.current) {
      // Position the item in the character's hands
      const itemOffsetDistance = 0.4;
      const itemOffsetX = Math.sin(newRotation) * itemOffsetDistance;
      const itemOffsetZ = Math.cos(newRotation) * itemOffsetDistance;

      // Calculate new position
      const newItemPosition: [number, number, number] = [
        position[0] + itemOffsetX,
        finalY + 0.1, // Use character's animated height plus small offset
        position[2] + itemOffsetZ,
      ];

      // Only update if position has changed significantly
      const positionChanged =
        Math.abs(playerHoldingItem.position[0] - newItemPosition[0]) > 0.01 ||
        Math.abs(playerHoldingItem.position[1] - newItemPosition[1]) > 0.01 ||
        Math.abs(playerHoldingItem.position[2] - newItemPosition[2]) > 0.01;

      if (positionChanged) {
        // Update the held item with new position
        const updatedHeldItem = {
          ...playerHoldingItem,
          position: newItemPosition,
        };

        setPlayerHoldingItem(updatedHeldItem);
      }
    }
  });

  // Render held item without text
  const renderHeldItem = useCallback(() => {
    // Only render if we have a held item and we're not currently placing it
    if (!playerHoldingItem || isPlacingItem.current) return null;

    const itemOffsetDistance = 0.4;
    const itemOffsetX = Math.sin(rotation) * itemOffsetDistance;
    const itemOffsetZ = Math.cos(rotation) * itemOffsetDistance;

    const itemPosition: [number, number, number] = [
      position[0] + itemOffsetX,
      position[1] + 0.3,
      position[2] + itemOffsetZ,
    ];

    return (
      <group position={itemPosition} rotation={[0, rotation, 0]}>
        <mesh scale={playerHoldingItem.type.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={playerHoldingItem.type.color} />
        </mesh>
      </group>
    );
  }, [playerHoldingItem, position, rotation, isPlacingItem]);

  return (
    <>
      <primitive
        ref={characterRef}
        object={obj.clone()}
        position={[0, 0, 0]}
        scale={[0.8, 0.8, 0.8]}
      />

      {renderHeldItem()}
    </>
  );
}

// Game state provider component
function GameStateProvider({ children }: { children: React.ReactNode }) {
  // Simple state management - no fancy stuff
  const [items, setItems] = useState<Item[]>([]);
  const [score, setScore] = useState(0);
  const [playerHoldingItem, setPlayerHoldingItem] = useState<Item | null>(null);
  const [nextItemId, setNextItemId] = useState(0);
  const [stolenItems, setStolenItems] = useState(0);

  // Initialize with 5 items
  useEffect(() => {
    if (items.length === 0) {
      const initialItems: Item[] = [];

      for (let i = 0; i < 5; i++) {
        const bounds = 4;
        let x, z;
        let attempts = 0;
        const maxAttempts = 20;
        
        // Try to find a valid position that's not on a shelf
        do {
          x = Math.random() * bounds * 2 - bounds;
          z = Math.random() * bounds * 2 - bounds;
          attempts++;
          
          // If we've tried too many times, just place it somewhere
          if (attempts >= maxAttempts) {
            console.log("Max attempts reached, placing item anyway");
            break;
          }
        } while (checkCollisionWithShelves(x, z));

        // Assign a random target shelf
        const targetShelf =
          SHELF_POSITIONS[Math.floor(Math.random() * SHELF_POSITIONS.length)];

        initialItems.push({
          id: i,
          type: ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)],
          position: [x, 0.2, z] as [number, number, number],
          onShelf: false,
          targetShelf: targetShelf,
        });
      }

      setItems(initialItems);
      setNextItemId(5);
    }
  }, [items.length]);

  const value = {
    items,
    setItems,
    score,
    setScore,
    playerHoldingItem,
    setPlayerHoldingItem,
    nextItemId,
    setNextItemId,
    stolenItems,
    setStolenItems,
  };

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

// Component to display a visual effect when an item is placed on a shelf
function ShelfPlacementEffect({
  position,
  itemType,
}: {
  position: { x: number; z: number };
  itemType: (typeof ITEM_TYPES)[number];
}) {
  const [scale, setScale] = useState(0.1);
  const [opacity, setOpacity] = useState(1.0);

  // Animation effect
  useFrame(() => {
    // Increase scale and decrease opacity over time
    setScale((prev) => Math.min(prev + 0.03, 1.5));
    setOpacity((prev) => Math.max(prev - 0.02, 0));
  });

  return (
    <group position={[position.x, 0.5, position.z]}>
      {/* Success indicator */}
      <mesh scale={[scale, scale, scale]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial
          color="#00ff00"
          transparent={true}
          opacity={opacity}
        />
      </mesh>

      {/* Item silhouette */}
      <mesh
        scale={itemType.scale.map((v) => v * scale) as [number, number, number]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={itemType.color}
          transparent={true}
          opacity={opacity * 0.7}
        />
      </mesh>

      {/* Text label */}
      <group visible={opacity > 0.1}>
        <Text
          position={[0, 0.5 * scale, 0]}
          fontSize={0.2 * scale}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#00aa00"
        >
          +10
        </Text>
      </group>
    </group>
  );
}

// Simplified GameManager - just renders items and score
function GameManager() {
  const { items, score } = useGameState();
  const [highlightedShelf, setHighlightedShelf] = useState<{
    x: number;
    z: number;
  } | null>(null);
  const [shelfEffects, setShelfEffects] = useState<
    {
      position: { x: number; z: number };
      itemType: (typeof ITEM_TYPES)[number];
      createdAt: number;
    }[]
  >([]);

  // Update the highlighted shelf and shelf effects from gameState
  useFrame(() => {
    setHighlightedShelf(gameState.highlightedShelf);
    setShelfEffects([...gameState.shelfEffects]);
  });

  return (
    <group>
      {/* Render all items */}
      {items.map((item) => (
        <ItemObject key={item.id} item={item} />
      ))}

      {/* Render highlighted target shelf */}
      {highlightedShelf && <TargetShelf position={highlightedShelf} />}

      {/* Render shelf placement effects */}
      {shelfEffects.map((effect, index) => (
        <ShelfPlacementEffect
          key={`effect-${effect.createdAt}-${index}`}
          position={effect.position}
          itemType={effect.itemType}
        />
      ))}
    </group>
  );
}

// Add a TargetShelf component to highlight the target shelf
function TargetShelf({ position }: { position: { x: number; z: number } }) {
  const [pulseValue, setPulseValue] = useState(0);

  // Pulsing animation for the highlight
  useFrame(({ clock }) => {
    const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.5 + 0.5; // 0 to 1 pulsing
    setPulseValue(pulse);
  });

  return (
    <group position={[position.x, 0.5, position.z]}>
      {/* Highlight effect */}
      <mesh scale={[1.2, 1.2, 1.2]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color="#ffff00"
          transparent={true}
          opacity={0.3 + pulseValue * 0.3}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

// Thief character that steals items
function Thief() {
  const { items, setItems, stolenItems, setStolenItems, playerHoldingItem } =
    useGameState();

  const thiefRef = useRef<THREE.Group>();
  const materials = useLoader(
    MTLLoader,
    "/assets/CharacterModels/character-male-f.mtl"
  );
  const obj = useLoader(
    OBJLoader,
    "/assets/CharacterModels/character-male-f.obj",
    (loader: OBJLoader) => {
      materials.preload();
      loader.setMaterials(materials);
    }
  );

  // Calculate door position based on the Walls component
  const size = 10;
  const spacing = 1;
  const offset = (size * spacing) / 2 - spacing / 2;
  const doorPosition: [number, number, number] = [
    -offset - spacing,
    0.15,
    3 - offset,
  ]; // Door is at z=3

  // Thief state
  const [position, setPosition] =
    useState<[number, number, number]>(doorPosition); // Start at the door position
  const [rotation, setRotation] = useState<number>(Math.PI / 2); // Face inward
  const [targetPosition, setTargetPosition] =
    useState<[number, number, number]>(doorPosition);
  const [thiefState, setThiefState] = useState<
    "entering" | "searching" | "stealing" | "escaping" | "waiting" | "fleeing"
  >("waiting");
  const [targetItem, setTargetItem] = useState<Item | null>(null);
  const [thiefHoldingItem, setThiefHoldingItem] = useState<Item | null>(null);
  const [walkingTime, setWalkingTime] = useState<number>(0);
  const [waitTimer, setWaitTimer] = useState<number>(10); // Wait 10 seconds before entering
  const [fleeingCooldown, setFleeingCooldown] = useState<number>(0); // Cooldown after being caught

  // Constants
  const thiefSpeed = 0.025;
  const fleeingSpeed = 0.07; // Even faster when fleeing
  const baseHeight = 0.15;
  const walkingAmplitude = 0.08;
  const walkingFrequency = 12; // Faster animation
  const playerCollisionRadius = 0.7; // How close the player needs to be to catch the thief

  // Initialize thief behavior
  useEffect(() => {
    // Start the thief in waiting state
    setThiefState("waiting");
  }, []);

  // Update the global state with the thief's target item
  useEffect(() => {
    gameState.thiefTargetItem = targetItem?.id || null;
  }, [targetItem]);

  // Main thief behavior loop
  useFrame((_, delta) => {
    if (!thiefRef.current) return;

    // Update walking animation
    setWalkingTime((prev) => prev + delta * walkingFrequency);
    const walkingOffset = Math.sin(walkingTime) * walkingAmplitude;
    const finalY = baseHeight + Math.abs(walkingOffset);

    // Apply position and animation
    thiefRef.current.position.set(position[0], finalY, position[2]);

    // Add slight tilt when walking
    const tiltAmount = Math.sin(walkingTime) * 0.1;
    thiefRef.current.rotation.z = tiltAmount;

    // Check if target item has been picked up by player
    if (
      targetItem &&
      playerHoldingItem &&
      playerHoldingItem.id === targetItem.id &&
      thiefState === "searching"
    ) {
      // Player picked up our target item, find a new one
      setTargetItem(null);
    }

    // Check for collision with player
    const characterPosition = gameState.characterPosition;
    if (
      characterPosition &&
      thiefState !== "waiting" &&
      thiefState !== "fleeing"
    ) {
      const dx = position[0] - characterPosition[0];
      const dz = position[2] - characterPosition[2];
      const distanceToPlayer = Math.sqrt(dx * dx + dz * dz);

      // If player catches the thief
      if (distanceToPlayer < playerCollisionRadius) {
        // If thief is holding an item, drop it
        if (thiefHoldingItem) {
          // Add the item back to the game at the thief's current position
          const droppedItem = {
            ...thiefHoldingItem,
            position: [...position] as [number, number, number],
          };

          setItems((currentItems) => [...currentItems, droppedItem]);
          setThiefHoldingItem(null);

          // Decrement stolen items count
          setStolenItems((prev) => Math.max(0, prev - 1));

          // Show message
          console.log("You caught the thief! Item recovered!");
        } else {
          // Show message even if thief wasn't holding an item
          console.log("You scared away the thief!");
        }

        // Set thief to fleeing state
        setThiefState("fleeing");

        // Run away to the door
        setTargetPosition(doorPosition);
        setFleeingCooldown(5); // Set cooldown before thief returns
      }
    }

    // State machine for thief behavior
    switch (thiefState) {
      case "waiting":
        // Wait for a while before entering
        setWaitTimer((prev) => {
          if (prev <= 0) {
            setThiefState("entering");
            // Reset position to behind the door
            setPosition(doorPosition);
            return 10; // Reset timer for next time
          }
          return prev - delta;
        });
        break;

      case "entering":
        // First move into the store through the door
        const storeEntryPoint: [number, number, number] = [
          -offset,
          baseHeight,
          3 - offset,
        ]; // Just inside the door

        // Check if we've reached the entry point
        const distanceToEntry = Math.sqrt(
          Math.pow(position[0] - storeEntryPoint[0], 2) +
            Math.pow(position[2] - storeEntryPoint[2], 2)
        );

        if (distanceToEntry < 0.1) {
          // Now move to a random position in the store
          const randomX = Math.random() * 3 - 1.5;
          const randomZ = Math.random() * 3 - 1.5;
          setTargetPosition([randomX, baseHeight, randomZ]);
          setThiefState("searching");
        } else {
          // Keep moving toward the entry point
          setTargetPosition(storeEntryPoint);
        }
        break;

      case "searching":
        // Find the nearest item to steal
        if (!targetItem) {
          // Only consider items that are not on shelves and not being held by the player
          const availableItems = items.filter(
            (item) =>
              !item.onShelf &&
              (!playerHoldingItem || item.id !== playerHoldingItem.id)
          );

          if (availableItems.length > 0) {
            // Find closest item
            let closestItem = availableItems[0];
            let closestDistance = Infinity;

            availableItems.forEach((item) => {
              const dx = position[0] - item.position[0];
              const dz = position[2] - item.position[2];
              const distance = Math.sqrt(dx * dx + dz * dz);

              if (distance < closestDistance) {
                closestDistance = distance;
                closestItem = item;
              }
            });

            setTargetItem(closestItem);
            setTargetPosition([
              closestItem.position[0],
              baseHeight,
              closestItem.position[2],
            ]);
          } else {
            // No items to steal, escape
            setThiefState("escaping");
            setTargetPosition(doorPosition);
          }
        } else {
          // Check if the target item is still valid (not picked up by player)
          if (playerHoldingItem && playerHoldingItem.id === targetItem.id) {
            // Player picked up our target item, find a new one
            setTargetItem(null);
            break;
          }

          // Check if we've reached the target item
          const dx = position[0] - targetItem.position[0];
          const dz = position[2] - targetItem.position[2];
          const distance = Math.sqrt(dx * dx + dz * dz);

          if (distance < 0.5) {
            // Steal the item
            setThiefHoldingItem(targetItem);

            // Remove item from the game
            setItems((currentItems) =>
              currentItems.filter((item) => item.id !== targetItem.id)
            );

            // Update stolen items count
            setStolenItems((prev) => prev + 1);

            // Escape with the item
            setThiefState("escaping");
            setTargetPosition(doorPosition);
          }
        }
        break;

      case "escaping":
        // Escape through the door
        const escapePoint = doorPosition;

        // Check if we've reached the escape point
        const escapeDistance = Math.sqrt(
          Math.pow(position[0] - escapePoint[0], 2) +
            Math.pow(position[2] - escapePoint[2], 2)
        );

        if (escapeDistance < 0.5) {
          // Reset thief state
          setThiefState("waiting");
          setTargetItem(null);
          setThiefHoldingItem(null);
          setPosition(doorPosition);
        }
        break;

      case "fleeing":
        // Check if we've reached the flee point (door)
        const fleeDistance = Math.sqrt(
          Math.pow(position[0] - doorPosition[0], 2) +
            Math.pow(position[2] - doorPosition[2], 2)
        );

        const isOutsideStore =
          Math.abs(position[0]) > 4.5 || Math.abs(position[2]) > 4.5;

        if (fleeDistance < 0.5 || isOutsideStore) {
          // Update fleeing cooldown
          setFleeingCooldown((prev) => {
            if (prev <= 0) {
              // Reset thief state after cooldown
              setThiefState("waiting");
              setTargetItem(null);
              setPosition(doorPosition);
              return 0;
            }
            return prev - delta;
          });
        } else {
          // Set target to the door
          setTargetPosition(doorPosition);
        }
        break;
    }

    // Move towards target position if not waiting
    if (thiefState !== "waiting") {
      // Calculate direction to target
      const dirX = targetPosition[0] - position[0];
      const dirZ = targetPosition[2] - position[2];
      const length = Math.sqrt(dirX * dirX + dirZ * dirZ);

      // Only move if we're not already at the target
      if (length > 0.1) {
        // Normalize direction and apply speed
        const normalizedDirX = dirX / length;
        const normalizedDirZ = dirZ / length;

        // Use faster speed when fleeing
        const currentSpeed =
          thiefState === "fleeing" ? fleeingSpeed : thiefSpeed;

        // Calculate new position
        const newX = position[0] + normalizedDirX * currentSpeed;
        const newZ = position[2] + normalizedDirZ * currentSpeed;

        // Update position - no collision check for the thief
        setPosition([newX, baseHeight, newZ]);

        // Update rotation to face movement direction
        const targetRotation = Math.atan2(normalizedDirX, normalizedDirZ);
        setRotation(targetRotation);
        thiefRef.current.rotation.y = targetRotation;
      }
    }
  });

  // Render held item
  const renderStolenItem = () => {
    if (!thiefHoldingItem) return null;

    const itemOffsetDistance = 0.4;
    const itemOffsetX = Math.sin(rotation) * itemOffsetDistance;
    const itemOffsetZ = Math.cos(rotation) * itemOffsetDistance;

    const itemPosition: [number, number, number] = [
      position[0] + itemOffsetX,
      position[1] + 0.3,
      position[2] + itemOffsetZ,
    ];

    return (
      <group position={itemPosition} rotation={[0, rotation, 0]}>
        <mesh scale={thiefHoldingItem.type.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={thiefHoldingItem.type.color} />
        </mesh>
      </group>
    );
  };

  return (
    <>
      <primitive
        ref={thiefRef}
        object={obj.clone()}
        position={[0, 0, 0]}
        scale={[0.8, 0.8, 0.8]}
      />

      {renderStolenItem()}
    </>
  );
}

function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5, 5]} />
      <OrbitControls
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2 - 0.1}
        minDistance={2}
        maxDistance={10}
      />

      <Environment preset="city" />
      <Lighting />

      <Floor />
      <Walls />
      <Shelves />

      <Character />
      <Thief />

      <GameManager />
    </>
  );
}

function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <GameStateProvider>
        <Canvas camera={{ position: [10, 10, 10], fov: 50 }} shadows>
          <color attach="background" args={["#f0f0f0"]} />
          <Scene />
        </Canvas>
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <ScoreDisplay />
        </div>
      </GameStateProvider>
    </div>
  );
}

// Component to display score and stolen items
function ScoreDisplay() {
  const { score, stolenItems } = useGameState();

  return (
    <div style={{ fontSize: "18px" }}>
      <div>
        <span style={{ fontWeight: "bold", color: "#4CAF50" }}>Score:</span>{" "}
        {score}
      </div>
      <div>
        <span style={{ fontWeight: "bold", color: "#ff5555" }}>
          Items Stolen:
        </span>{" "}
        {stolenItems}
      </div>
    </div>
  );
}

export default App;
