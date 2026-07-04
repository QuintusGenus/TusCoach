import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { register, fetchMe } from '../../src/api/auth';
import { useAuthStore } from '../../src/state/authStore';
import { useRouter } from 'expo-router';
import { colors, shadows, typography } from '../../src/ui/theme';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const setAuth = useAuthStore((s) => s.setAuth);
    const router = useRouter();

    const handleRegister = async () => {
        if (!email || !password || !confirmPassword) {
            setError('Lutfen tum alanlari doldurun');
            return;
        }
        if (password !== confirmPassword) {
            setError('Sifreler eslemiyor');
            return;
        }
        if (password.length < 6) {
            setError('Sifre en az 6 karakter olmalidir');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const userData = await register(email, password);
            router.replace('/(auth)/login');
        } catch (e: any) {
            const errorMsg = e.response?.data?.detail || 'Kayit basarisiz. Lutfen tekrar deneyin.';
            setError(errorMsg);
            console.error('Register error:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.brandMark}>
                <Text style={styles.brandLetter}>T</Text>
            </View>
            <Text style={styles.title}>TusCoach</Text>
            <Text style={styles.subtitle}>Hesabinizi olusturun</Text>

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
                <TextInput
                    placeholder="Sifre Tekrar"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    style={styles.input}
                    secureTextEntry
                    placeholderTextColor={colors.gray[400]}
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity
                    onPress={handleRegister}
                    style={styles.button}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={styles.buttonText}>Kayit Ol</Text>
                    )}
                </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => router.back()} style={styles.linkButton}>
                <Text style={styles.linkText}>
                    Zaten hesabiniz var mi? <Text style={styles.linkBold}>Giris Yapin</Text>
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
