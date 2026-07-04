import { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    TouchableOpacity,
    StyleSheet,
    type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
    fetchChatHistory,
    streamChatMessage,
    type ChatMessage,
    type SSEEvent,
} from '../../src/api/chat';

interface LocalMessage extends ChatMessage {
    _optimistic?: boolean;
    _streaming?: boolean;
    _key?: string;
}

function MessageBubble({ message }: { message: LocalMessage }) {
    const isUser = message.role === 'user';

    return (
        <View style={[styles.bubbleRow, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
            {!isUser && (
                <View style={styles.avatarWrap}>
                    <FontAwesome name="graduation-cap" size={11} color="#004225" />
                </View>
            )}
            <View
                style={[
                    isUser ? styles.userBubble : styles.assistantBubble,
                    message._optimistic ? { opacity: 0.7 } : undefined,
                ]}
            >
                <Text style={isUser ? styles.userText : styles.assistantText}>
                    {message.content}
                    {message._streaming && message.content.length === 0 ? '...' : ''}
                </Text>
            </View>
        </View>
    );
}

export default function ChatScreen() {
    const [messages, setMessages] = useState<LocalMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList<LocalMessage>>(null);
    const abortRef = useRef<AbortController | null>(null);
    const streamKeyRef = useRef<string>('');
    const sendingRef = useRef(false);
    const queryClient = useQueryClient();

    const { isLoading, data: historyData } = useQuery({
        queryKey: ['chat-history'],
        queryFn: () => fetchChatHistory(50),
        staleTime: 0,
        refetchOnMount: 'always' as const,
    });

    useEffect(() => {
        if (historyData?.messages && !sendingRef.current) {
            setMessages(historyData.messages);
        }
    }, [historyData]);

    const handleSend = useCallback(async () => {
        const text = input.trim();
        if (!text || sending) return;

        setInput('');
        setSending(true);
        sendingRef.current = true;

        const now = Date.now();
        streamKeyRef.current = `stream-${now}`;

        const optimisticUser: LocalMessage = {
            id: now,
            role: 'user',
            content: text,
            created_at: new Date().toISOString(),
            _optimistic: true,
            _key: `user-${now}`,
        };

        const streamingAssistant: LocalMessage = {
            id: now + 1,
            role: 'assistant',
            content: '',
            created_at: new Date().toISOString(),
            _streaming: true,
            _key: streamKeyRef.current,
        };

        setMessages((prev) => [...prev, optimisticUser, streamingAssistant]);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            await streamChatMessage(
                text,
                (event: SSEEvent) => {
                    if (event.type === 'token') {
                        setMessages((prev) => {
                            const updated = [...prev];
                            const last = updated[updated.length - 1];
                            if (last._streaming) {
                                updated[updated.length - 1] = {
                                    ...last,
                                    content: last.content + event.content,
                                };
                            }
                            return updated;
                        });
                    } else if (event.type === 'done') {
                        setMessages((prev) => {
                            const updated = [...prev];
                            const userIdx = updated.findIndex(
                                (m) => m._optimistic && m.id === optimisticUser.id
                            );
                            if (userIdx !== -1) {
                                updated[userIdx] = { ...updated[userIdx], _optimistic: false };
                            }
                            const last = updated[updated.length - 1];
                            if (last._streaming) {
                                updated[updated.length - 1] = {
                                    ...last,
                                    id: event.message_id,
                                    _streaming: false,
                                };
                            }
                            return updated;
                        });
                    }
                },
                controller.signal,
            );
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return;
            setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last._streaming) {
                    updated[updated.length - 1] = {
                        ...last,
                        content: last.content || 'Bir hata oluştu. Lütfen tekrar deneyin.',
                        _streaming: false,
                    };
                }
                return updated;
            });
        } finally {
            setSending(false);
            sendingRef.current = false;
            abortRef.current = null;
            queryClient.invalidateQueries({ queryKey: ['chat-history'] });
        }
    }, [input, sending, queryClient]);

    const renderMessage = ({ item }: ListRenderItemInfo<LocalMessage>) => (
        <MessageBubble message={item} />
    );

    const keyExtractor = (item: LocalMessage, index: number) =>
        item._key || `${item.id}-${item.role}`;

    if (isLoading) {
        return (
            <SafeAreaView edges={['top']} style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#004225" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top']} style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={0}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerAvatar}>
                        <FontAwesome name="graduation-cap" size={14} color="#fff" />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>TUS Koç</Text>
                        <Text style={styles.headerSubtitle}>Yapay zeka çalışma asistanınız</Text>
                    </View>
                </View>

                {/* Messages */}
                {messages.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIcon}>
                            <FontAwesome name="graduation-cap" size={28} color="#004225" />
                        </View>
                        <Text style={styles.emptyTitle}>TUS Koçunuza Sorun</Text>
                        <Text style={styles.emptyText}>
                            Çalışma planı, konu tekrarı ve motivasyon desteği alabilirsiniz.
                        </Text>
                        <View style={styles.suggestionsRow}>
                            {['Plan oluştur', 'Bugün ne çalışmalıyım?'].map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    style={styles.suggestion}
                                    onPress={() => setInput(s)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.suggestionText}>{s}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={[...messages].reverse()}
                        renderItem={renderMessage}
                        keyExtractor={keyExtractor}
                        inverted
                        contentContainerStyle={{
                            paddingTop: 8,
                            paddingBottom: 16,
                        }}
                        extraData={sending}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                {/* Input bar */}
                <View style={styles.inputBar}>
                    <SafeAreaView edges={['bottom']}>
                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Koçunuza sorun..."
                                placeholderTextColor="#9ca3af"
                                value={input}
                                onChangeText={setInput}
                                multiline
                                editable={!sending}
                                onSubmitEditing={handleSend}
                                blurOnSubmit={false}
                            />
                            <TouchableOpacity
                                onPress={handleSend}
                                disabled={!input.trim() || sending}
                                style={[
                                    styles.sendButton,
                                    input.trim() && !sending
                                        ? styles.sendButtonActive
                                        : styles.sendButtonDisabled,
                                ]}
                                activeOpacity={0.7}
                            >
                                {sending ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <FontAwesome
                                        name="arrow-up"
                                        size={16}
                                        color={input.trim() ? '#fff' : '#9ca3af'}
                                    />
                                )}
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f6f8',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#f5f6f8',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#fff',
        borderBottomWidth: 0,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    headerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#004225',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingBottom: 60,
    },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: '#e8f5ee',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
        lineHeight: 20,
    },
    suggestionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    suggestion: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#e8f5ee',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    suggestionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#004225',
    },
    bubbleRow: {
        flexDirection: 'row',
        marginBottom: 12,
        paddingHorizontal: 16,
        alignItems: 'flex-end',
    },
    avatarWrap: {
        width: 26,
        height: 26,
        borderRadius: 9,
        backgroundColor: '#e8f5ee',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        marginBottom: 2,
    },
    userBubble: {
        backgroundColor: '#004225',
        borderRadius: 18,
        borderBottomRightRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        maxWidth: '78%',
        shadowColor: '#004225',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    assistantBubble: {
        backgroundColor: '#fff',
        borderRadius: 18,
        borderBottomLeftRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        maxWidth: '78%',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
    },
    userText: {
        fontSize: 15,
        color: '#fff',
        lineHeight: 21,
    },
    assistantText: {
        fontSize: 15,
        color: '#1f2937',
        lineHeight: 21,
    },
    inputBar: {
        borderTopWidth: 0,
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 10,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: -2 },
        elevation: 8,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    textInput: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        borderRadius: 22,
        paddingHorizontal: 18,
        paddingVertical: 12,
        fontSize: 15,
        color: '#111',
        maxHeight: 96,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    sendButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonActive: {
        backgroundColor: '#004225',
        shadowColor: '#004225',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    sendButtonDisabled: {
        backgroundColor: '#e5e7eb',
    },
});
