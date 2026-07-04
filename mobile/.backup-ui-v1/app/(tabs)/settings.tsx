import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuthStore } from '../../src/state/authStore';
import { useNotificationStore } from '../../src/state/notificationStore';
import { useState } from 'react';
import {
    requestNotificationPermissions,
    getExpoPushToken,
    getPlatform,
} from '../../src/services/notifications';
import { registerDevice } from '../../src/api/devices';

export default function SettingsPage() {
    const router = useRouter();
    const logout = useAuthStore((s) => s.logout);
    const {
        expoPushToken,
        permissionStatus,
        lastRegisteredAt,
        setExpoPushToken,
        setPermissionStatus,
        setLastRegisteredAt,
        clear: clearNotifications,
    } = useNotificationStore();
    const [registering, setRegistering] = useState(false);

    const handleReregister = async () => {
        setRegistering(true);
        try {
            // Request permissions
            const granted = await requestNotificationPermissions();
            if (!granted) {
                setPermissionStatus('denied');
                Alert.alert('İzin Reddedildi', 'Lütfen cihaz ayarlarından bildirimleri etkinleştirin.');
                return;
            }

            setPermissionStatus('granted');

            // Get push token
            const pushToken = await getExpoPushToken();
            if (!pushToken) {
                Alert.alert('Hata', 'Push token alınamadı. Fiziksel bir cihaz kullanıyor musunuz?');
                return;
            }

            // Save to store
            setExpoPushToken(pushToken);

            // Register with backend
            await registerDevice({
                platform: getPlatform(),
                expo_push_token: pushToken,
            });

            setLastRegisteredAt(new Date().toISOString());
            Alert.alert('Başarılı', 'Cihaz bildirimler için yeniden kaydedildi!');
        } catch (error) {
            console.error('[Settings] Re-registration failed:', error);
            Alert.alert('Hata', 'Cihaz kaydı başarısız. Lütfen tekrar deneyin.');
        } finally {
            setRegistering(false);
        }
    };

    const handleLogout = () => {
        clearNotifications();
        logout();
    };

    const formatToken = (token: string | null) => {
        if (!token) return 'Kayıtlı değil';
        // Show first 12 chars + ... + last 6 chars
        if (token.length <= 18) return token;
        return `${token.substring(0, 12)}...${token.substring(token.length - 6)}`;
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Hiçbir zaman';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'granted':
                return '#10b981'; // green
            case 'denied':
                return '#ef4444'; // red
            default:
                return '#6b7280'; // gray
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'granted':
                return 'Aktif';
            case 'denied':
                return 'Reddedildi';
            default:
                return 'Belirlenmedi';
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ayarlar</Text>

            {/* Preferences Section */}
            <TouchableOpacity
                onPress={() => router.push('/preferences')}
                style={styles.section}
                activeOpacity={0.7}
            >
                <View style={styles.navRow}>
                    <View style={styles.navLeft}>
                        <FontAwesome name="sliders" size={18} color="#004225" />
                        <Text style={styles.navLabel}>Çalışma Tercihleri</Text>
                    </View>
                    <FontAwesome name="chevron-right" size={14} color="#9ca3af" />
                </View>
                <Text style={styles.navHint}>Sınav tarihi, günlük hedefler, çalışma penceresi, sessiz saatler</Text>
            </TouchableOpacity>

            {/* Notifications Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bildirimler</Text>

                <View style={styles.row}>
                    <Text style={styles.label}>Durum:</Text>
                    <View style={[styles.badge, { backgroundColor: getStatusColor(permissionStatus) }]}>
                        <Text style={styles.badgeText}>{getStatusText(permissionStatus)}</Text>
                    </View>
                </View>

                <View style={styles.row}>
                    <Text style={styles.label}>Token:</Text>
                    <Text style={styles.value}>{formatToken(expoPushToken)}</Text>
                </View>

                <View style={styles.row}>
                    <Text style={styles.label}>Son Kayıt:</Text>
                    <Text style={styles.value}>{formatDate(lastRegisteredAt)}</Text>
                </View>

                <TouchableOpacity
                    onPress={handleReregister}
                    style={[styles.button, styles.reregisterButton]}
                    disabled={registering}
                >
                    {registering ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Cihazı Yeniden Kaydet</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Logout Section */}
            <View style={styles.section}>
                <TouchableOpacity onPress={handleLogout} style={[styles.button, styles.logoutButton]}>
                    <Text style={styles.buttonText}>Çıkış Yap</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f9fafb'
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 24,
        color: '#111827'
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
        color: '#374151'
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 4
    },
    label: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500'
    },
    value: {
        fontSize: 14,
        color: '#111827',
        flex: 1,
        textAlign: 'right',
        marginLeft: 8
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600'
    },
    button: {
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8
    },
    reregisterButton: {
        backgroundColor: '#004225'
    },
    logoutButton: {
        backgroundColor: '#dc2626'
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    },
    navRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    navLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    navLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    navHint: {
        fontSize: 13,
        color: '#9ca3af',
        marginTop: 6,
    },
});
