import React from 'react';
import styled from 'styled-components';

interface LoaderProps {
  /** Duration in seconds for the drive animation. 
   *  Pass a small number (e.g. 1) for a fast drive, larger (e.g. 6) for a slow drive.
   *  Default is 4 (keeps previous behavior).
   */
  duration?: number;
}

const Loader: React.FC<LoaderProps> = ({ duration = 4 }) => {
  return (
    <StyledWrapper style={{ ['--drive-duration' as any]: `${duration}s` }}>
      <div className="loader">
        <div className="scene">
          {/* Luxury Red Car (inline SVG used so the car always displays reliably) */}
          <div className="carContainer">
            <div className="redCar">
              {/* Inline SVG of a simplified luxury sports car silhouette (red) — always renders */}
              <svg
                className="carBody"
                viewBox="0 0 800 300"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="redGrad" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#ff2d2d" />
                    <stop offset="1" stopColor="#b30000" />
                  </linearGradient>
                  <filter id="carGloss" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="8" result="b"/>
                    <feBlend in="SourceGraphic" in2="b" mode="screen" />
                  </filter>
                </defs>

                {/* car body */}
                <g transform="translate(0,10)">
                  <path
                    d="M40 200 C60 160, 140 110, 240 110 L520 110 C600 110, 700 160, 760 200 L760 230 L40 230 Z"
                    fill="url(#redGrad)"
                    stroke="#7a0000"
                    strokeWidth="3"
                    filter="url(#carGloss)"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* cabin */}
                  <path
                    d="M260 110 C300 70, 420 70, 470 110 L520 110 L480 150 L300 150 Z"
                    fill="#ff6b6b"
                    opacity="0.95"
                  />
                  {/* windows */}
                  <path d="M285 115 C310 95, 395 95, 425 115 L420 140 L295 140 Z" fill="#0b1220" opacity="0.6" />
                  {/* front bumper highlight */}
                  <path d="M520 110 C580 120, 640 145, 720 170" stroke="#ffb3b3" strokeWidth="2" fill="none" opacity="0.3" />
                  {/* small detail lines */}
                  <path d="M160 160 L220 155" stroke="#7a0000" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
                </g>

                {/* decorative flare */}
                <ellipse cx="430" cy="210" rx="70" ry="8" fill="rgba(255,255,255,0.06)" />
              </svg>

              {/* wheels stay as images to keep rotation look; positioned absolutely */}
              <div className="wheels" aria-hidden="true">
                <img
                  src="https://i.imgur.com/uZh01my.png"
                  alt="Front Wheel"
                  className="frontWheel"
                  onError={(e) => {
                    // hide broken image if it fails to load
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <img
                  src="https://i.imgur.com/uZh01my.png"
                  alt="Back Wheel"
                  className="backWheel"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          </div>

          {/* Parking Slot */}
          <div className="parkingSlot">
            <div className="slotBorder"></div>
            <div className="pSign">P</div>
            <div className="parkingLines">
              <div className="line"></div>
              <div className="line"></div>
            </div>
          </div>

          {/* Road */}
          <div className="road">
            <div className="roadMark"></div>
            <div className="roadMark"></div>
            <div className="roadMark"></div>
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  /* drive duration controlled by CSS variable --drive-duration (e.g. "2s", "4s") */
  .loader {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
  }

  .scene {
    width: 300px;
    height: 120px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  /* Red Car Container */
  .carContainer {
    position: absolute;
    left: -140px; /* start further left for a clearer initial distance */
    bottom: 20px;
    /* use CSS variable --drive-duration to allow dynamic speed control from React */
    animation: driveToParking var(--drive-duration, 4s) cubic-bezier(0.4, 0, 0.2, 1) forwards;
    z-index: 10;
    pointer-events: none;
  }

  .redCar {
    position: relative;
    width: 140px; /* slightly wider for a luxury look */
    height: auto;
    filter: drop-shadow(2px 6px 12px rgba(0, 0, 0, 0.45));
    display: block;
  }

  /* Ensure SVG scales properly and is visible */
  .carBody {
    width: 100%;
    height: auto;
    display: block;
    position: relative;
    z-index: 5; /* sits below wheels so wheels look on-top */
    animation: carIdleBob 1.2s ease-in-out infinite;
    transform-origin: center;
  }

  @keyframes carIdleBob {
    0% { transform: translateY(-1px); }
    50% { transform: translateY(0px); }
    100% { transform: translateY(-1px); }
  }

  .wheels {
    position: absolute;
    bottom: 6px;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 6; /* above the car body so wheels are visible */
  }

  /* wheel spin derives from drive duration so wheel speed roughly matches car speed,
     but also set a minimum spin speed so wheels keep rotating even when car is parked */
  .frontWheel,
  .backWheel {
    position: absolute;
    width: 22px;
    height: 22px;
    will-change: transform;
    object-fit: contain;
    /* Wheel spin: base speed is a small fraction of drive-duration.
       This keeps rotation visible while parked. */
    animation: wheelSpin calc(var(--drive-duration, 4s) * 0.04) linear infinite;
  }

  .frontWheel {
    right: 18px;
    bottom: 0px;
  }

  .backWheel {
    left: 18px;
    bottom: 0px;
  }

  @keyframes wheelSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* driveToParking:
     - Car stays mostly back (shows distance) while loading is underway.
     - In the final stretch (last ~12-15% of the animation) it quickly zips and eases into the parking spot,
       creating the "sudden arrival right before completion" effect the user requested.
  */
  @keyframes driveToParking {
    0% {
      transform: translateX(0px) scale(1);
      left: -140px;
    }
    60% {
      /* slow approach — keeps visible distance between car and P sign */
      transform: translateX(120px) scale(1);
      left: -140px;
    }
    80% {
      /* a little closer but still clear distance */
      transform: translateX(170px) scale(0.98);
      left: -120px;
    }
    88% {
      /* prepare for quick arrival — small hop and slight rotation for flair */
      transform: translateX(185px) scale(0.97) rotate(-1deg);
      left: -100px;
    }
    94% {
      /* quick zip — most of movement happens here */
      transform: translateX(240px) scale(0.88) rotate(0.5deg);
      left: -50px;
    }
    100% {
      /* final parked position: aligned inside the parking slot with slight scale to simulate depth */
      transform: translateX(260px) scale(0.8) rotate(0deg);
      left: -40px;
    }
  }

  /* Enhanced Car Shadow */
  .carContainer::after {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 50%;
    width: 100px;
    height: 6px;
    background: linear-gradient(90deg, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.35));
    border-radius: 50%;
    transform: translateX(-50%);
    filter: blur(4px);
    animation: enhancedCarShadow var(--drive-duration, 4s) cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  @keyframes enhancedCarShadow {
    0% {
      transform: translateX(-50%) scale(1.4);
      opacity: 0.25;
    }
    60% {
      transform: translateX(-50%) scale(1.1);
      opacity: 0.45;
    }
    85% {
      transform: translateX(-50%) scale(0.9);
      opacity: 0.55;
    }
    100% {
      transform: translateX(-50%) scale(0.75);
      opacity: 0.7;
    }
  }

  /* Parking Slot */
  .parkingSlot {
    position: absolute;
    right: 50px;
    bottom: 15px;
    width: 80px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;
  }

  .slotBorder {
    position: absolute;
    width: 100%;
    height: 100%;
    border: 3px dashed #3B82F6;
    border-radius: 8px;
    animation: slotPulse 2s ease-in-out infinite;
    background: rgba(255, 255, 255, 0.01);
  }

  @keyframes slotPulse {
    0%,
    100% {
      border-color: #3B82F6;
      opacity: 1;
      transform: scale(1);
    }
    50% {
      border-color: #60A5FA;
      opacity: 0.9;
      transform: scale(1.03);
    }
  }

  .pSign {
    font-size: 32px;
    font-weight: 900;
    color: #3B82F6;
    font-family: 'Arial Black', sans-serif;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.35), 0 0 10px rgba(59, 130, 246, 0.28);
    animation: signGlowEnhanced 2s ease-in-out infinite;
    z-index: 6;
  }

  @keyframes signGlowEnhanced {
    0%,
    100% {
      transform: scale(1);
      color: #3B82F6;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.35), 0 0 10px rgba(59, 130, 246, 0.28);
    }
    50% {
      transform: scale(1.06);
      color: #60A5FA;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.35), 0 0 15px rgba(96, 165, 250, 0.4);
    }
  }

  .parkingLines {
    position: absolute;
    bottom: 8px;
    width: 100%;
    display: flex;
    justify-content: space-around;
    padding: 0 15px;
    z-index: 6;
  }

  .line {
    width: 20px;
    height: 3px;
    background: linear-gradient(90deg, #3B82F6, #60A5FA);
    border-radius: 2px;
    opacity: 0.8;
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.25);
  }

  /* Road */
  .road {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: #64748B;
    display: flex;
    justify-content: space-between;
    padding: 0 20px;
    z-index: 2;
  }

  .roadMark {
    width: 15px;
    height: 2px;
    background: #F1F5F9;
    /* road animation scales with drive duration so it visually matches speed */
    animation: roadMove calc(var(--drive-duration, 4s) * 0.375) linear infinite;
  }

  .roadMark:nth-child(1) {
    animation-delay: 0s;
  }
  .roadMark:nth-child(2) {
    animation-delay: 0.5s;
  }
  .roadMark:nth-child(3) {
    animation-delay: 1s;
  }

  @keyframes roadMove {
    0% {
      transform: translateX(-100px);
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: translateX(100px);
      opacity: 0;
    }
  }

  /* Additional beautiful effects */
  .scene::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(ellipse at center bottom, rgba(59, 130, 246, 0.06) 0%, transparent 70%);
    pointer-events: none;
    z-index: 1;
  }
`;

export default Loader;
