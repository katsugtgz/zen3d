import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandData } from '../types';

interface HandTrackerProps {
  onHandUpdate: (data: HandData) => void;
}

export const HandTracker: React.FC<HandTrackerProps> = ({ onHandUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastVideoTime = useRef(-1);
  const requestRef = useRef<number>(0);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);

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
      // Cleanup stream
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
      
      processResults(results);
    }
    
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const processResults = (results: any) => {
    if (!results.landmarks || results.landmarks.length === 0) {
      onHandUpdate({
        expansion: 0.5, // Default to neutral
        tension: 0,
        isPresent: false,
        centerX: 0,
        centerY: 0
      });
      return;
    }

    let expansion = 0;
    let tension = 0;
    let centerX = 0;
    let centerY = 0;

    // 1. Calculate Expansion (Distance between two hands)
    if (results.landmarks.length === 2) {
      const hand1 = results.landmarks[0][0]; // Wrist
      const hand2 = results.landmarks[1][0]; // Wrist
      
      // Calculate normalized distance (0 to 1 roughly)
      const dist = Math.sqrt(
        Math.pow(hand1.x - hand2.x, 2) + 
        Math.pow(hand1.y - hand2.y, 2)
      );
      
      // Remap distance: 0.1 (close) to 0.8 (far) -> 0 to 1
      expansion = Math.max(0, Math.min(1, (dist - 0.1) * 1.5));
    } else {
       // Only one hand, default expansion to neutral
       expansion = 0.5;
    }

    // 2. Calculate Tension (Average finger tip distance to wrist)
    let totalTension = 0;
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

      // Map avgDist: 0.15 (fist/tight) to 0.4 (open/relaxed)
      // High tension (fist) = 1, Low tension (open) = 0
      // These threshold values might need tweaking based on camera distance
      const t = 1 - Math.max(0, Math.min(1, (avgDist - 0.15) * 4));
      totalTension += t;
    });
    
    tension = totalTension / results.landmarks.length;

    // 3. Center Position
    let count = 0;
    results.landmarks.forEach((landmarks: any) => {
        const w = landmarks[0];
        centerX += w.x;
        centerY += w.y;
        count++;
    });
    
    if (count > 0) {
        centerX /= count;
        centerY /= count;
        
        // Mirror X for intuitive control (moving hand right moves particles right)
        // Webcam is usually mirrored by default visually, but coordinates might need flipping
        // MediaPipe coords: x: 0 (left) -> 1 (right)
        // We want -1 (left) to 1 (right)
        
        // Note: We mirror the calculation because standard webcam view feels mirrored
        centerX = (1 - centerX) * 2 - 1; 
        centerY = (1 - centerY) * 2 - 1; // 1 is bottom, we map to -1 (bottom) to 1 (top)? No, keep Y intuitive
        centerY = -(centerY); // Flip Y so up is up
    }

    onHandUpdate({
        expansion,
        tension,
        isPresent: true,
        centerX,
        centerY
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