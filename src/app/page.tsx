"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';

// Game constants
const GAME_HEIGHT = 500;
const GAME_WIDTH = 800;
const PLAYER_SIZE = 30;
const PLAYER_START_X = 150;
const GRAVITY = 0.5;
const JUMP_STRENGTH = 10;
const OBSTACLE_WIDTH = 40;
const OBSTACLE_SPEED = 4;
const OBSTACLE_GAP = 150;
const OBSTACLE_MIN_HEIGHT = 40;
const OBSTACLE_MAX_HEIGHT = GAME_HEIGHT - OBSTACLE_GAP - OBSTACLE_MIN_HEIGHT;
const OBSTACLE_INTERVAL = 2000; // in ms

type Obstacle = {
  x: number;
  height: number; // height of the top obstacle
  passed: boolean;
};

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);

  const [playerY, setPlayerY] = useState(GAME_HEIGHT / 2);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  const playerVelocityRef = useRef(0);
  const lastObstacleTimeRef = useRef(0);
  const gameLoopRef = useRef<number>();

  const resetGame = useCallback(() => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setPlayerY(GAME_HEIGHT / 2);
    playerVelocityRef.current = 0;
    setObstacles([]);
    lastObstacleTimeRef.current = performance.now();
  }, []);

  const jump = useCallback(() => {
    if (gameStarted && !gameOver) {
      playerVelocityRef.current = -JUMP_STRENGTH;
    }
  }, [gameStarted, gameOver]);

  const gameLoop = useCallback(() => {
    // --- Player movement ---
    playerVelocityRef.current += GRAVITY;
    let newPlayerY = playerY + playerVelocityRef.current;
    
    setPlayerY(newPlayerY);

    // --- Obstacle movement and generation ---
    let scored = false;
    let newObstacles = obstacles
        .map(obs => ({ ...obs, x: obs.x - OBSTACLE_SPEED }))
        .filter(obs => obs.x > -OBSTACLE_WIDTH);

    const obstacleToScore = newObstacles.find(
      obs => !obs.passed && obs.x + OBSTACLE_WIDTH < PLAYER_START_X
    );
    if (obstacleToScore) {
      obstacleToScore.passed = true;
      scored = true;
    }
    
    if (performance.now() - lastObstacleTimeRef.current > OBSTACLE_INTERVAL) {
      const newObstacleHeight = Math.floor(Math.random() * (OBSTACLE_MAX_HEIGHT - OBSTACLE_MIN_HEIGHT + 1)) + OBSTACLE_MIN_HEIGHT;
      newObstacles.push({ x: GAME_WIDTH, height: newObstacleHeight, passed: false });
      lastObstacleTimeRef.current = performance.now();
    }
    setObstacles(newObstacles);

    if (scored) {
      setScore(s => s + 1);
    }
    
    // --- Collision detection ---
    if (newPlayerY >= GAME_HEIGHT - PLAYER_SIZE || newPlayerY <= 0) {
      setGameOver(true);
      return;
    }

    const playerRect = {
      x: PLAYER_START_X,
      y: newPlayerY,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
    };

    for (const obs of newObstacles) {
      const topObstacleRect = { x: obs.x, y: 0, width: OBSTACLE_WIDTH, height: obs.height };
      const bottomObstacleRect = { x: obs.x, y: obs.height + OBSTACLE_GAP, width: OBSTACLE_WIDTH, height: GAME_HEIGHT - obs.height - OBSTACLE_GAP };

      const collidesWithTop = playerRect.x < topObstacleRect.x + topObstacleRect.width &&
                             playerRect.x + playerRect.width > topObstacleRect.x &&
                             playerRect.y < topObstacleRect.y + topObstacleRect.height;
      
      const collidesWithBottom = playerRect.x < bottomObstacleRect.x + bottomObstacleRect.width &&
                                playerRect.x + playerRect.width > bottomObstacleRect.x &&
                                playerRect.y + playerRect.height > bottomObstacleRect.y;

      if (collidesWithTop || collidesWithBottom) {
        setGameOver(true);
        return;
      }
    }
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [playerY, obstacles]);


  useEffect(() => {
    if (gameStarted && !gameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameStarted, gameOver, gameLoop]);


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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-4xl font-bold z-30" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
          Score: {score}
        </div>

        {(!gameStarted || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 space-y-6 text-center">
            {gameOver ? (
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
                <p className="text-lg text-muted-foreground">Jump to avoid the red blocks!</p>
              </>
            )}
          </div>
        )}
        
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
            {obstacles.map((obs, i) => (
              <div key={i}>
                <div
                  className="absolute bg-accent rounded-sm"
                  style={{
                    left: obs.x,
                    top: 0,
                    width: OBSTACLE_WIDTH,
                    height: obs.height,
                  }}
                />
                <div
                  className="absolute bg-accent rounded-sm"
                  style={{
                    left: obs.x,
                    top: obs.height + OBSTACLE_GAP,
                    width: OBSTACLE_WIDTH,
                    height: GAME_HEIGHT - obs.height - OBSTACLE_GAP,
                  }}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
