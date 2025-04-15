
import { motion } from "framer-motion";
import React from "react";
import { cn } from "@/lib/utils";

export const FadeIn = ({ 
  children, 
  delay = 0,
  className,
  ...props 
}: { 
  children: React.ReactNode, 
  delay?: number,
  className?: string,
  [key: string]: any 
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className={className}
    {...props}
  >
    {children}
  </motion.div>
);

export const SlideIn = ({ 
  children, 
  direction = "left", 
  delay = 0,
  className,
  ...props 
}: { 
  children: React.ReactNode, 
  direction?: "left" | "right" | "up" | "down",
  delay?: number,
  className?: string,
  [key: string]: any 
}) => {
  const directionMap = {
    left: { x: -20, y: 0 },
    right: { x: 20, y: 0 },
    up: { x: 0, y: -20 },
    down: { x: 0, y: 20 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const AnimatedCard = ({ 
  children, 
  hover = true,
  className,
  ...props 
}: { 
  children: React.ReactNode,
  hover?: boolean,
  className?: string,
  [key: string]: any 
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={hover ? { y: -5, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" } : {}}
    transition={{ duration: 0.3 }}
    className={cn("rounded-lg", className)}
    {...props}
  >
    {children}
  </motion.div>
);

export const AnimatedButton = ({ 
  children, 
  className, 
  ...props 
}: { 
  children: React.ReactNode, 
  className?: string,
  [key: string]: any 
}) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    transition={{ duration: 0.2 }}
    className={className}
    {...props}
  >
    {children}
  </motion.button>
);

export const AnimatedList = ({ 
  children, 
  staggerDelay = 0.1,
  className,
  ...props 
}: { 
  children: React.ReactNode, 
  staggerDelay?: number,
  className?: string,
  [key: string]: any 
}) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const AnimatedListItem = ({ 
  children, 
  className,
  ...props 
}: { 
  children: React.ReactNode, 
  className?: string,
  [key: string]: any 
}) => {
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={item}
      transition={{ duration: 0.3 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};
