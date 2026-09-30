import React from 'react';

interface HStackProps {
  children: React.ReactNode;
  gap?: number;
  alignItems?: 'stretch' | 'center' | 'flex-start' | 'flex-end' | 'baseline';
  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  style?: React.CSSProperties;
  className?: string;
  wrap?: boolean;
}

const HStack = ({
  children,
  gap = 0,
  alignItems = 'center',
  justifyContent = 'flex-start',
  style,
  className,
  wrap = false,
}: HStackProps) => {
  
  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'row',
    alignItems,
    justifyContent,
    gap: `${gap}px`,
    flexWrap: wrap ? 'wrap' : 'nowrap',
    ...style,
  };

  return (
    <div style={containerStyle} className={className}>
      {children}
    </div>
  );
};

export default HStack;
