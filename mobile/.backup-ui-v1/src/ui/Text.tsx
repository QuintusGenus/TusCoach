import { Text as RNText } from "react-native";
import type { TextProps as RNTextProps } from "react-native";

type Variant = "title" | "subtitle" | "body" | "muted" | "caption";

interface TextProps extends RNTextProps {
  variant?: Variant;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  title: "text-2xl font-bold text-gray-900",
  subtitle: "text-lg font-semibold text-gray-800",
  body: "text-base text-gray-700",
  muted: "text-base text-gray-400",
  caption: "text-xs text-gray-500",
};

export function Text({
  variant = "body",
  className = "",
  ...rest
}: TextProps) {
  return <RNText className={`${variantClasses[variant]} ${className}`} {...rest} />;
}
