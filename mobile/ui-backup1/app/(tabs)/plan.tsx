import { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchDailyPlan,
    fetchPlanOverview,
    generatePlan,
    completeTask,
    updatePlanTask,
    deletePlanTask,
} from '../../src/api/coach';
import { PlanList } from '../../src/components/PlanList';

export default function PlanPage() {
    const queryClient = useQueryClient();

    // Date state (YYYY-MM-DD)
    const [selectedDate, setSelectedDate] = useState(
        () => new Date().toISOString().split('T')[0],
    );

    // --- Queries ---

    const {
        data: overview,
        isLoading: overviewLoading,
        refetch: refetchOverview,
    } = useQuery({
        queryKey: ['plan-overview'],
        queryFn: fetchPlanOverview,
    });

    const {
        data: dailyData,
        isLoading: dailyLoading,
        refetch: refetchDaily,
    } = useQuery({
        queryKey: ['plan', selectedDate],
        queryFn: () => fetchDailyPlan(selectedDate),
    });

    const isRefreshing = overviewLoading || dailyLoading;

    const handleRefresh = () => {
        refetchOverview();
        refetchDaily();
    };

    // --- Mutations ---

    const generateMutation = useMutation({
        mutationFn: (days: number) => generatePlan(days),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
            queryClient.invalidateQueries({ queryKey: ['plan'] });
            Alert.alert('Başarılı', 'Çalışma planınız oluşturuldu!');
        },
        onError: (err: any) => {
            Alert.alert('Hata', err.response?.data?.detail || 'Plan oluşturulamadı');
        },
    });

    const completeMutation = useMutation({
        mutationFn: completeTask,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plan', selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, minutes }: { id: number; minutes: number }) =>
            updatePlanTask(id, minutes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plan', selectedDate] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deletePlanTask,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plan', selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
        },
    });

    // --- Date helpers ---

    const changeDate = (offset: number) => {
        const current = new Date(selectedDate + 'T00:00:00');
        current.setDate(current.getDate() + offset);
        setSelectedDate(current.toISOString().split('T')[0]);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (dateStr === today) return 'Bugün';
        if (dateStr === yesterday.toISOString().split('T')[0]) return 'Dün';
        if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Yarın';

        return date.toLocaleDateString('tr-TR', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatRange = (start: string, end: string) => {
        const s = new Date(start + 'T00:00:00');
        const e = new Date(end + 'T00:00:00');
        const fmt = (d: Date) =>
            d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        return `${fmt(s)} — ${fmt(e)}`;
    };

    // --- Daily summary ---

    const tasks = dailyData?.tasks || [];
    const totalMinutes = tasks.reduce((s, t) => s + t.target_minutes, 0);
    const completedTasks = tasks.filter((t) => t.status === 'done');
    const completedMinutes = completedTasks.reduce((s, t) => s + t.target_minutes, 0);
    const progressPct = totalMinutes > 0 ? (completedMinutes / totalMinutes) * 100 : 0;

    // --- Generate handler ---

    const handleGenerate = () => {
        Alert.alert(
            'Plan Oluştur',
            '14 günlük kişiselleştirilmiş çalışma planı oluşturulacak. Mevcut plan arşivlenecek.',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Oluştur',
                    onPress: () => generateMutation.mutate(14),
                },
            ],
        );
    };

    // Has an active plan?
    const hasPlan = overview && overview.id != null;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Çalışma Planı</Text>
                {hasPlan && (
                    <TouchableOpacity
                        style={styles.refreshBtn}
                        onPress={handleGenerate}
                        disabled={generateMutation.isPending}
                    >
                        {generateMutation.isPending ? (
                            <ActivityIndicator size="small" color="#004225" />
                        ) : (
                            <FontAwesome name="refresh" size={14} color="#004225" />
                        )}
                        <Text style={styles.refreshBtnText}>Yenile</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Plan Overview */}
            {hasPlan && (
                <View style={styles.overviewCard}>
                    <View style={styles.overviewTop}>
                        <View>
                            <Text style={styles.overviewRange}>
                                {formatRange(overview.start_date, overview.end_date)}
                            </Text>
                            <Text style={styles.overviewMeta}>
                                v{overview.version} · {overview.completed_tasks}/{overview.total_tasks} görev
                            </Text>
                        </View>
                        <View style={styles.overviewBadge}>
                            <Text style={styles.overviewBadgeText}>
                                %{Math.round((overview.completed_tasks / Math.max(overview.total_tasks, 1)) * 100)}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    width: `${Math.round(
                                        (overview.completed_tasks / Math.max(overview.total_tasks, 1)) * 100,
                                    )}%`,
                                },
                            ]}
                        />
                    </View>
                </View>
            )}

            {/* Empty state — no plan */}
            {!overviewLoading && !hasPlan && (
                <View style={styles.emptyState}>
                    <FontAwesome name="calendar-o" size={56} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>Henüz çalışma planınız yok</Text>
                    <Text style={styles.emptyHint}>
                        Yapay zeka destekli kişiselleştirilmiş bir plan oluşturun
                    </Text>
                    <TouchableOpacity
                        style={styles.generateBtn}
                        onPress={handleGenerate}
                        disabled={generateMutation.isPending}
                        activeOpacity={0.8}
                    >
                        {generateMutation.isPending ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <FontAwesome name="magic" size={16} color="#fff" />
                                <Text style={styles.generateBtnText}>Plan Oluştur</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Date Selector + Tasks (only show when plan exists) */}
            {hasPlan && (
                <>
                    {/* Date navigation */}
                    <View style={styles.dateSelector}>
                        <TouchableOpacity
                            onPress={() => changeDate(-1)}
                            style={styles.dateArrow}
                        >
                            <FontAwesome name="chevron-left" size={14} color="#004225" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() =>
                                setSelectedDate(new Date().toISOString().split('T')[0])
                            }
                            style={styles.dateCenter}
                        >
                            <Text style={styles.dateCenterText}>
                                {formatDate(selectedDate)}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => changeDate(1)}
                            style={styles.dateArrow}
                        >
                            <FontAwesome name="chevron-right" size={14} color="#004225" />
                        </TouchableOpacity>
                    </View>

                    {/* Daily summary bar */}
                    {tasks.length > 0 && (
                        <View style={styles.dailySummary}>
                            <Text style={styles.dailySummaryText}>
                                {completedTasks.length}/{tasks.length} görev · {completedMinutes}/{totalMinutes} dk
                            </Text>
                            <View style={styles.dailyProgressBar}>
                                <View
                                    style={[
                                        styles.dailyProgressFill,
                                        { width: `${Math.round(progressPct)}%` },
                                    ]}
                                />
                            </View>
                        </View>
                    )}

                    {/* Task list */}
                    <ScrollView
                        style={{ flex: 1 }}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={handleRefresh}
                            />
                        }
                    >
                        {dailyLoading ? (
                            <View style={styles.loading}>
                                <ActivityIndicator size="large" color="#004225" />
                            </View>
                        ) : (
                            <PlanList
                                tasks={tasks}
                                onComplete={(id) => completeMutation.mutate(id)}
                                onDelete={(id) => deleteMutation.mutate(id)}
                                onUpdateMinutes={(id, minutes) =>
                                    updateMutation.mutate({ id, minutes })
                                }
                            />
                        )}
                        <View style={{ height: 32 }} />
                    </ScrollView>
                </>
            )}

            {/* Loading overlay for generate */}
            {overviewLoading && !hasPlan && (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color="#004225" />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111',
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f0fdf4',
    },
    refreshBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#004225',
    },

    // Overview card
    overviewCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    overviewTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    overviewRange: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111',
    },
    overviewMeta: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    overviewBadge: {
        backgroundColor: '#004225',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    overviewBadgeText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
    progressBar: {
        height: 6,
        backgroundColor: '#e5e7eb',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#004225',
        borderRadius: 3,
    },

    // Empty state
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingBottom: 80,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
        textAlign: 'center',
    },
    emptyHint: {
        fontSize: 14,
        color: '#9ca3af',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    generateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 24,
        backgroundColor: '#004225',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        shadowColor: '#004225',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    generateBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },

    // Date selector
    dateSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginTop: 8,
    },
    dateArrow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    dateCenter: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        backgroundColor: '#004225',
        borderRadius: 8,
    },
    dateCenterText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },

    // Daily summary
    dailySummary: {
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    dailySummaryText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6b7280',
        marginBottom: 8,
    },
    dailyProgressBar: {
        height: 4,
        backgroundColor: '#e5e7eb',
        borderRadius: 2,
        overflow: 'hidden',
    },
    dailyProgressFill: {
        height: '100%',
        backgroundColor: '#16a34a',
        borderRadius: 2,
    },

    // Loading
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
});
