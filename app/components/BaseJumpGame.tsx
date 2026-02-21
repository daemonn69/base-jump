"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useSendTransaction } from 'wagmi';
import styles from './BaseJumpGame.module.css';

interface BaseJumpGameProps {
  onGameOver?: (score: number) => void;
  userFid?: number;
}

export default function BaseJumpGame({ onGameOver, userFid }: BaseJumpGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { sendTransactionAsync } = useSendTransaction();
  const [dimensions, setDimensions] = useState({ width: 400, height: 600 });
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameId, setGameId] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{ fid: string, score: number }[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  const loadLeaderboard = async () => {
    try {
      setIsLoadingLeaderboard(true);
      setShowLeaderboard(true);
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (Array.isArray(data)) setLeaderboard(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  // Set fullscreen dimensions on client side
  useEffect(() => {
    const updateDims = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    updateDims();
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  // Load high score from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('baseJumpHighScore');
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
    const savedStreak = localStorage.getItem('baseJumpStreak');
    const savedLastCheckIn = localStorage.getItem('baseJumpLastCheckIn');
    if (savedStreak) setStreak(parseInt(savedStreak, 10));
    if (savedLastCheckIn) setLastCheckIn(savedLastCheckIn);
  }, []);

  // Use a ref for the pause state so the game loop can read the latest value
  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (!gameStarted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Game Variables
    const width = canvas.width;
    const height = canvas.height;

    let platforms: { x: number, y: number, width: number, height: number, type: number, moving?: boolean, direction?: number, bounceOffset?: number }[] = [];
    const player = {
      x: width / 2 - 20,
      y: height - 150,
      width: 40,
      height: 40,
      vx: 0,
      vy: 0,
      jumpForce: -10, // Faster jump
      speed: 6
    };

    const gravity = 0.3; // Higher gravity
    let currentScore = 0;
    let gameLoopId: number;

    const keys = {
      ArrowLeft: false,
      ArrowRight: false,
    };

    // Touch controls
    let touchX: number | null = null;

    // Initialize platforms
    const initPlatforms = () => {
      platforms = [];
      platforms.push({ x: width / 2 - 40, y: height - 50, width: 80, height: 12, type: 0, bounceOffset: 0 }); // Starting platform

      for (let i = 0; i < 12; i++) {
        const x = Math.random() * (width - 80);
        const y = height - 150 - i * 70;
        platforms.push({ x, y, width: 80, height: 12, type: 0, bounceOffset: 0 });
      }
    };

    initPlatforms();

    // Event Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.ArrowLeft = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.ArrowRight = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.ArrowLeft = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.ArrowRight = false;
    };

    const handleTouch = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      touchX = touch.clientX - rect.left;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      handleTouch(e);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      handleTouch(e);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      touchX = null;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Custom drawing routines
    const drawPlayer = (x: number, y: number, w: number, h: number) => {
      // Base circle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
      ctx.fill();

      // Outline
      ctx.strokeStyle = '#0052ff';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Eyes based on velocity
      ctx.fillStyle = '#0052ff';
      const eyeOffsetY = player.vy < 0 ? -2 : 2;
      const eyeOffsetX = player.vx < 0 ? -2 : player.vx > 0 ? 2 : 0;

      ctx.beginPath();
      ctx.arc(x + w / 3 + eyeOffsetX, y + h / 2.5 + eyeOffsetY, 3, 0, Math.PI * 2);
      ctx.arc(x + (w * 2) / 3 + eyeOffsetX, y + h / 2.5 + eyeOffsetY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Simple mouth
      ctx.beginPath();
      if (player.vy < -5) {
        // Surprised 'o'
        ctx.arc(x + w / 2, y + h / 1.5, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Smile
        ctx.arc(x + w / 2, y + h / 1.6, 6, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      }
    };

    const drawPlatform = (p: typeof platforms[0]) => {
      const bOffset = p.bounceOffset || 0;
      ctx.fillStyle = p.type === 1 ? '#00c000' : '#0052ff'; // Green for moving
      ctx.beginPath();
      ctx.roundRect(p.x, p.y + bOffset, p.width, p.height, 6);
      ctx.fill();

      // Inner highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.roundRect(p.x + 2, p.y + 2 + bOffset, p.width - 4, p.height / 2 - 2, 4);
      ctx.fill();
    };

    let lastTime = 0;
    // Update function
    const update = (time: number) => {
      // Pause check
      if (isPausedRef.current) {
        draw();
        gameLoopId = requestAnimationFrame(update);
        return;
      }

      // 60 FPS cap to prevent 120hz screens from running physics at 2x speed
      const dt = time - lastTime;
      if (dt < 16.6) {
        gameLoopId = requestAnimationFrame(update);
        return;
      }
      lastTime = time - (dt % 16.6);

      // Player movement
      if (touchX !== null) {
        const targetX = touchX - player.width / 2;
        player.x += (targetX - player.x) * 0.2; // Smooth tracking
        player.vx = 0;
      } else if (keys.ArrowLeft) {
        player.vx = -player.speed;
        player.x += player.vx;
      } else if (keys.ArrowRight) {
        player.vx = player.speed;
        player.x += player.vx;
      } else {
        player.vx *= 0.8; // Friction
        if (Math.abs(player.vx) < 0.1) player.vx = 0;
        player.x += player.vx;
      }

      // Screen wrap
      if (player.x + player.width < 0) player.x = width;
      if (player.x > width) player.x = -player.width;

      player.vy += gravity;
      player.y += player.vy;

      // Platform logic
      platforms.forEach(p => {
        // Bounce animation decay
        if (p.bounceOffset && p.bounceOffset > 0) {
          p.bounceOffset *= 0.8; // spring back up
          if (p.bounceOffset < 0.5) p.bounceOffset = 0;
        }

        // Moving platforms
        if (p.moving && p.direction) {
          p.x += p.direction * 1.5;
          if (p.x < 0 || p.x + p.width > width) {
            p.direction *= -1; // Bounce off walls
          }
        }
      });

      // Platform collision
      if (player.vy > 0) { // Only collide when falling
        for (let i = 0; i < platforms.length; i++) {
          const p = platforms[i];
          if (
            player.x + player.width > p.x - 10 &&
            player.x < p.x + p.width + 10 &&
            player.y + player.height > p.y - 10 &&
            player.y + player.height < p.y + p.height + player.vy + 10
          ) {
            player.vy = player.jumpForce;
            p.bounceOffset = 10; // Trigger bounce animation down
            // Particles or sound could go here
            break; // Break so we only bounce off one platform
          }
        }
      }

      // Camera follow
      if (player.y < height / 2) {
        const diff = (height / 2) - player.y;
        player.y += diff;
        currentScore += diff;

        platforms.forEach(p => p.y += diff);
      }

      // Difficulty based on score
      const difficulty = Math.min(1, currentScore / 20000);
      const gapMultiplier = 1 + difficulty * 0.5;

      // Generate new platforms and remove old
      platforms = platforms.filter(p => p.y < height);
      while (platforms.length < 12) {
        const highestY = Math.min(...platforms.map(p => p.y));
        const x = Math.random() * (width - 80);
        const y = highestY - (Math.random() * 50 * gapMultiplier + 50 * gapMultiplier);

        const isMoving = currentScore > 3000 && Math.random() < (0.1 + difficulty * 0.3);

        platforms.push({
          x,
          y,
          width: 80 - (difficulty * 20), // Platforms get smaller
          height: 12,
          type: isMoving ? 1 : 0,
          moving: isMoving,
          direction: Math.random() > 0.5 ? 1 : -1,
          bounceOffset: 0
        });
      }

      const currentFinalScore = Math.floor(currentScore / 10);
      setScore(currentFinalScore);

      // Game over condition
      if (player.y > height) {
        setIsGameOver(true);
        setGameStarted(false); // Stop game loop from unmounting and remounting with zero score
        if (currentFinalScore > highScore) {
          setHighScore(currentFinalScore);
          localStorage.setItem('baseJumpHighScore', currentFinalScore.toString());
        }

        // Use real FID or a mock one for local browser testing
        const currentFid = userFid || Math.floor(Math.random() * 100000);

        if (currentFinalScore > 0) {
          // Fire and forget score save
          fetch('/api/leaderboard', {
            method: 'POST',
            body: JSON.stringify({ fid: currentFid, score: currentFinalScore }),
            headers: { 'Content-Type': 'application/json' }
          }).catch(console.error);
        }

        if (onGameOver) onGameOver(currentFinalScore);
        return; // stop updating
      }

      draw();
      gameLoopId = requestAnimationFrame(update);
    };

    const draw = () => {
      // Background
      ctx.fillStyle = '#ebf5ff';
      ctx.fillRect(0, 0, width, height);

      // Score in background
      ctx.fillStyle = 'rgba(0,82,255, 0.05)';
      ctx.font = 'bold 160px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.floor(currentScore / 10).toString(), width / 2, height / 2);

      // Platforms
      platforms.forEach(drawPlatform);

      // Player
      drawPlayer(player.x, player.y, player.width, player.height);
    };

    // Initial draw & Start loop
    draw();
    gameLoopId = requestAnimationFrame(update);

    // Cleanup
    return () => {
      cancelAnimationFrame(gameLoopId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      if (canvas) {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
        canvas.removeEventListener('touchcancel', handleTouchEnd);
      }
    };
  }, [gameStarted, gameId, highScore, onGameOver]);

  const handleCheckIn = async () => {
    try {
      setIsCheckingIn(true);
      const today = new Date().toISOString().split('T')[0];

      if (lastCheckIn === today) return;

      // Using wagmi via the Farcaster connector
      const txHash = await sendTransactionAsync({
        to: '0x0000000000000000000000000000000000000000',
        value: BigInt(0),
      });

      if (txHash) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const newStreak = (lastCheckIn === yesterday) ? streak + 1 : 1;

        setStreak(newStreak);
        setLastCheckIn(today);
        localStorage.setItem('baseJumpStreak', newStreak.toString());
        localStorage.setItem('baseJumpLastCheckIn', today);
      }
    } catch (e) {
      console.error("Check in failed", e);
    } finally {
      setIsCheckingIn(false);
    }
  };

  return (
    <div className={styles.gameContainer}>
      {!gameStarted && !isGameOver && !showLeaderboard && (
        <div className={styles.overlay}>
          <h2>BASE JUMP</h2>
          {userFid && <p>Welcome back, FID: {userFid}!</p>}
          <div className={styles.streakContainer}>
            <span>🔥 Streak: {streak}</span>
            <button
              className={styles.checkInButton}
              onClick={handleCheckIn}
              disabled={lastCheckIn === new Date().toISOString().split('T')[0] || isCheckingIn}
            >
              {isCheckingIn ? "Checking..." : lastCheckIn === new Date().toISOString().split('T')[0] ? "Checked In ✓" : "Daily Check-In"}
            </button>
          </div>
          <div className={styles.highScoreTag}>HIGH SCORE: {highScore}</div>
          <p>
            Tap & hold left or right.<br />
            Let&apos;s go TO THE MOON! 🚀
          </p>
          <button className={styles.button} onClick={() => setGameStarted(true)}>
            START JUMP
          </button>
          <button className={styles.button} onClick={loadLeaderboard} style={{ marginTop: '10px' }}>
            GLOBAL TOP
          </button>

          <button
            onClick={async () => {
              if (confirm("Вы уверены что хотите обнулить свой рекорд?")) {
                localStorage.removeItem('baseJumpHighScore');
                setHighScore(0);
                if (userFid) {
                  await fetch('/api/leaderboard', { method: 'DELETE', body: JSON.stringify({ fid: userFid }) });
                  alert('Рекорд сброшен в базе!');
                } else {
                  alert('Рекорд сброшен локально!');
                }
              }
            }}
            style={{ marginTop: '20px', fontSize: '12px', background: 'transparent', color: '#ff4d4f', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-source-code-pro), monospace' }}
          >
            [Сбросить рекорд]
          </button>
        </div>
      )}

      {showLeaderboard && (
        <div className={styles.overlay}>
          <h2>GLOBAL TOP</h2>
          <div className={styles.leaderboardContainer}>
            {isLoadingLeaderboard ? (
              <p>Loading...</p>
            ) : leaderboard.length === 0 ? (
              <p>No scores yet.</p>
            ) : (
              <ol>
                {leaderboard.map((entry, index) => (
                  <li key={index}>FID {entry.fid}: {entry.score}</li>
                ))}
              </ol>
            )}
          </div>
          <button className={styles.button} onClick={() => setShowLeaderboard(false)}>
            BACK
          </button>
        </div>
      )}

      {isGameOver && (
        <div className={styles.overlay}>
          <h2>GAME OVER!</h2>
          <div className={styles.score}>{score}</div>
          <p>Not bad, but you can jump higher! 📈</p>
          <div className={styles.buttonContainer}>
            <button className={styles.button} onClick={() => {
              setIsGameOver(false);
              setScore(0);
              setGameId(prev => prev + 1);
              setGameStarted(true);
            }}>
              PLAY AGAIN
            </button>
            <button className={styles.button} onClick={() => {
              setIsGameOver(false);
              setScore(0);
              setGameStarted(false);
              setIsPaused(false);
            }}>
              MAIN MENU
            </button>
          </div>
        </div>
      )}

      {gameStarted && !isGameOver && !isPaused && (
        <button
          className={styles.pauseButton}
          onClick={() => setIsPaused(true)}
        >
          II
        </button>
      )}

      {isPaused && (
        <div className={styles.overlay}>
          <h2>PAUSED</h2>
          <div className={styles.score}>{score}</div>
          <p>Resting the fingers? 👀</p>
          <div className={styles.buttonContainer}>
            <button className={styles.button} onClick={() => setIsPaused(false)}>
              RESUME
            </button>
            <button className={styles.button} onClick={() => {
              setIsGameOver(false);
              setScore(0);
              setGameStarted(false);
              setIsPaused(false);
            }}>
              MAIN MENU
            </button>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className={styles.canvas}
      />
    </div>
  );
}
