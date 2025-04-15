
import { HTMLMotionProps, motion } from "framer-motion";
import React from "react";

export const fadeIn = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

export const slideIn = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

type MotionDivProps = HTMLMotionProps<"div"> & {
  children: React.ReactNode;
};

export const MotionDiv: React.FC<MotionDivProps> = ({ children, ...props }) => (
  <motion.div
    initial="initial"
    animate="animate"
    exit="exit"
    variants={fadeIn}
    transition={{ duration: 0.3 }}
    {...props}
  >
    {children}
  </motion.div>
);

export const MotionCard: React.FC<MotionDivProps> = ({ children, ...props }) => (
  <motion.div
    initial="initial"
    animate="animate"
    exit="exit"
    variants={scaleIn}
    transition={{ duration: 0.3 }}
    className="rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:shadow-md"
    {...props}
  >
    {children}
  </motion.div>
);

export const MotionButton: React.FC<HTMLMotionProps<"button"> & { children: React.ReactNode }> = ({ children, className, ...props }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    transition={{ duration: 0.2 }}
    className={className}
    {...props}
  >
    {children}
  </motion.button>
);
