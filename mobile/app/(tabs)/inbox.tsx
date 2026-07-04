import { View, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { fetchMessagesHistory, type CoachMessage } from '../../src/api/coach';
import { Screen } from '../../src/ui/Screen';
import { Card } from '../../src/ui/Card';
import { Text } from '../../src/ui/Text';
import { Tag } from '../../src/ui/Tag';
import { colors, shadows, typography } from '../../src/ui/theme';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const toneVariant: Record<string, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  motivational: 'success',
  encouraging: 'success',
  neutral: 'neutral',
  warning: 'warning',
  urgent: 'danger',
};

function MessageRow({ message, onPress }: { message: CoachMessage; onPress: () => void }) {
  const unread = !message.read_at;

  return (
    <Pressable onPress={onPress} className="mb-3">
      <Card className={unread ? 'border-l-[3px] border-l-primary-600' : ''}>
        <View className="flex-row items-start justify-between mb-1">
          <View className="flex-row items-center flex-1 mr-2">
            {unread && <View className="w-2 h-2 rounded-full bg-primary-600 mr-2 mt-1" />}
            <Text
              variant="subtitle"
              className={`flex-1 ${unread ? 'text-gray-900' : 'text-gray-700'}`}
              numberOfLines={1}
            >
              {message.subject || 'Konu yok'}
            </Text>
          </View>
          <Text variant="caption">{formatDate(message.created_at)}</Text>
        </View>

        <Text variant="muted" className="text-sm mb-2" numberOfLines={2}>
          {message.body}
        </Text>

        <View className="flex-row items-center gap-2">
          {message.tone && (
            <Tag
              label={message.tone}
              variant={toneVariant[message.tone] ?? 'neutral'}
            />
          )}
          {message.workflow_name && (
            <Text variant="caption" className="text-primary-600 capitalize">
              {message.workflow_name.replace(/_/g, ' ')}
            </Text>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View className="items-center justify-center py-20 px-8">
      <View className="w-16 h-16 rounded-full bg-primary-100 items-center justify-center mb-4">
        <FontAwesome name="envelope-o" size={28} color={colors.primary[500]} />
      </View>
      <Text variant="subtitle" className="text-center mb-2">
        Henüz mesaj yok
      </Text>
      <Text variant="muted" className="text-center text-sm">
        Koçunuz size buradan güncellemeler, çalışma önerileri ve kontroller gönderecek.
      </Text>
    </View>
  );
}

export default function InboxPage() {
  const router = useRouter();

  const {
    data: messages,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['messages'],
    queryFn: () => fetchMessagesHistory(50),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <Screen
      title="Gelen Kutusu"
      right={
        messages && messages.length > 0 ? (
          <Text variant="caption">
            {messages.filter((m) => !m.read_at).length} okunmamış
          </Text>
        ) : null
      }
      scroll
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary[500]}
        />
      }
    >
      {messages && messages.length > 0 ? (
        messages.map((msg) => (
          <MessageRow
            key={msg.id}
            message={msg}
            onPress={() => router.push(`/message/${msg.id}` as any)}
          />
        ))
      ) : (
        <EmptyState />
      )}
    </Screen>
  );
}
