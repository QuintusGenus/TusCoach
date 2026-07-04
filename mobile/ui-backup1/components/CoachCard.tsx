import { View, Text, StyleSheet } from 'react-native';

interface CoachCardProps {
    message: {
        subject: string;
        body: string;
        tone?: string;
        created_at?: string;
        workflow_name?: string;
    } | null;
}

export const CoachCard = ({ message }: CoachCardProps) => {
    if (!message) return null;

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
            <View style={styles.header}>
                {message.tone && <Text style={styles.tone}>{message.tone.toUpperCase()}</Text>}
                {message.created_at && <Text style={styles.date}>{formatDate(message.created_at)}</Text>}
            </View>
            <Text style={styles.subject}>{message.subject}</Text>
            <Text style={styles.body}>{message.body}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        padding: 16,
        backgroundColor: '#fff',
        margin: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    tone: { fontSize: 10, color: '#666', fontWeight: '600' },
    date: { fontSize: 11, color: '#999' },
    subject: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
    body: { fontSize: 14, lineHeight: 20, color: '#333' },
});
