import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMessageById, markMessageRead } from '../../src/api/coach';
import { colors, shadows, typography } from '../../src/ui/theme';

export default function MessageDetailPage() {
    const params = useLocalSearchParams();
    const queryClient = useQueryClient();

    const messageId = parseInt(params.id as string, 10);

    // Fetch message data by ID
    const { data: message, isLoading, error } = useQuery({
        queryKey: ['message', messageId],
        queryFn: () => fetchMessageById(messageId),
        enabled: !isNaN(messageId),
    });

    // Mark read mutation
    const markReadMutation = useMutation({
        mutationFn: markMessageRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['messages'] });
            queryClient.invalidateQueries({ queryKey: ['message', messageId] });
            queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
        }
    });

    // Mark message as read when loaded
    useEffect(() => {
        if (message && message.id && !message.read_at) {
            markReadMutation.mutate(message.id);
        }
    }, [message]);

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (isLoading) {
        return (
            <>
                <Stack.Screen
                    options={{
                        title: 'Mesaj',
                        headerBackTitle: 'Gelen Kutusu'
                    }}
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary[500]} />
                    <Text style={styles.loadingText}>Mesaj yükleniyor...</Text>
                </View>
            </>
        );
    }

    if (error || !message) {
        return (
            <>
                <Stack.Screen
                    options={{
                        title: 'Mesaj',
                        headerBackTitle: 'Gelen Kutusu'
                    }}
                />
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>
                        {error ? 'Mesaj yüklenemedi' : 'Mesaj bulunamadı'}
                    </Text>
                    <Text style={styles.errorSubtext}>
                        Bu mesaj silinmiş olabilir veya erişiminiz olmayabilir.
                    </Text>
                </View>
            </>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    title: 'Mesaj',
                    headerBackTitle: 'Gelen Kutusu'
                }}
            />
            <ScrollView style={styles.container}>
                <View style={styles.content}>
                    {/* Subject */}
                    <Text style={styles.subject}>
                        {message.subject || 'Konu Yok'}
                    </Text>

                    {/* Metadata */}
                    <View style={styles.metadata}>
                        <Text style={styles.date}>{formatDate(message.created_at)}</Text>
                        <View style={styles.metadataRow}>
                            {message.workflow_name && (
                                <Text style={styles.workflowName}>
                                    {message.workflow_name.replace(/_/g, ' ')}
                                </Text>
                            )}
                            {message.tone && message.workflow_name && (
                                <>
                                    <Text style={styles.separator}>•</Text>
                                    <Text style={styles.tone}>{message.tone}</Text>
                                </>
                            )}
                            {message.tone && !message.workflow_name && (
                                <Text style={styles.tone}>{message.tone}</Text>
                            )}
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Body */}
                    <Text style={styles.body}>{message.body}</Text>
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white
    },
    content: {
        padding: 20
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.white
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666'
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.white,
        padding: 20
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.danger,
        marginBottom: 8,
        textAlign: 'center'
    },
    errorSubtext: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center'
    },
    subject: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.gray[900],
        lineHeight: 32,
        marginBottom: 12
    },
    metadata: {
        marginBottom: 20
    },
    date: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8
    },
    metadataRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    workflowName: {
        fontSize: 13,
        color: colors.primary[500],
        fontWeight: '600',
        textTransform: 'capitalize'
    },
    separator: {
        fontSize: 13,
        color: '#ccc',
        marginHorizontal: 8
    },
    tone: {
        fontSize: 13,
        color: '#999',
        fontStyle: 'italic'
    },
    divider: {
        height: 1,
        backgroundColor: colors.gray[200],
        marginBottom: 20
    },
    body: {
        fontSize: 16,
        color: '#333',
        lineHeight: 24,
        letterSpacing: 0.2
    }
});
