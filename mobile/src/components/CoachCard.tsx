import { View, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, shadows, typography } from '../ui/theme';

interface CoachCardProps {
    message: {
        subject: string;
        body: string;
        tone?: string;
        created_at?: string;
        workflow_name?: string;
    } | null;
}

const TONE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
    encouraging: { icon: 'star', color: colors.accent[600], bg: colors.accent[50], label: 'Motive Edici' },
    cautionary: { icon: 'exclamation-circle', color: colors.danger, bg: '#FEF2F2', label: 'Uyarı' },
    analytical: { icon: 'bar-chart', color: colors.info, bg: '#EFF6FF', label: 'Analitik' },
    neutral: { icon: 'info-circle', color: colors.gray[500], bg: colors.gray[50], label: 'Bilgi' },
};

export const CoachCard = ({ message }: CoachCardProps) => {
    if (!message) return null;

    const tone = message.tone?.toLowerCase() || 'neutral';
    const toneConfig = TONE_CONFIG[tone] || TONE_CONFIG.neutral;

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <View style={styles.card}>
            <View style={[styles.accentBar, { backgroundColor: toneConfig.color }]} />
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={[styles.toneBadge, { backgroundColor: toneConfig.bg }]}>
                        <FontAwesome name={toneConfig.icon as any} size={10} color={toneConfig.color} />
                        <Text style={[styles.toneText, { color: toneConfig.color }]}>
                            {toneConfig.label}
                        </Text>
                    </View>
                    {message.created_at && (
                        <Text style={styles.date}>{formatDate(message.created_at)}</Text>
                    )}
                </View>
                <Text style={styles.subject}>{message.subject}</Text>
                <Text style={styles.body}>{message.body}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: colors.white,
        marginHorizontal: 20,
        borderRadius: 12,
        overflow: 'hidden',
        ...shadows.md,
    },
    accentBar: {
        width: 3,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    toneBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    toneText: {
        fontSize: 11,
        fontWeight: '600',
    },
    date: {
        fontSize: 11,
        color: colors.gray[400],
    },
    subject: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.gray[900],
        marginBottom: 6,
        lineHeight: 22,
    },
    body: {
        fontSize: 14,
        lineHeight: 21,
        color: colors.gray[600],
    },
});
