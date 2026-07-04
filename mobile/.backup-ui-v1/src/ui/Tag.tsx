import { View, Text } from "react-native";

type TagVariant = "neutral" | "primary" | "success" | "warning" | "danger";

interface TagProps {
  label: string;
  variant?: TagVariant;
  className?: string;
}

const variantClasses: Record<TagVariant, { bg: string; text: string }> = {
  neutral: { bg: "bg-gray-100", text: "text-gray-600" },
  primary: { bg: "bg-primary-100", text: "text-primary-700" },
  success: { bg: "bg-emerald-100", text: "text-emerald-700" },
  warning: { bg: "bg-amber-100", text: "text-amber-700" },
  danger: { bg: "bg-red-100", text: "text-red-700" },
};

export function Tag({ label, variant = "neutral", className = "" }: TagProps) {
  const v = variantClasses[variant];

  return (
    <View className={`self-start px-2.5 py-1 rounded-full ${v.bg} ${className}`}>
      <Text className={`text-xs font-semibold ${v.text}`}>{label}</Text>
    </View>
  );
}
