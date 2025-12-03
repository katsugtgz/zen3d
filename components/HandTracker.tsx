import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandData } from '../types';

interface HandTrackerProps {
  onHandUpdate: (data: HandData) => void;
}

// Smoothing helper for gesture values
const lerp = (current: number, target: number, speed: number) => 
  current + (target - current) * speed;

export const HandTracker: React.FC<HandTrackerProps> = ({ onHandUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastVideoTime = useRef(-1);
  const requestRef = useRef<number>(0);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  
  // Smoothed values for stable gesture output
  const smoothedRef = useRef({
    expansion: 0.5,
    tension: 0,
    centerX: 0,
    centerY: 0,
    rotation: 0,
    twist: 0,
    velocity: 0
  });
  
  // Previous frame data for velocity calculation
  const prevFrameRef = useRef({
    centerX: 0,
    centerY: 0,
    timestamp: 0,
    hand1Y: 0,
    hand2Y: 0
  });

  useEffect(() => {
    const initHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
        
        handLandmarkerRef.current = handLandmarker;
        setInitialized(true);
      } catch (e) {
        console.error("Failed to load MediaPipe:", e);
        setError("Failed to load computer vision capabilities.");
      }
    };

    initHandLandmarker();

    return () => {
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const startWebcam = async () => {
      if (!initialized || !videoRef.current) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1280,
            height: 720,
            facingMode: 'user'
          }
        });
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', predictWebcam);
      } catch (e) {
        console.error("Camera denied:", e);
        setError("Camera access required for hand control.");
      }
    };

    startWebcam();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current) return;

    let startTimeMs = performance.now();
    
    if (lastVideoTime.current !== videoRef.current.currentTime) {
      lastVideoTime.current = videoRef.current.currentTime;
      
      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
      
      processResults(results, startTimeMs);
    }
    
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const processResults = (results: any, timestamp: number) => {
    const smoothed = smoothedRef.current;
    const prevFrame = prevFrameRef.current;
    const smoothingSpeed = 0.15; // Higher = more responsive, lower = smoother
    
    if (!results.landmarks || results.landmarks.length === 0) {
      // Decay values when no hands present
      smoothed.expansion = lerp(smoothed.expansion, 0.5, 0.05);
      smoothed.tension = lerp(smoothed.tension, 0, 0.05);
      smoothed.rotation = lerp(smoothed.rotation, 0, 0.05);
      smoothed.twist = lerp(smoothed.twist, 0, 0.05);
      smoothed.velocity = lerp(smoothed.velocity, 0, 0.1);
      
      onHandUpdate({
        expansion: smoothed.expansion,
        tension: smoothed.tension,
        isPresent: false,
        centerX: smoothed.centerX,
        centerY: smoothed.centerY,
        rotation: smoothed.rotation,
        twist: smoothed.twist,
        velocity: smoothed.velocity,
        grabbing: false
      });
      return;
    }

    let rawExpansion = 0.5;
    let rawTension = 0;
    let rawCenterX = 0;
    let rawCenterY = 0;
    let rawRotation = 0;
    let rawTwist = 0;
    let grabbing = false;

    // ═══════════════════════════════════════════════════════════════
    // GESTURE: Expansion (Distance between two hands)
    // ═══════════════════════════════════════════════════════════════
    if (results.landmarks.length === 2) {
      const hand1 = results.landmarks[0][0]; // Wrist
      const hand2 = results.landmarks[1][0]; // Wrist
      
      const dist = Math.sqrt(
        Math.pow(hand1.x - hand2.x, 2) + 
        Math.pow(hand1.y - hand2.y, 2)
      );
      
      rawExpansion = Math.max(0, Math.min(1, (dist - 0.1) * 1.5));
      
      // ═══════════════════════════════════════════════════════════════
      // GESTURE: Rotation (Hands moving in opposite Y directions)
      // ═══════════════════════════════════════════════════════════════
      const hand1YVel = hand1.y - prevFrame.hand1Y;
      const hand2YVel = hand2.y - prevFrame.hand2Y;
      
      // If hands moving in opposite directions, we have rotation
      if (Math.sign(hand1YVel) !== Math.sign(hand2YVel)) {
        rawRotation = (hand2YVel - hand1YVel) * 10; // Scale for sensitivity
        rawRotation = Math.max(-1, Math.min(1, rawRotation));
      }
      
      // ═══════════════════════════════════════════════════════════════
      // GESTURE: Twist (Hands circling around each other)
      // ═══════════════════════════════════════════════════════════════
      const currentAngle = Math.atan2(hand2.y - hand1.y, hand2.x - hand1.x);
      // We'd need previous angle for delta, simplified to use X velocity differential
      const hand1XVel = hand1.x - prevFrame.centerX;
      const twistIndicator = Math.abs(hand1YVel - hand2YVel) + Math.abs(hand1XVel);
      rawTwist = Math.min(1, twistIndicator * 5);
      
      prevFrame.hand1Y = hand1.y;
      prevFrame.hand2Y = hand2.y;
    }

    // ═══════════════════════════════════════════════════════════════
    // GESTURE: Tension (Finger curl - fist vs open hand)
    // ═══════════════════════════════════════════════════════════════
    let totalTension = 0;
    let totalGrabbing = 0;
    
    results.landmarks.forEach((landmarks: any) => {
      const wrist = landmarks[0];
      const tips = [4, 8, 12, 16, 20]; // Fingertip indices
      let avgDist = 0;
      
      tips.forEach(idx => {
        const d = Math.sqrt(
          Math.pow(landmarks[idx].x - wrist.x, 2) +
          Math.pow(landmarks[idx].y - wrist.y, 2)
        );
        avgDist += d;
      });
      avgDist /= tips.length;

      // High tension = fist, low tension = open
      const t = 1 - Math.max(0, Math.min(1, (avgDist - 0.12) * 5));
      totalTension += t;
      
      // Grabbing = high tension
      if (t > 0.6) totalGrabbing++;
    });
    
    rawTension = totalTension / results.landmarks.length;
    grabbing = totalGrabbing === results.landmarks.length && results.landmarks.length === 2;

    // ═══════════════════════════════════════════════════════════════
    // GESTURE: Center Position & Velocity
    // ═══════════════════════════════════════════════════════════════
    let count = 0;
    results.landmarks.forEach((landmarks: any) => {
      const w = landmarks[0];
      rawCenterX += w.x;
      rawCenterY += w.y;
      count++;
    });
    
    if (count > 0) {
      rawCenterX /= count;
      rawCenterY /= count;
      
      // Calculate velocity (for clap detection)
      const dt = (timestamp - prevFrame.timestamp) / 1000;
      if (dt > 0 && dt < 0.5) {
        const dx = rawCenterX - prevFrame.centerX;
        const dy = rawCenterY - prevFrame.centerY;
        const rawVelocity = Math.sqrt(dx * dx + dy * dy) / dt;
        smoothed.velocity = lerp(smoothed.velocity, Math.min(1, rawVelocity * 2), 0.3);
      }
      
      // Mirror X for intuitive control
      rawCenterX = (1 - rawCenterX) * 2 - 1;
      rawCenterY = -((1 - rawCenterY) * 2 - 1);
      
      prevFrame.centerX = rawCenterX;
      prevFrame.centerY = rawCenterY;
      prevFrame.timestamp = timestamp;
    }

    // ═══════════════════════════════════════════════════════════════
    // Apply smoothing for stable output
    // ═══════════════════════════════════════════════════════════════
    smoothed.expansion = lerp(smoothed.expansion, rawExpansion, smoothingSpeed);
    smoothed.tension = lerp(smoothed.tension, rawTension, smoothingSpeed);
    smoothed.centerX = lerp(smoothed.centerX, rawCenterX, smoothingSpeed);
    smoothed.centerY = lerp(smoothed.centerY, rawCenterY, smoothingSpeed);
    smoothed.rotation = lerp(smoothed.rotation, rawRotation, smoothingSpeed * 0.5);
    smoothed.twist = lerp(smoothed.twist, rawTwist, smoothingSpeed * 0.3);

    onHandUpdate({
      expansion: smoothed.expansion,
      tension: smoothed.tension,
      isPresent: true,
      centerX: smoothed.centerX,
      centerY: smoothed.centerY,
      rotation: smoothed.rotation,
      twist: smoothed.twist,
      velocity: smoothed.velocity,
      grabbing
    });
  };

  return (
    <div className="absolute top-4 right-4 z-50 w-48 overflow-hidden rounded-xl border border-white/10 bg-black/50 shadow-2xl backdrop-blur-md transition-opacity duration-500">
        {/* Hidden video element for processing */}
        <video 
            ref={videoRef} 
            className={`w-full h-auto transform -scale-x-100 ${initialized ? 'opacity-50' : 'opacity-0'}`} 
            playsInline 
            autoPlay 
            muted 
        />
        {!initialized && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70">
                Loading AI...
            </div>
        )}
        {error && (
             <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-red-400">
                {error}
             </div>
        )}
        <div className="bg-black/40 p-2 text-center text-[10px] uppercase tracking-widest text-white/50">
            Hand Tracking
        </div>
    </div>
  );
};