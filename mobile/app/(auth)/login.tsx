import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { login, fetchMe } from '../../src/api/auth';
import { useAuthStore } from '../../src/state/authStore';
import { useNotificationStore } from '../../src/state/notificationStore';
import { useRouter } from 'expo-router';
import {
    requestNotificationPermissions,
    getExpoPushToken,
    getPlatform,
} from '../../src/services/notifications';
import { registerDevice } from '../../src/api/devices';
import { colors, shadows, typography } from '../../src/ui/theme';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const setAuth = useAuthStore((s) => s.setAuth);
    const {
        setExpoPushToken,
        setPermissionStatus,
        setLastRegisteredAt,
    } = useNotificationStore();
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Lutfen tum alanlari doldurun');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const loginData = await login(email, password);
            setAuth(loginData.access_token, null as any);
            const userData = await fetchMe();
            setAuth(loginData.access_token, userData);

            try {
                const granted = await requestNotificationPermissions();
                if (granted) {
                    setPermissionStatus('granted');
                    const pushToken = await getExpoPushToken();
                    if (pushToken) {
                        setExpoPushToken(pushToken);
                        await registerDevice({
                            platform: getPlatform(),
                            expo_push_token: pushToken,
                        });
                        setLastRegisteredAt(new Date().toISOString());
                    }
                } else {
                    setPermissionStatus('denied');
                }
            } catch (notifError) {
                console.error('[Login] Notification registration failed:', notifError);
            }
        } catch (e: any) {
            setError('Giris basarisiz. Lutfen bilgilerinizi kontrol edin.');
            console.error('Login error:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Brand Mark */}
            <View style={styles.brandMark}>
                <Text style={styles.brandLetter}>T</Text>
            </View>
            <Text style={styles.title}>TusCoach</Text>
            <Text style={styles.subtitle}>Hesabiniza giris yapin</Text>

            <View style={styles.form}>
                <TextInput
                    placeholder="E-posta"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholderTextColor={colors.gray[400]}
                />
                <TextInput
                    placeholder="Sifre"
                    value={password}
                    onChangeText={setPassword}
                    style={styles.input}
                    secureTextEntry
                    placeholderTextColor={colors.gray[400]}
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity
                    onPress={handleLogin}
                    style={styles.button}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={styles.buttonText}>Giris Yap</Text>
                    )}
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                onPress={() => router.push('/(auth)/register')}
                style={styles.linkButton}
            >
                <Text style={styles.linkText}>
                    Hesabiniz yok mu? <Text style={styles.linkBold}>Kayit Olun</Text>
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        backgroundColor: colors.background,
    },
    brandMark: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 16,
        ...shadows.hero,
    },
    brandLetter: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.white,
    },
    title: {
        ...typography.h1,
        textAlign: 'center',
        color: colors.gray[900],
        marginBottom: 6,
    },
    subtitle: {
        ...typography.body,
        textAlign: 'center',
        color: colors.gray[500],
        marginBottom: 36,
    },
    form: {
        gap: 12,
    },
    input: {
        backgroundColor: colors.white,
        padding: 16,
        borderRadius: 12,
        ...typography.body,
        borderWidth: 1,
        borderColor: colors.gray[200],
        color: colors.gray[900],
    },
    error: {
        color: colors.danger,
        ...typography.caption,
        textAlign: 'center',
    },
    button: {
        backgroundColor: colors.primary[500],
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 4,
        ...shadows.md,
    },
    buttonText: {
        ...typography.body,
        color: colors.white,
        fontWeight: '700',
    },
    linkButton: {
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    linkText: {
        ...typography.body,
        color: colors.gray[500],
    },
    linkBold: {
        color: colors.primary[500],
        fontWeight: '600',
    },
});
