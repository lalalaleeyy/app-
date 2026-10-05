import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', variant = 'dark' }) => {
  const height = size === 'sm' ? 22 : size === 'lg' ? 44 : 30;
  const width = Math.round(height * (320 / 76));

  const textColor = variant === 'light' ? '#ffffff' : '#060b1e';

  return (
    <svg 
      className={`inline-block select-none ${className}`}
      width={width} 
      height={height} 
      viewBox="0 0 340 85" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ignite Vision"
    >
      {/* Three radiant red sparks above the 'I' */}
      <rect x="22" y="8" width="6" height="20" rx="3" fill="#ff1e27" />
      <rect x="10" y="16" width="5" height="15" rx="2.5" transform="rotate(-28 10 16)" fill="#ff1e27" />
      <rect x="36" y="14" width="5" height="15" rx="2.5" transform="rotate(28 36 14)" fill="#ff1e27" />
      
      {/* Red dot above second 'i' in Vision */}
      <circle cx="250" cy="18" r="8.5" fill="#ff1e27" />

      {/* Text "Ignite Vision" in bold rounded typography */}
      <text 
        x="6" 
        y="65" 
        fontFamily="'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        fontWeight="800" 
        fontSize="54" 
        fill={textColor} 
        letterSpacing="-1.8"
      >
        Ignite <tspan fill={textColor}>Vision</tspan>
      </text>
    </svg>
  );
};
