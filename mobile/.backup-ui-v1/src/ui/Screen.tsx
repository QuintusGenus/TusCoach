import { View, Text, ScrollView, type RefreshControlProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode, ReactElement } from "react";

interface ScreenProps {
  children: ReactNode;
  title?: string;
  right?: ReactNode;
  scroll?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  className?: string;
}

export function Screen({
  children,
  title,
  right,
  scroll = true,
  refreshControl,
  className = "",
}: ScreenProps) {
  const header =
    title || right ? (
      <View className="flex-row items-center justify-between mb-4">
        {title ? (
          <Text className="text-2xl font-bold text-gray-900">{title}</Text>
        ) : (
          <View />
        )}
        {right ?? null}
      </View>
    ) : null;

  if (scroll) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <ScrollView
          className={`flex-1 px-4 pt-3 ${className}`}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {header}
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className={`flex-1 px-4 pt-3 ${className}`}>
        {header}
        {children}
      </View>
    </SafeAreaView>
  );
}
