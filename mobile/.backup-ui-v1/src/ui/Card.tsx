import { View } from "react-native";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ children, className = "", noPadding = false }: CardProps) {
  return (
    <View
      className={`bg-white rounded-2xl border border-gray-200/60 shadow-sm shadow-black/10 ${
        noPadding ? "" : "p-4"
      } ${className}`}
    >
      {children}
    </View>
  );
}
