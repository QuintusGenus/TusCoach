import { TextInput, View, Text } from "react-native";
import { useState } from "react";

interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: TextInput["props"]["keyboardType"];
  autoCapitalize?: TextInput["props"]["autoCapitalize"];
  errorText?: string;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  className?: string;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  errorText,
  multiline = false,
  numberOfLines = 1,
  editable = true,
  className = "",
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className={className}>
      {label ? (
        <Text className="text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </Text>
      ) : null}
      <TextInput
        className={`bg-white border rounded-2xl px-4 py-3 text-base text-gray-900 ${
          focused
            ? "border-primary-500"
            : errorText
              ? "border-danger"
              : "border-gray-200"
        } ${multiline ? "min-h-[100px] text-top" : ""} ${
          !editable ? "opacity-60" : ""
        }`}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        numberOfLines={numberOfLines}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {errorText ? (
        <Text className="text-xs text-danger mt-1">{errorText}</Text>
      ) : null}
    </View>
  );
}
