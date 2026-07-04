import { View, Text, ScrollView, type RefreshControlProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, TouchableOpacity } from 'react-native';
import type { ReactNode, ReactElement } from 'react';
import { colors, typography, radius } from './theme';

interface ScreenProps {
  children: ReactNode;
  title?: string;
  right?: ReactNode;
  scroll?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  className?: string;
  showTopBar?: boolean;
}

export function Screen({
  children,
  title,
  right,
  scroll = true,
  refreshControl,
  className = '',
  showTopBar = true,
}: ScreenProps) {
  const header =
    title || right ? (
      <View style={styles.screenHeader}>
        {title ? <Text style={styles.screenTitle}>{title}</Text> : <View />}
        {right ?? null}
      </View>
    ) : null;

  if (scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {showTopBar && <TopBar />}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          className={className}
        >
          {header}
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {showTopBar && <TopBar />}
      <View style={[styles.scroll]} className={className}>
        {header}
        {children}
      </View>
    </SafeAreaView>
  );
}

function TopBar() {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        <View style={styles.avatar}>
          <MaterialIcons name="person" size={18} color={colors.primary.onContainer} />
        </View>
        <Text style={styles.appTitle}>TusCoach App</Text>
      </View>
      <TouchableOpacity style={styles.notifBtn}>
        <MaterialIcons name="notifications" size={22} color={colors.primary.main} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface.main,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.fixed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary.main,
    letterSpacing: -0.5,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  screenTitle: {
    ...typography.h2,
    color: colors.primary.main,
  },
});
