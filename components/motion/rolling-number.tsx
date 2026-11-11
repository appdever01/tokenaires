"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { useEffect, useState } from "react";

interface RollingNumberProps {
  value: number;
  format?: Format;
  className?: string;
}

export function RollingNumber({ value, format, className }: RollingNumberProps) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    setShown(value);
  }, [value]);
  return <NumberFlow value={shown} format={format} className={className} />;
}
