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

// ── Local message type (extends API type with optimistic fields) ──

interface LocalMessage extends ChatMessage {
    _optimistic?: boolean;
    _streaming?: boolean;
    _key?: string;
}

// ── Message bubble ──

function MessageBubble({ message }: { message: LocalMessage }) {
    const isUser = message.role === 'user';

    return (
        <View style={[styles.bubbleRow, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
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

// ── Main chat screen ──

export default function ChatScreen() {
    const [messages, setMessages] = useState<LocalMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList<LocalMessage>>(null);
    const abortRef = useRef<AbortController | null>(null);
    const streamKeyRef = useRef<string>('');
    const sendingRef = useRef(false);
    const queryClient = useQueryClient();

    // Load history on mount
    const { isLoading, data: historyData } = useQuery({
        queryKey: ['chat-history'],
        queryFn: () => fetchChatHistory(50),
        staleTime: 0,
        refetchOnMount: 'always' as const,
    });

    // Sync history → local state, but only when not actively sending
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

        // Optimistic user message
        const optimisticUser: LocalMessage = {
            id: now,
            role: 'user',
            content: text,
            created_at: new Date().toISOString(),
            _optimistic: true,
            _key: `user-${now}`,
        };

        // Placeholder for streaming assistant message
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
            // Refetch history so server IDs are in sync
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
                    <Text style={styles.headerTitle}>TUS Koç</Text>
                </View>

                {/* Messages */}
                {messages.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <FontAwesome name="comments-o" size={48} color="#d1d5db" />
                        <Text style={styles.emptyText}>
                            Çalışma koçunuzla sohbete başlayın
                        </Text>
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
        backgroundColor: '#f3f4f6',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#111',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyText: {
        fontSize: 15,
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 16,
    },
    bubbleRow: {
        flexDirection: 'row',
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    userBubble: {
        backgroundColor: '#004225',
        borderRadius: 16,
        borderBottomRightRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        maxWidth: '80%',
    },
    assistantBubble: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        maxWidth: '80%',
        borderWidth: 1,
        borderColor: '#e5e7eb',
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
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    textInput: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: '#111',
        maxHeight: 96,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonActive: {
        backgroundColor: '#004225',
    },
    sendButtonDisabled: {
        backgroundColor: '#e5e7eb',
    },
});
