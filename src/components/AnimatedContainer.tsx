import { ReactNode } from 'react';

interface AnimatedContainerProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  animation?: 'fade-in' | 'fade-in-up' | 'scale-in' | 'slide-in-right';
}

export const AnimatedContainer = ({
  children,
  delay = 0,
  className = '',
  animation = 'fade-in-up'
}: AnimatedContainerProps) => {
  return (
    <div
      className={`animate-${animation} ${className}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      {children}
    </div>
  );
};

interface StaggeredListProps {
  children: ReactNode[];
  baseDelay?: number;
  staggerDelay?: number;
  className?: string;
  itemClassName?: string;
  animation?: 'fade-in' | 'fade-in-up' | 'scale-in' | 'slide-in-right';
}

export const StaggeredList = ({
  children,
  baseDelay = 0,
  staggerDelay = 100,
  className = '',
  itemClassName = '',
  animation = 'fade-in-up'
}: StaggeredListProps) => {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <AnimatedContainer
          key={index}
          delay={baseDelay + index * staggerDelay}
          className={itemClassName}
          animation={animation}
        >
          {child}
        </AnimatedContainer>
      ))}
    </div>
  );
};
