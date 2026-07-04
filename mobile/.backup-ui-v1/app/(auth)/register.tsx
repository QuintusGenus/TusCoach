import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { register, fetchMe } from '../../src/api/auth';
import { useAuthStore } from '../../src/state/authStore';
import { useRouter } from 'expo-router';

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
            setError('Lütfen tüm alanları doldurun');
            return;
        }
        if (password !== confirmPassword) {
            setError('Şifreler eşleşmiyor');
            return;
        }
        if (password.length < 6) {
            setError('Şifre en az 6 karakter olmalıdır');
            return;
        }

        setLoading(true);
        setError('');
        try {
            // Step 1: Register user (returns user data directly)
            const userData = await register(email, password);

            // Step 2: Login to get token (backend doesn't auto-login on register)
            // For now, redirect to login
            router.replace('/(auth)/login');
        } catch (e: any) {
            const errorMsg = e.response?.data?.detail || 'Kayıt başarısız. Lütfen tekrar deneyin.';
            setError(errorMsg);
            console.error('Register error:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>TUS Coach</Text>
            <Text style={styles.subtitle}>Hesabınızı oluşturun</Text>

            <TextInput
                placeholder="E-posta"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
            />
            <TextInput
                placeholder="Şifre"
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                secureTextEntry
            />
            <TextInput
                placeholder="Şifre Tekrar"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={styles.input}
                secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity onPress={handleRegister} style={styles.button} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Kayıt Ol</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} style={styles.linkButton}>
                <Text style={styles.linkText}>Zaten hesabınız var mı? Giriş Yapın</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f9fafb' },
    title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, color: '#004225' },
    subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 32, color: '#666' },
    input: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
    error: { color: '#dc2626', fontSize: 14, marginBottom: 12, textAlign: 'center' },
    button: { backgroundColor: '#004225', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    linkButton: { padding: 10, alignItems: 'center' },
    linkText: { color: '#004225', fontSize: 14 }
});
