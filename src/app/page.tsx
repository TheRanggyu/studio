"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Pause, Play } from 'lucide-react';

// Game constants
const GAME_HEIGHT = 500;
const GAME_WIDTH = 800;
const PLAYER_SIZE = 30;
const PLAYER_START_X = 150;
const GRAVITY = 0.5;
const JUMP_STRENGTH = 10;
const OBSTACLE_WIDTH = 40;
const SAW_SIZE = 40;
const JUMP_PAD_WIDTH = 60;
const JUMP_PAD_HEIGHT = 15;
const JUMP_PAD_BOOST = 15;
const OBJECT_SPEED = 4;
const OBSTACLE_GAP = 150;
const OBSTACLE_MIN_HEIGHT = 40;
const OBSTACLE_MAX_HEIGHT = GAME_HEIGHT - OBSTACLE_GAP - OBSTACLE_MIN_HEIGHT;
const OBJECT_INTERVAL = 1500; // in ms

type Obstacle = {
  type: 'obstacle';
  x: number;
  height: number; // height of the top obstacle
  passed: boolean;
};

type Saw = {
  type: 'saw';
  x: number;
  y: number;
  rotation: number;
  passed: boolean;
}

type JumpPad = {
  type: 'jumpPad';
  x: number;
  y: number;
  passed: boolean;
}

type GameObject = Obstacle | Saw | JumpPad;

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  type: 'sparkle' | 'explosion';
  size: number;
  color: string;
};

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);

  const [playerY, setPlayerY] = useState(GAME_HEIGHT / 2);
  const [gameObjects, setGameObjects] = useState<GameObject[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);

  const playerVelocityRef = useRef(0);
  const lastObjectTimeRef = useRef(0);
  const gameLoopRef = useRef<number>();
  const particleIdCounterRef = useRef(0);

  const createParticles = (count: number, x: number, y: number, type: 'sparkle' | 'explosion') => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = type === 'sparkle' ? Math.random() * 2 + 1 : Math.random() * 5 + 2;
      newParticles.push({
        id: particleIdCounterRef.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        opacity: 1,
        type,
        size: Math.random() * 3 + 2,
        color: type === 'sparkle' ? `hsl(${Math.random() * 60 + 200}, 100%, 70%)` : `hsl(${Math.random() * 40 + 10}, 100%, 50%)`
      });
    }
    setParticles(p => [...p, ...newParticles]);
  };

  const resetGame = useCallback(() => {
    setGameStarted(true);
    setGameOver(false);
    setIsPaused(false);
    setScore(0);
    setPlayerY(GAME_HEIGHT / 2);
    playerVelocityRef.current = 0;
    setGameObjects([]);
    setParticles([]);
    lastObjectTimeRef.current = performance.now();
  }, []);

  const jump = useCallback(() => {
    if (gameStarted && !gameOver && !isPaused) {
      playerVelocityRef.current = -JUMP_STRENGTH;
      createParticles(15, PLAYER_START_X + PLAYER_SIZE / 2, playerY + PLAYER_SIZE / 2, 'sparkle');
    }
  }, [gameStarted, gameOver, isPaused, playerY]);
  
  const togglePause = () => {
    if (gameOver || !gameStarted) return;
    setIsPaused(p => !p);
  };

  const gameLoop = useCallback(() => {
    if (isPaused) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // --- Player movement ---
    playerVelocityRef.current += GRAVITY;
    let newPlayerY = playerY + playerVelocityRef.current;
    
    setPlayerY(newPlayerY);

    // --- Particle movement ---
    setParticles(prevParticles => 
        prevParticles
            .map(p => ({
                ...p,
                x: p.x + p.vx,
                y: p.y + p.vy,
                opacity: p.opacity - 0.02,
            }))
            .filter(p => p.opacity > 0)
    );

    // --- Object movement and generation ---
    let scored = false;
    let newGameObjects = gameObjects.map(obj => {
      if (obj.type === 'saw') {
        return { ...obj, x: obj.x - OBJECT_SPEED, rotation: (obj.rotation + 10) % 360 };
      }
      return { ...obj, x: obj.x - OBJECT_SPEED };
    }).filter(obj => obj.x > -Math.max(OBSTACLE_WIDTH, SAW_SIZE, JUMP_PAD_WIDTH));

    const objectToScore = newGameObjects.find(
      obj => !obj.passed && obj.x + (obj.type === 'obstacle' ? OBSTACLE_WIDTH : obj.type === 'saw' ? SAW_SIZE : JUMP_PAD_WIDTH) < PLAYER_START_X
    );
    if (objectToScore && objectToScore.type !== 'jumpPad') {
      objectToScore.passed = true;
      scored = true;
    }
    
    if (performance.now() - lastObjectTimeRef.current > OBJECT_INTERVAL) {
      const random = Math.random();
      if (random < 0.6) { // 60% chance for regular obstacle
        const newObstacleHeight = Math.floor(Math.random() * (OBSTACLE_MAX_HEIGHT - OBSTACLE_MIN_HEIGHT + 1)) + OBSTACLE_MIN_HEIGHT;
        newGameObjects.push({ type: 'obstacle', x: GAME_WIDTH, height: newObstacleHeight, passed: false });
      } else if (random < 0.8) { // 20% chance for saw
        const sawY = Math.random() * (GAME_HEIGHT - SAW_SIZE);
        newGameObjects.push({ type: 'saw', x: GAME_WIDTH, y: sawY, rotation: 0, passed: false });
      } else { // 20% chance for jump pad
        const jumpPadY = Math.random() * (GAME_HEIGHT - 200) + 100; // avoid top/bottom edges
        newGameObjects.push({ type: 'jumpPad', x: GAME_WIDTH, y: jumpPadY, passed: false });
      }
      lastObjectTimeRef.current = performance.now();
    }
    setGameObjects(newGameObjects);

    if (scored) {
      setScore(s => s + 1);
    }
    
    // --- Collision detection ---
    if (newPlayerY >= GAME_HEIGHT - PLAYER_SIZE || newPlayerY <= 0) {
      createParticles(30, PLAYER_START_X + PLAYER_SIZE / 2, newPlayerY + PLAYER_SIZE / 2, 'explosion');
      setGameOver(true);
      return;
    }

    const playerRect = {
      x: PLAYER_START_X,
      y: newPlayerY,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
    };

    for (const obj of newGameObjects) {
      if (obj.type === 'obstacle') {
        const topObstacleRect = { x: obj.x, y: 0, width: OBSTACLE_WIDTH, height: obj.height };
        const bottomObstacleRect = { x: obj.x, y: obj.height + OBSTACLE_GAP, width: OBSTACLE_WIDTH, height: GAME_HEIGHT - obj.height - OBSTACLE_GAP };
        if ((playerRect.x < topObstacleRect.x + topObstacleRect.width && playerRect.x + playerRect.width > topObstacleRect.x && playerRect.y < topObstacleRect.y + topObstacleRect.height) ||
            (playerRect.x < bottomObstacleRect.x + bottomObstacleRect.width && playerRect.x + playerRect.width > bottomObstacleRect.x && playerRect.y + playerRect.height > bottomObstacleRect.y)) {
          createParticles(30, playerRect.x + playerRect.width / 2, playerRect.y + playerRect.height / 2, 'explosion');
          setGameOver(true);
          return;
        }
      } else if (obj.type === 'saw') {
        const dx = (playerRect.x + playerRect.width / 2) - (obj.x + SAW_SIZE / 2);
        const dy = (playerRect.y + playerRect.height / 2) - (obj.y + SAW_SIZE / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < playerRect.width / 2 + SAW_SIZE / 2) {
          createParticles(30, playerRect.x + playerRect.width / 2, playerRect.y + playerRect.height / 2, 'explosion');
          setGameOver(true);
          return;
        }
      } else if (obj.type === 'jumpPad') {
          const jumpPadRect = { x: obj.x, y: obj.y, width: JUMP_PAD_WIDTH, height: JUMP_PAD_HEIGHT };
          if (playerRect.x < jumpPadRect.x + jumpPadRect.width && playerRect.x + playerRect.width > jumpPadRect.x && playerRect.y + playerRect.height > jumpPadRect.y && playerRect.y < jumpPadRect.y + jumpPadRect.height && playerVelocityRef.current > 0) {
              playerVelocityRef.current = -JUMP_PAD_BOOST;
              createParticles(20, playerRect.x + playerRect.width / 2, obj.y, 'sparkle');
          }
      }
    }
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [playerY, gameObjects, isPaused]);


  useEffect(() => {
    if (gameStarted && !gameOver && !isPaused) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameStarted, gameOver, isPaused, gameLoop]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!gameStarted || gameOver) {
          resetGame();
        } else {
          jump();
        }
      }
      if (e.code === 'Escape') {
          togglePause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted, gameOver, resetGame, jump]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background p-4 font-body">
      <div
        className="relative bg-background rounded-lg shadow-2xl overflow-hidden border-4 border-primary/50"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      >
        <div className="absolute top-4 left-4 text-white text-4xl font-bold z-30" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
          Score: {score}
        </div>
        
        {gameStarted && !gameOver && (
            <Button onClick={togglePause} size="icon" variant="ghost" className="absolute top-4 right-4 z-30 text-white hover:bg-white/20 hover:text-white">
                {isPaused ? <Play /> : <Pause />}
            </Button>
        )}

        {(!gameStarted || gameOver || isPaused) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 space-y-6 text-center">
            {isPaused ? (
                 <h2 className="text-6xl font-extrabold text-primary animate-pulse">Paused</h2>
            ) : gameOver ? (
              <>
                <h2 className="text-6xl font-extrabold text-accent animate-pulse">Game Over</h2>
                <p className="text-3xl text-white">Your Score: {score}</p>
                <Button onClick={resetGame} size="lg" variant="default">
                  Restart Game
                </Button>
              </>
            ) : (
              <>
                <h1 className="text-5xl font-extrabold text-primary mb-2">Square Jumper</h1>
                <h2 className="text-4xl font-bold text-white">Press Spacebar to Start</h2>
                <p className="text-lg text-muted-foreground">Jump to avoid the obstacles!</p>
              </>
            )}
          </div>
        )}
        
        {/* Render Particles */}
        {particles.map(p => (
            <div
                key={p.id}
                className="absolute rounded-full"
                style={{
                    left: p.x,
                    top: p.y,
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    opacity: p.opacity,
                    transform: 'translate(-50%, -50%)'
                }}
            />
        ))}

        {gameStarted && (
          <>
            <div
              className="absolute bg-primary rounded-sm"
              style={{
                top: playerY,
                left: PLAYER_START_X,
                width: PLAYER_SIZE,
                height: PLAYER_SIZE,
              }}
            />
            {gameObjects.map((obj, i) => (
              <div key={i}>
                {obj.type === 'obstacle' && (
                  <>
                    <div
                      className="absolute bg-accent rounded-sm"
                      style={{
                        left: obj.x,
                        top: 0,
                        width: OBSTACLE_WIDTH,
                        height: obj.height,
                      }}
                    />
                    <div
                      className="absolute bg-accent rounded-sm"
                      style={{
                        left: obj.x,
                        top: obj.height + OBSTACLE_GAP,
                        width: OBSTACLE_WIDTH,
                        height: GAME_HEIGHT - obj.height - OBSTACLE_GAP,
                      }}
                    />
                  </>
                )}
                {obj.type === 'saw' && (
                  <div className="absolute" style={{ left: obj.x, top: obj.y, width: SAW_SIZE, height: SAW_SIZE }}>
                    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ transform: `rotate(${obj.rotation}deg)`}}>
                      <circle cx="50" cy="50" r="45" fill="#c0c0c0" stroke="#a0a0a0" strokeWidth="5" />
                      {[...Array(12)].map((_, toothIndex) => (
                        <path key={toothIndex} d="M50 0 L45 15 L55 15 Z" fill="#c0c0c0" transform={`rotate(${toothIndex * 30} 50 50)`} />
                      ))}
                      <circle cx="50" cy="50" r="10" fill="#a0a0a0" />
                    </svg>
                  </div>
                )}
                {obj.type === 'jumpPad' && (
                  <div
                    className="absolute rounded"
                    style={{
                      left: obj.x,
                      top: obj.y,
                      width: JUMP_PAD_WIDTH,
                      height: JUMP_PAD_HEIGHT,
                      backgroundColor: 'hsl(140, 70%, 50%)',
                      borderBottom: '5px solid hsl(140, 70%, 30%)'
                    }}
                  />
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
