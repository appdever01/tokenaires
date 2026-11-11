"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { useEffect, useState } from "react";

interface RollingNumberProps {
  value: number;
  format?: Format;
  className?: string;
}

export function RollingNumber({ value, format, className }: RollingNumberProps) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <NumberFlow value={shown} format={format} className={className} willChange />;
}
