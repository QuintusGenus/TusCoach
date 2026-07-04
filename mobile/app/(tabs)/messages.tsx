import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchMessagesHistory } from '../../src/api/coach';
import { colors, shadows, typography } from '../../src/ui/theme';

export default function MessagesPage() {
    const { data: messages, isLoading, refetch } = useQuery({
        queryKey: ['messages'],
        queryFn: () => fetchMessagesHistory(20)
    });

    if (isLoading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={refetch} />
            }
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Mesajlar</Text>
                <Text style={styles.subtitle}>Koç mesajları ve güncellemeler</Text>
            </View>

            {/* Messages List */}
            <View style={styles.messagesList}>
                {messages && messages.length > 0 ? (
                    messages.map((message) => {
                        const date = new Date(message.created_at);
                        const dateStr = date.toLocaleDateString('tr-TR', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        return (
                            <View key={message.workflow_run_id} style={styles.messageCard}>
                                <View style={styles.messageHeader}>
                                    <Text style={styles.messageSubject}>
                                        {message.subject || 'Konu yok'}
                                    </Text>
                                    <Text style={styles.messageDate}>{dateStr}</Text>
                                </View>
                                <Text style={styles.messageBody}>{message.body}</Text>
                                <View style={styles.messageFooter}>
                                    <Text style={styles.workflowName}>
                                        {message.workflow_name.replace(/_/g, ' ')}
                                    </Text>
                                    {message.tone && (
                                        <Text style={styles.tone}>• {message.tone}</Text>
                                    )}
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                            Henüz mesaj yok. Koçunuz yakında size güncelleme gönderecek!
                        </Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.gray[100]
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.gray[100]
    },
    header: {
        padding: 20,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[200]
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.gray[900]
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 4
    },
    messagesList: {
        padding: 16
    },
    messageCard: {
        backgroundColor: colors.white,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8
    },
    messageSubject: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: colors.gray[900],
        marginRight: 8
    },
    messageDate: {
        fontSize: 12,
        color: '#999'
    },
    messageBody: {
        fontSize: 14,
        color: '#444',
        lineHeight: 20,
        marginBottom: 8
    },
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.gray[100]
    },
    workflowName: {
        fontSize: 12,
        color: colors.primary[500],
        fontWeight: '500',
        textTransform: 'capitalize'
    },
    tone: {
        fontSize: 12,
        color: '#999',
        marginLeft: 4
    },
    emptyState: {
        padding: 40,
        alignItems: 'center'
    },
    emptyText: {
        color: '#999',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20
    }
});
