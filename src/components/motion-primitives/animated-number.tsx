"use client";
// motion-primitives · animated-number (MIT, © ibelick) — adapted: memoised motion component, React 19 JSX types.
import { cn } from "@/lib/utils";
import { motion, type SpringOptions, useSpring, useTransform } from "motion/react";
import { useEffect, useMemo } from "react";

export type AnimatedNumberProps = {
  value: number;
  className?: string;
  springOptions?: SpringOptions;
  as?: React.ElementType;
};

export function AnimatedNumber({ value, className, springOptions, as = "span" }: AnimatedNumberProps) {
  const MotionComponent = useMemo(() => motion.create(as as keyof React.JSX.IntrinsicElements), [as]);

  const spring = useSpring(0, springOptions);
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <MotionComponent className={cn("tabular-nums", className)}>{display}</MotionComponent>;
}
