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
            setError('Lütfen tüm alanları doldurun');
            return;
        }
        setLoading(true);
        setError('');
        try {
            // Step 1: Login and get token
            const loginData = await login(email, password);

            // Step 2: Set token temporarily to enable authenticated requests
            setAuth(loginData.access_token, null as any);

            // Step 3: Fetch user data
            const userData = await fetchMe();

            // Step 4: Store both token and user data
            setAuth(loginData.access_token, userData);

            // Step 5: Register for push notifications
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
                        console.log('[Login] Device registered for notifications');
                    }
                } else {
                    setPermissionStatus('denied');
                }
            } catch (notifError) {
                // Don't fail login if notification registration fails
                console.error('[Login] Notification registration failed:', notifError);
            }
        } catch (e: any) {
            setError('Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
            console.error('Login error:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>TUS Coach</Text>
            <Text style={styles.subtitle}>Hesabınıza giriş yapın</Text>

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

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity onPress={handleLogin} style={styles.button} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Giriş Yap</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.linkButton}>
                <Text style={styles.linkText}>Hesabınız yok mu? Kayıt Olun</Text>
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
