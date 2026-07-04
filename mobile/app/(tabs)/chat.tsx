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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  fetchChatHistory,
  streamChatMessage,
  type ChatMessage,
  type SSEEvent,
} from '../../src/api/chat';
import { colors, shadows, typography, radius, useThemeColors } from '../../src/ui/theme';

interface LocalMessage extends ChatMessage {
  _optimistic?: boolean;
  _streaming?: boolean;
  _key?: string;
}

// ─── Quick Suggestions ──────────────────────────────────────
const SUGGESTIONS = [
  'Bugün ne çalışmalıyım?',
  'Anatomi için ipucu ver',
  'Yanlışlarımı analiz et',
  'Motivasyon ver',
];

// ─── Message Bubble ─────────────────────────────────────────
function MessageBubble({ message }: { message: LocalMessage }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.bubbleRow, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
      {!isUser && (
        <View style={styles.aiBubbleIcon}>
          <MaterialIcons name="smart-toy" size={14} color={colors.white} />
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
  const c = useThemeColors();
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

  const handleSend = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride || input).trim();
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
                  (m) => m._optimistic && m.id === optimisticUser.id,
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
    },
    [input, sending, queryClient],
  );

  const renderMessage = ({ item }: ListRenderItemInfo<LocalMessage>) => (
    <MessageBubble message={item} />
  );

  const keyExtractor = (item: LocalMessage) => item._key || `${item.id}-${item.role}`;

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.loadingContainer, { backgroundColor: c.surface.main }]}>
        <ActivityIndicator size="large" color={c.primary.main} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: c.surface.main }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {/* ─── Top App Bar ──────────────────────────────── */}
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={[styles.avatar, { backgroundColor: c.primary.container }]}>
              <MaterialIcons name="person" size={18} color={c.primary.onContainer} />
            </View>
            <Text style={[styles.appTitle, { color: c.primary.main }]}>TusCoach App</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <MaterialIcons name="notifications" size={22} color={c.primary.main} />
          </TouchableOpacity>
        </View>

        {/* ─── Messages or Empty State ──────────────────── */}
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            {/* AI Coach Intro */}
            <View style={styles.aiIntro}>
              <View style={styles.aiIconWrap}>
                <MaterialIcons name="smart-toy" size={36} color={colors.white} />
                <View style={styles.onlineDot} />
              </View>
              <Text style={[styles.aiName, { color: c.primary.main }]}>Dr. Scholar AI</Text>
              <Text style={[styles.aiSubtitle, { color: c.onSurface.variant }]}>TUS Başarı Stratejistiniz</Text>
            </View>

            {/* Quick Suggestions */}
            <View style={styles.suggestionsSection}>
              <Text style={[styles.suggestionsLabel, { color: c.outline.main }]}>HIZLI ÖNERİLER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.suggestionChip, { backgroundColor: c.surface.containerLowest, borderColor: c.outline.variant + '4D' }]}
                    onPress={() => handleSend(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.suggestionText, { color: c.primary.main }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={[...messages].reverse()}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            inverted
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
            extraData={sending}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* ─── Quick Suggestions (when messages exist) ── */}
        {messages.length > 0 && !sending && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.inlineSuggestions}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {SUGGESTIONS.slice(0, 3).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.suggestionChipSmall, { backgroundColor: c.surface.containerLowest, borderColor: c.outline.variant + '33' }]}
                onPress={() => handleSend(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.suggestionTextSmall, { color: c.primary.main }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ─── Input Bar (Floating) ─────────────────────── */}
        <View style={styles.inputBarOuter}>
          <SafeAreaView edges={['bottom']}>
            <View style={[styles.inputBar, { backgroundColor: c.surface.containerLowest + 'F2', borderColor: c.outline.variant + '33' }]}>
              <TouchableOpacity style={styles.attachBtn}>
                <MaterialIcons name="attach-file" size={22} color={c.outline.main} />
              </TouchableOpacity>
              <TextInput
                style={[styles.textInput, { color: c.onSurface.main }]}
                placeholder="Dr. Scholar'a bir soru sor..."
                placeholderTextColor={c.outline.main + '99'}
                value={input}
                onChangeText={setInput}
                multiline
                editable={!sending}
                onSubmitEditing={() => handleSend()}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                onPress={() => handleSend()}
                disabled={!input.trim() || sending}
                style={[
                  styles.sendButton,
                  input.trim() && !sending ? [styles.sendButtonActive, { backgroundColor: c.primary.main }] : [styles.sendButtonDisabled, { backgroundColor: c.surface.containerHigh }],
                ]}
                activeOpacity={0.7}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={c.white} />
                ) : (
                  <MaterialIcons name="send" size={20} color={input.trim() ? c.white : c.outline.main} />
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
    backgroundColor: colors.surface.main,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.surface.main,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.fixed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary.main,
    letterSpacing: -0.5,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  aiIntro: {
    alignItems: 'center',
    marginBottom: 40,
  },
  aiIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.hero,
    marginBottom: 16,
  },
  onlineDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.secondary.main,
    borderWidth: 3,
    borderColor: colors.surface.main,
  },
  aiName: {
    ...typography.h2,
    color: colors.primary.main,
  },
  aiSubtitle: {
    ...typography.caption,
    color: colors.onSurface.variant,
    marginTop: 4,
  },

  // Suggestions
  suggestionsSection: {
    width: '100%',
    paddingHorizontal: 20,
  },
  suggestionsLabel: {
    ...typography.labelWide,
    color: colors.outline.main,
    marginBottom: 10,
  },
  suggestionChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.surface.containerLowest,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outline.variant + '4D',
  },
  suggestionText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary.main,
  },
  inlineSuggestions: {
    paddingVertical: 8,
  },
  suggestionChipSmall: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface.containerLowest,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outline.variant + '33',
  },
  suggestionTextSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.main,
  },

  // Message Bubbles
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  aiBubbleIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.secondary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 4,
  },
  userBubble: {
    backgroundColor: colors.primary.container,
    borderRadius: 18,
    borderTopRightRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 14,
    maxWidth: '75%',
  },
  assistantBubble: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 14,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: colors.outline.variant + '33',
    ...shadows.sm,
  },
  userText: {
    ...typography.body,
    color: colors.primary.onContainer,
    lineHeight: 22,
  },
  assistantText: {
    ...typography.body,
    color: colors.onSurface.main,
    lineHeight: 22,
  },

  // Input Bar
  inputBarOuter: {
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 0 : 12,
    marginBottom: Platform.OS === 'ios' ? 0 : 80,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 4,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.outline.variant + '33',
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.onSurface.main,
    paddingVertical: 10,
    paddingHorizontal: 4,
    maxHeight: 96,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary.main,
    ...shadows.hero,
  },
  sendButtonDisabled: {
    backgroundColor: colors.surface.containerHigh,
  },
});
