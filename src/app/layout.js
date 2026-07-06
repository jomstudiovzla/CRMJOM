'use client';

import { useEffect } from 'react';
import './globals.css';

export default function RootLayout({ children }) {
  useEffect(() => {
    // Custom cursor logic from JOM Studio V2
    const dot = document.getElementById('custom-cursor-dot');
    const circle = document.getElementById('custom-cursor-circle');
    
    if (!dot || !circle) return;

    let mouseX = 0;
    let mouseY = 0;
    let circleX = 0;
    let circleY = 0;

    const onMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      
      dot.style.opacity = 1;
      circle.style.opacity = 1;
      
      dot.style.transform = `translate(${mouseX - 5}px, ${mouseY - 5}px)`;
    };

    const animateCircle = () => {
      // Smooth follow for the circle
      circleX += (mouseX - circleX) * 0.15;
      circleY += (mouseY - circleY) * 0.15;
      
      // Update position with dynamic center offset (considering sizes change on hover)
      const isHover = document.body.classList.contains('cursor-hover');
      const offset = isHover ? 26 : 19; 
      
      circle.style.transform = `translate(${circleX - offset}px, ${circleY - offset}px)`;
      
      requestAnimationFrame(animateCircle);
    };

    const addHoverClass = () => document.body.classList.add('cursor-hover');
    const removeHoverClass = () => document.body.classList.remove('cursor-hover');

    const attachHoverListeners = () => {
      const interactables = document.querySelectorAll('a, button, input, textarea, select, .interactable');
      interactables.forEach(el => {
        el.addEventListener('mouseenter', addHoverClass);
        el.addEventListener('mouseleave', removeHoverClass);
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    requestAnimationFrame(animateCircle);
    
    // Initial attach
    attachHoverListeners();

    // Re-attach on dom changes (simple mutation observer)
    const observer = new MutationObserver(() => {
      attachHoverListeners();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      observer.disconnect();
    };
  }, []);

  return (
    <html lang="es">
      <head>
        <title>JOM Studio | CRM Pro</title>
        <link rel="icon" href="/logo_jom_square.jpg" sizes="any" />
        <link rel="apple-touch-icon" href="/logo_jom_square.jpg" />
        <meta property="og:title" content="JOM Studio | CRM Pro" />
        <meta property="og:description" content="Portal administrativo y CRM de JOM Studio." />
        <meta property="og:image" content="/logo_jom_square.jpg" />
        <meta property="og:url" content="http://localhost:3000" />
      </head>
      <body>
        <div id="custom-cursor-dot" className="hidden md:block"></div>
        <div id="custom-cursor-circle" className="hidden md:block"></div>
        {children}
      </body>
    </html>
  );
}
