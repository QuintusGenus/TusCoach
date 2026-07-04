import { Pressable, Text, ActivityIndicator } from "react-native";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

const variantClasses: Record<Variant, { container: string; text: string }> = {
  primary: {
    container: "bg-primary-600 active:bg-primary-700",
    text: "text-white font-semibold",
  },
  secondary: {
    container: "bg-gray-100 active:bg-gray-200",
    text: "text-gray-800 font-semibold",
  },
  outline: {
    container: "bg-transparent border border-primary-600 active:bg-primary-50",
    text: "text-primary-600 font-semibold",
  },
  ghost: {
    container: "bg-transparent active:bg-gray-100",
    text: "text-primary-600 font-medium",
  },
  danger: {
    container: "bg-danger active:opacity-80",
    text: "text-white font-semibold",
  },
};

const sizeClasses: Record<Size, { container: string; text: string }> = {
  sm: { container: "px-4 py-2 rounded-lg", text: "text-sm" },
  md: { container: "px-5 py-3 rounded-xl", text: "text-base" },
  lg: { container: "px-6 py-4 rounded-xl", text: "text-lg" },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  className = "",
}: ButtonProps) {
  const v = variantClasses[variant];
  const s = sizeClasses[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`flex-row items-center justify-center ${s.container} ${v.container} ${
        disabled ? "opacity-50" : ""
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "danger" ? "#fff" : "#004225"}
          className="mr-2"
        />
      ) : null}
      <Text className={`${s.text} ${v.text}`}>{title}</Text>
    </Pressable>
  );
}
