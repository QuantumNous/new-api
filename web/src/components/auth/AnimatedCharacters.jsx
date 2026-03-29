/**
 * Animated Characters component for login page.
 * Inspired by CareerCompass (https://github.com/arsh342/careercompass) - MIT License.
 * Ported from TypeScript to JSX for Semi Design project.
 */
import React, { useState, useEffect, useRef } from 'react';

const Pupil = ({ size = 12, maxDistance = 5, pupilColor = 'black', forceLookX, forceLookY }) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const pupilRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const calc = () => {
    if (!pupilRef.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    const r = pupilRef.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 2);
    const d = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);
    const a = Math.atan2(dy, dx);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  };
  const p = calc();

  return (
    <div ref={pupilRef} style={{
      width: size, height: size, borderRadius: '50%', backgroundColor: pupilColor,
      transform: `translate(${p.x}px, ${p.y}px)`, transition: 'transform 0.1s ease-out',
    }} />
  );
};

const EyeBall = ({ size = 48, pupilSize = 16, maxDistance = 10, eyeColor = 'white', pupilColor = 'black', isBlinking = false, forceLookX, forceLookY }) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const eyeRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const calc = () => {
    if (!eyeRef.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    const r = eyeRef.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 2);
    const d = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);
    const a = Math.atan2(dy, dx);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  };
  const p = calc();

  return (
    <div ref={eyeRef} style={{
      width: size, height: isBlinking ? 2 : size, borderRadius: '50%',
      backgroundColor: eyeColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', transition: 'all 0.15s',
    }}>
      {!isBlinking && (
        <div style={{
          width: pupilSize, height: pupilSize, borderRadius: '50%', backgroundColor: pupilColor,
          transform: `translate(${p.x}px, ${p.y}px)`, transition: 'transform 0.1s ease-out',
        }} />
      )}
    </div>
  );
};


const AnimatedCharacters = ({ isTyping = false, showPassword = false, passwordLength = 0 }) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);
  const purpleRef = useRef(null);
  const blackRef = useRef(null);
  const yellowRef = useRef(null);
  const orangeRef = useRef(null);

  useEffect(() => {
    const h = (e) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);

  // Blinking
  useEffect(() => {
    const schedule = (setter) => {
      const t = setTimeout(() => {
        setter(true);
        setTimeout(() => { setter(false); schedule(setter); }, 150);
      }, Math.random() * 4000 + 3000);
      return t;
    };
    const t1 = schedule(setIsPurpleBlinking);
    const t2 = schedule(setIsBlackBlinking);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (isTyping) {
      setIsLookingAtEachOther(true);
      const t = setTimeout(() => setIsLookingAtEachOther(false), 800);
      return () => clearTimeout(t);
    }
    setIsLookingAtEachOther(false);
  }, [isTyping]);

  useEffect(() => {
    if (passwordLength > 0 && showPassword) {
      const t = setTimeout(() => {
        setIsPurplePeeking(true);
        setTimeout(() => setIsPurplePeeking(false), 800);
      }, Math.random() * 3000 + 2000);
      return () => clearTimeout(t);
    }
    setIsPurplePeeking(false);
  }, [passwordLength, showPassword, isPurplePeeking]);

  const calcPos = (ref) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const r = ref.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 3);
    return {
      faceX: Math.max(-15, Math.min(15, dx / 20)),
      faceY: Math.max(-10, Math.min(10, dy / 30)),
      bodySkew: Math.max(-6, Math.min(6, -dx / 120)),
    };
  };

  const pp = calcPos(purpleRef);
  const bp = calcPos(blackRef);
  const yp = calcPos(yellowRef);
  const op = calcPos(orangeRef);
  const hiding = passwordLength > 0 && !showPassword;
  const showing = passwordLength > 0 && showPassword;

  return (
    <div className='relative' style={{ width: 440, height: 320 }}>
      {/* Purple */}
      <div ref={purpleRef} className='absolute bottom-0 transition-all duration-700 ease-in-out' style={{
        left: 56, width: 144, height: (isTyping || hiding) ? 352 : 320,
        backgroundColor: '#6C3FF5', borderRadius: '10px 10px 0 0', zIndex: 1,
        transform: showing ? 'skewX(0deg)' : (isTyping || hiding) ? `skewX(${(pp.bodySkew || 0) - 12}deg) translateX(32px)` : `skewX(${pp.bodySkew || 0}deg)`,
        transformOrigin: 'bottom center',
      }}>
        <div className='absolute flex gap-6 transition-all duration-700 ease-in-out' style={{
          left: showing ? 16 : isLookingAtEachOther ? 44 : 36 + pp.faceX,
          top: showing ? 28 : isLookingAtEachOther ? 52 : 32 + pp.faceY,
        }}>
          <EyeBall size={14} pupilSize={6} maxDistance={4} eyeColor='white' pupilColor='#2D2D2D' isBlinking={isPurpleBlinking}
            forceLookX={showing ? (isPurplePeeking ? 3 : -3) : isLookingAtEachOther ? 2 : undefined}
            forceLookY={showing ? (isPurplePeeking ? 4 : -3) : isLookingAtEachOther ? 3 : undefined} />
          <EyeBall size={14} pupilSize={6} maxDistance={4} eyeColor='white' pupilColor='#2D2D2D' isBlinking={isPurpleBlinking}
            forceLookX={showing ? (isPurplePeeking ? 3 : -3) : isLookingAtEachOther ? 2 : undefined}
            forceLookY={showing ? (isPurplePeeking ? 4 : -3) : isLookingAtEachOther ? 3 : undefined} />
        </div>
      </div>
      {/* Black */}
      <div ref={blackRef} className='absolute bottom-0 transition-all duration-700 ease-in-out' style={{
        left: 192, width: 96, height: 248, backgroundColor: '#2D2D2D', borderRadius: '8px 8px 0 0', zIndex: 2,
        transform: showing ? 'skewX(0deg)' : isLookingAtEachOther ? `skewX(${(bp.bodySkew || 0) * 1.5 + 10}deg) translateX(16px)` : (isTyping || hiding) ? `skewX(${(bp.bodySkew || 0) * 1.5}deg)` : `skewX(${bp.bodySkew || 0}deg)`,
        transformOrigin: 'bottom center',
      }}>
        <div className='absolute flex gap-5 transition-all duration-700 ease-in-out' style={{
          left: showing ? 8 : isLookingAtEachOther ? 26 : 21 + bp.faceX,
          top: showing ? 22 : isLookingAtEachOther ? 10 : 26 + bp.faceY,
        }}>
          <EyeBall size={13} pupilSize={5} maxDistance={3} eyeColor='white' pupilColor='#2D2D2D' isBlinking={isBlackBlinking}
            forceLookX={showing ? -3 : isLookingAtEachOther ? 0 : undefined}
            forceLookY={showing ? -3 : isLookingAtEachOther ? -3 : undefined} />
          <EyeBall size={13} pupilSize={5} maxDistance={3} eyeColor='white' pupilColor='#2D2D2D' isBlinking={isBlackBlinking}
            forceLookX={showing ? -3 : isLookingAtEachOther ? 0 : undefined}
            forceLookY={showing ? -3 : isLookingAtEachOther ? -3 : undefined} />
        </div>
      </div>
      {/* Orange */}
      <div ref={orangeRef} className='absolute bottom-0 transition-all duration-700 ease-in-out' style={{
        left: 0, width: 192, height: 160, backgroundColor: '#FF9B6B', borderRadius: '96px 96px 0 0', zIndex: 3,
        transform: showing ? 'skewX(0deg)' : `skewX(${op.bodySkew || 0}deg)`, transformOrigin: 'bottom center',
      }}>
        <div className='absolute flex gap-6 transition-all duration-200 ease-out' style={{
          left: showing ? 40 : 66 + (op.faceX || 0), top: showing ? 68 : 72 + (op.faceY || 0),
        }}>
          <Pupil size={10} maxDistance={4} pupilColor='#2D2D2D' forceLookX={showing ? -4 : undefined} forceLookY={showing ? -3 : undefined} />
          <Pupil size={10} maxDistance={4} pupilColor='#2D2D2D' forceLookX={showing ? -4 : undefined} forceLookY={showing ? -3 : undefined} />
        </div>
      </div>
      {/* Yellow */}
      <div ref={yellowRef} className='absolute bottom-0 transition-all duration-700 ease-in-out' style={{
        left: 248, width: 112, height: 184, backgroundColor: '#E8D754', borderRadius: '56px 56px 0 0', zIndex: 4,
        transform: showing ? 'skewX(0deg)' : `skewX(${yp.bodySkew || 0}deg)`, transformOrigin: 'bottom center',
      }}>
        <div className='absolute flex gap-5 transition-all duration-200 ease-out' style={{
          left: showing ? 16 : 42 + (yp.faceX || 0), top: showing ? 28 : 32 + (yp.faceY || 0),
        }}>
          <Pupil size={10} maxDistance={4} pupilColor='#2D2D2D' forceLookX={showing ? -4 : undefined} forceLookY={showing ? -3 : undefined} />
          <Pupil size={10} maxDistance={4} pupilColor='#2D2D2D' forceLookX={showing ? -4 : undefined} forceLookY={showing ? -3 : undefined} />
        </div>
        <div className='absolute w-16 h-[3px] bg-[#2D2D2D] rounded-full transition-all duration-200 ease-out' style={{
          left: showing ? 8 : 32 + (yp.faceX || 0), top: showing ? 70 : 70 + (yp.faceY || 0),
        }} />
      </div>
    </div>
  );
};

export default AnimatedCharacters;
