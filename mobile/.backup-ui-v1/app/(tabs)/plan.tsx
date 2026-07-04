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
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchDailyPlan,
    fetchPlanOverview,
    fetchPlanStructure,
    generatePlan,
    completeTask,
    updatePlanTask,
    deletePlanTask,
    createPlanTask,
    reorderPlanBlocks,
    updateBlockDays,
} from '../../src/api/coach';
import type { UpdateTaskData, CreateTaskData, SubjectBlock } from '../../src/api/coach';
import { PlanList } from '../../src/components/PlanList';
import { SUBJECT_COLORS, TUR_OPTIONS } from '../../src/constants/subjects';
import type { TUSSubject } from '../../src/constants/subjects';

/** Format a Date as YYYY-MM-DD using local timezone (avoids UTC shift). */
const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function PlanPage() {
    const queryClient = useQueryClient();

    const [selectedDate, setSelectedDate] = useState(
        () => toLocalDateStr(new Date()),
    );
    const [showTurSelector, setShowTurSelector] = useState(false);
    const [showStructure, setShowStructure] = useState(false);
    const [editingBlock, setEditingBlock] = useState<SubjectBlock | null>(null);
    const [editReadingDays, setEditReadingDays] = useState(0);
    const [editQuestionDays, setEditQuestionDays] = useState(0);

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

    const {
        data: structure,
        refetch: refetchStructure,
    } = useQuery({
        queryKey: ['plan-structure'],
        queryFn: fetchPlanStructure,
        enabled: !!overview?.id,
    });

    const isRefreshing = overviewLoading || dailyLoading;

    const handleRefresh = () => {
        refetchOverview();
        refetchDaily();
        refetchStructure();
    };

    // --- Mutations ---

    const generateMutation = useMutation({
        mutationFn: (turNumber: number) => generatePlan(turNumber),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
            queryClient.invalidateQueries({ queryKey: ['plan'] });
            queryClient.invalidateQueries({ queryKey: ['plan-structure'] });
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
            queryClient.invalidateQueries({ queryKey: ['plan-structure'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateTaskData }) =>
            updatePlanTask(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plan'] });
            queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
            queryClient.invalidateQueries({ queryKey: ['plan-structure'] });
        },
    });

    const createTaskMutation = useMutation({
        mutationFn: (data: CreateTaskData) => createPlanTask(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plan'] });
            queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
        },
        onError: (err: any) => {
            Alert.alert('Hata', err.response?.data?.detail || 'Görev oluşturulamadı');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deletePlanTask,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plan', selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
        },
    });

    const reorderMutation = useMutation({
        mutationFn: (order: string[]) => reorderPlanBlocks(order),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
            queryClient.invalidateQueries({ queryKey: ['plan-structure'] });
            queryClient.invalidateQueries({ queryKey: ['plan'] });
        },
        onError: (err: any) => {
            Alert.alert('Hata', err.response?.data?.detail || 'Sıralama değiştirilemedi');
        },
    });

    const updateBlockMutation = useMutation({
        mutationFn: ({ subject, reading_days, question_days }: { subject: string; reading_days: number; question_days: number }) =>
            updateBlockDays(subject, { reading_days, question_days }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
            queryClient.invalidateQueries({ queryKey: ['plan-structure'] });
            queryClient.invalidateQueries({ queryKey: ['plan'] });
            setEditingBlock(null);
        },
        onError: (err: any) => {
            Alert.alert('Hata', err.response?.data?.detail || 'Blok güncellenemedi');
        },
    });

    // --- Date helpers ---

    const changeDate = (offset: number) => {
        const current = new Date(selectedDate + 'T00:00:00');
        current.setDate(current.getDate() + offset);
        setSelectedDate(toLocalDateStr(current));
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const today = toLocalDateStr(new Date());
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (dateStr === today) return 'Bugün';
        if (dateStr === toLocalDateStr(yesterday)) return 'Dün';
        if (dateStr === toLocalDateStr(tomorrow)) return 'Yarın';

        return d.toLocaleDateString('tr-TR', {
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

    const formatBlockDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    };

    // --- Daily summary ---

    const tasks = dailyData?.tasks || [];
    const totalMinutes = tasks.reduce((s, t) => s + t.target_minutes, 0);
    const completedTasks = tasks.filter((t) => t.status === 'done');
    const completedMinutes = completedTasks.reduce((s, t) => s + t.target_minutes, 0);
    const progressPct = totalMinutes > 0 ? (completedMinutes / totalMinutes) * 100 : 0;

    // Current day's subject and phase
    const currentSubject = tasks.length > 0 ? tasks[0].subject : null;
    const currentPhase = tasks.length > 0 ? tasks[0].phase : null;
    const currentBlockOrder = tasks.length > 0 ? tasks[0].subject_block_order : null;

    // --- Block edit handlers ---

    const handleBlockEditOpen = (block: SubjectBlock) => {
        setEditReadingDays(block.reading_days);
        setEditQuestionDays(block.question_days);
        setEditingBlock(block);
    };

    const handleBlockEditSave = () => {
        if (!editingBlock) return;
        if (editReadingDays === editingBlock.reading_days && editQuestionDays === editingBlock.question_days) {
            setEditingBlock(null);
            return;
        }
        Alert.alert(
            'Bloğu Güncelle',
            'Bu değişiklik tüm görev tarihlerini yeniden hesaplayacak. Tamamlanan görevlerin durumu korunacak.',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Uygula',
                    onPress: () => updateBlockMutation.mutate({
                        subject: editingBlock.subject,
                        reading_days: editReadingDays,
                        question_days: editQuestionDays,
                    }),
                },
            ],
        );
    };

    const handleBlockMove = (block: SubjectBlock, direction: 'up' | 'down') => {
        if (!structure?.blocks) return;
        const subjects = structure.blocks.map((b) => b.subject);
        const idx = subjects.indexOf(block.subject);
        if (direction === 'up' && idx <= 0) return;
        if (direction === 'down' && idx >= subjects.length - 1) return;

        const newOrder = [...subjects];
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

        Alert.alert(
            'Sıralamayı Değiştir',
            'Bu değişiklik tüm görev tarihlerini yeniden hesaplayacak. Tamamlanan görevlerin durumu korunacak.',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Uygula',
                    onPress: () => {
                        setEditingBlock(null);
                        reorderMutation.mutate(newOrder);
                    },
                },
            ],
        );
    };

    // --- Generate handler ---

    const handleGenerate = () => {
        setShowTurSelector(true);
    };

    const handleTurSelect = (turNumber: number) => {
        setShowTurSelector(false);
        const option = TUR_OPTIONS.find((o) => o.value === turNumber);
        Alert.alert(
            'Plan Oluştur',
            `${option?.label || turNumber + '. Tur'} (${option?.description || ''}) planı oluşturulacak. Mevcut plan arşivlenecek.`,
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Oluştur',
                    onPress: () => generateMutation.mutate(turNumber),
                },
            ],
        );
    };

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
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <FontAwesome name="refresh" size={14} color="#fff" />
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
                                {overview.tur_number ? `${overview.tur_number}. Tur · ` : ''}
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
                                { width: `${Math.round((overview.completed_tasks / Math.max(overview.total_tasks, 1)) * 100)}%` },
                            ]}
                        />
                    </View>

                    {/* Structure toggle */}
                    {structure && structure.blocks && (
                        <TouchableOpacity
                            style={styles.structureToggle}
                            onPress={() => setShowStructure(!showStructure)}
                        >
                            <FontAwesome name={showStructure ? 'chevron-up' : 'chevron-down'} size={12} color="#6b7280" />
                            <Text style={styles.structureToggleText}>
                                {showStructure ? 'Tur yapısını gizle' : 'Tur yapısını göster'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Structure View */}
            {hasPlan && showStructure && structure?.blocks && (
                <View style={styles.structureCard}>
                    {structure.blocks.map((block, idx) => {
                        const color = SUBJECT_COLORS[block.subject as TUSSubject] || '#6b7280';
                        const isActive = block.phase === 'active';
                        const isDone = block.phase === 'completed';
                        return (
                            <View key={idx} style={[styles.blockRow, isActive && styles.blockRowActive]}>
                                <TouchableOpacity
                                    style={styles.blockTapArea}
                                    onPress={() => {
                                        setSelectedDate(block.start_date);
                                        setShowStructure(false);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.blockDot, { backgroundColor: isDone ? '#16a34a' : isActive ? color : '#d1d5db' }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.blockSubject, isDone && styles.blockSubjectDone]}>
                                            {block.order}. {block.subject}
                                        </Text>
                                        <Text style={styles.blockDates}>
                                            {formatBlockDate(block.start_date)} - {formatBlockDate(block.end_date)} · {block.reading_days} okuma + {block.question_days} soru
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.blockEditBtn}
                                    onPress={() => handleBlockEditOpen(block)}
                                    activeOpacity={0.7}
                                >
                                    <FontAwesome name="pencil" size={12} color="#6b7280" />
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                    <Text style={styles.structureHint}>
                        Bloklara dokunarak düzenleyebilirsiniz.
                    </Text>
                </View>
            )}

            {/* Empty state */}
            {!overviewLoading && !hasPlan && (
                <View style={styles.emptyState}>
                    <FontAwesome name="calendar-o" size={56} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>Henüz çalışma planınız yok</Text>
                    <Text style={styles.emptyHint}>
                        Tur bazlı kişiselleştirilmiş bir plan oluşturun. Her turda tek bir derse odaklanarak tüm TUS derslerini sırayla çalışacaksınız.
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

            {/* Date Selector + Tasks */}
            {hasPlan && (
                <>
                    {/* Date navigation */}
                    <View style={styles.dateSelector}>
                        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
                            <FontAwesome name="chevron-left" size={14} color="#004225" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setSelectedDate(toLocalDateStr(new Date()))}
                            style={styles.dateCenter}
                        >
                            <Text style={styles.dateCenterText}>{formatDate(selectedDate)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateArrow}>
                            <FontAwesome name="chevron-right" size={14} color="#004225" />
                        </TouchableOpacity>
                    </View>

                    {/* Phase header */}
                    {currentSubject && currentPhase && (
                        <View style={styles.phaseHeader}>
                            <View style={[styles.phaseBar, { backgroundColor: SUBJECT_COLORS[currentSubject as TUSSubject] || '#6b7280' }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.phaseSubject}>{currentSubject}</Text>
                                <Text style={styles.phaseLabel}>
                                    {currentPhase === 'reading' ? 'Okuma Fazı' : 'Soru Fazı'}
                                    {currentBlockOrder ? ` · ${currentBlockOrder}. ders bloğu` : ''}
                                </Text>
                            </View>
                            <View style={[styles.phaseBadge, { backgroundColor: currentPhase === 'reading' ? '#dbeafe' : '#fef3c7' }]}>
                                <FontAwesome
                                    name={currentPhase === 'reading' ? 'book' : 'pencil'}
                                    size={12}
                                    color={currentPhase === 'reading' ? '#2563eb' : '#d97706'}
                                />
                                <Text style={[styles.phaseBadgeText, { color: currentPhase === 'reading' ? '#2563eb' : '#d97706' }]}>
                                    {currentPhase === 'reading' ? 'Okuma' : 'Soru'}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Daily summary */}
                    {tasks.length > 0 && (
                        <View style={styles.dailySummary}>
                            <Text style={styles.dailySummaryText}>
                                {completedTasks.length}/{tasks.length} görev · {completedMinutes}/{totalMinutes} dk
                            </Text>
                            <View style={styles.dailyProgressBar}>
                                <View style={[styles.dailyProgressFill, { width: `${Math.round(progressPct)}%` }]} />
                            </View>
                        </View>
                    )}

                    {/* Task list */}
                    <ScrollView
                        style={{ flex: 1 }}
                        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
                    >
                        {dailyLoading ? (
                            <View style={styles.loading}>
                                <ActivityIndicator size="large" color="#004225" />
                            </View>
                        ) : (
                            <PlanList
                                tasks={tasks}
                                currentDate={selectedDate}
                                planStartDate={overview?.start_date}
                                planEndDate={overview?.end_date}
                                onComplete={(id) => completeMutation.mutate(id)}
                                onDelete={(id) => deleteMutation.mutate(id)}
                                onUpdateTask={(id, data) => updateMutation.mutate({ id, data })}
                                onAddTask={(data) => createTaskMutation.mutate(data)}
                            />
                        )}
                        <View style={{ height: 32 }} />
                    </ScrollView>
                </>
            )}

            {/* Loading */}
            {overviewLoading && !hasPlan && (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color="#004225" />
                </View>
            )}

            {/* Tur Selector Modal */}
            <Modal visible={showTurSelector} transparent animationType="slide" onRequestClose={() => setShowTurSelector(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Tur Seçin</Text>
                        <Text style={styles.modalSubtitle}>
                            Çalışma turunuzu seçin. İlk kez çalışmaya başlıyorsanız &quot;Yeni Başlayan&quot; seçin.
                        </Text>

                        {TUR_OPTIONS.map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                style={styles.turOption}
                                onPress={() => handleTurSelect(option.value)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.turOptionLeft}>
                                    <View style={styles.turNumber}>
                                        <Text style={styles.turNumberText}>{option.value}</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.turLabel}>{option.label}</Text>
                                        <Text style={styles.turDesc}>{option.description}</Text>
                                    </View>
                                </View>
                                <FontAwesome name="chevron-right" size={14} color="#9ca3af" />
                            </TouchableOpacity>
                        ))}

                        <Text style={styles.turHint}>
                            Sıralamayı, süreleri ve yapıyı ihtiyaçlarınıza göre değiştirebilirsiniz.
                        </Text>

                        <TouchableOpacity style={styles.modalCancel} onPress={() => setShowTurSelector(false)}>
                            <Text style={styles.modalCancelText}>İptal</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Block Edit Modal */}
            <Modal visible={!!editingBlock} transparent animationType="fade" onRequestClose={() => setEditingBlock(null)}>
                <View style={styles.blockModalOverlay}>
                    <View style={styles.blockModalSheet}>
                        <View style={styles.blockModalHeader}>
                            <FontAwesome name="sliders" size={20} color="#004225" />
                            <Text style={styles.blockModalTitle}>Bloğu Düzenle</Text>
                        </View>
                        <Text style={styles.blockModalSubject}>
                            {editingBlock?.subject}
                        </Text>

                        {/* Move up/down */}
                        <Text style={styles.blockFieldLabel}>Sıralama</Text>
                        <View style={styles.moveRow}>
                            <TouchableOpacity
                                style={[styles.moveBtn, editingBlock?.order === 1 && styles.moveBtnDisabled]}
                                onPress={() => editingBlock && handleBlockMove(editingBlock, 'up')}
                                disabled={editingBlock?.order === 1}
                                activeOpacity={0.7}
                            >
                                <FontAwesome name="arrow-up" size={14} color={editingBlock?.order === 1 ? '#d1d5db' : '#004225'} />
                                <Text style={[styles.moveBtnText, editingBlock?.order === 1 && styles.moveBtnTextDisabled]}>Yukarı</Text>
                            </TouchableOpacity>
                            <Text style={styles.movePosition}>{editingBlock?.order}. sıra</Text>
                            <TouchableOpacity
                                style={[styles.moveBtn, editingBlock?.order === (structure?.blocks?.length || 0) && styles.moveBtnDisabled]}
                                onPress={() => editingBlock && handleBlockMove(editingBlock, 'down')}
                                disabled={editingBlock?.order === (structure?.blocks?.length || 0)}
                                activeOpacity={0.7}
                            >
                                <FontAwesome name="arrow-down" size={14} color={editingBlock?.order === (structure?.blocks?.length || 0) ? '#d1d5db' : '#004225'} />
                                <Text style={[styles.moveBtnText, editingBlock?.order === (structure?.blocks?.length || 0) && styles.moveBtnTextDisabled]}>Aşağı</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Reading days stepper */}
                        <Text style={styles.blockFieldLabel}>Okuma Günleri</Text>
                        <View style={styles.stepperRow}>
                            <TouchableOpacity
                                style={[styles.stepperBtn, editReadingDays <= 1 && styles.stepperBtnDisabled]}
                                onPress={() => setEditReadingDays(Math.max(1, editReadingDays - 1))}
                                disabled={editReadingDays <= 1}
                            >
                                <FontAwesome name="minus" size={12} color={editReadingDays <= 1 ? '#d1d5db' : '#004225'} />
                            </TouchableOpacity>
                            <Text style={styles.stepperValue}>{editReadingDays} gün</Text>
                            <TouchableOpacity
                                style={[styles.stepperBtn, editReadingDays >= 14 && styles.stepperBtnDisabled]}
                                onPress={() => setEditReadingDays(Math.min(14, editReadingDays + 1))}
                                disabled={editReadingDays >= 14}
                            >
                                <FontAwesome name="plus" size={12} color={editReadingDays >= 14 ? '#d1d5db' : '#004225'} />
                            </TouchableOpacity>
                        </View>

                        {/* Question days stepper */}
                        <Text style={styles.blockFieldLabel}>Soru Günleri</Text>
                        <View style={styles.stepperRow}>
                            <TouchableOpacity
                                style={[styles.stepperBtn, editQuestionDays <= 1 && styles.stepperBtnDisabled]}
                                onPress={() => setEditQuestionDays(Math.max(1, editQuestionDays - 1))}
                                disabled={editQuestionDays <= 1}
                            >
                                <FontAwesome name="minus" size={12} color={editQuestionDays <= 1 ? '#d1d5db' : '#004225'} />
                            </TouchableOpacity>
                            <Text style={styles.stepperValue}>{editQuestionDays} gün</Text>
                            <TouchableOpacity
                                style={[styles.stepperBtn, editQuestionDays >= 14 && styles.stepperBtnDisabled]}
                                onPress={() => setEditQuestionDays(Math.min(14, editQuestionDays + 1))}
                                disabled={editQuestionDays >= 14}
                            >
                                <FontAwesome name="plus" size={12} color={editQuestionDays >= 14 ? '#d1d5db' : '#004225'} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.blockModalActions}>
                            <TouchableOpacity
                                style={styles.blockModalCancelBtn}
                                onPress={() => setEditingBlock(null)}
                            >
                                <Text style={styles.blockModalCancelText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.blockModalSaveBtn}
                                onPress={handleBlockEditSave}
                                disabled={updateBlockMutation.isPending}
                            >
                                {updateBlockMutation.isPending ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.blockModalSaveText}>Kaydet</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f6f8' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#004225', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
    },
    title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
    refreshBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    refreshBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

    overviewCard: {
        backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
        borderRadius: 12, padding: 16,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    overviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    overviewRange: { fontSize: 16, fontWeight: '600', color: '#111' },
    overviewMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    overviewBadge: { backgroundColor: '#004225', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    overviewBadgeText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    progressBar: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#004225', borderRadius: 3 },
    structureToggle: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6',
    },
    structureToggleText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },

    structureCard: {
        backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8,
        borderRadius: 12, padding: 12,
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
    },
    blockRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
    blockTapArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    blockRowActive: { backgroundColor: '#f0fdf4' },
    blockDot: { width: 10, height: 10, borderRadius: 5 },
    blockEditBtn: {
        width: 32, height: 32, borderRadius: 8, backgroundColor: '#f3f4f6',
        justifyContent: 'center', alignItems: 'center', marginLeft: 6,
    },
    blockSubject: { fontSize: 14, fontWeight: '600', color: '#111827' },
    blockSubjectDone: { color: '#9ca3af', textDecorationLine: 'line-through' },
    blockDates: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
    blockStatus: { fontSize: 11, fontWeight: '600', color: '#9ca3af' },
    structureHint: {
        fontSize: 11, color: '#9ca3af', textAlign: 'center',
        marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6',
        fontStyle: 'italic',
    },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingBottom: 80 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16, textAlign: 'center' },
    emptyHint: { fontSize: 14, color: '#9ca3af', marginTop: 8, textAlign: 'center', lineHeight: 20 },
    generateBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24,
        backgroundColor: '#004225', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12,
        shadowColor: '#004225', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    generateBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

    dateSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
    dateArrow: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    },
    dateCenter: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#004225', borderRadius: 8 },
    dateCenterText: { fontSize: 15, fontWeight: '600', color: '#fff' },

    phaseHeader: {
        flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, marginBottom: 4,
        backgroundColor: '#fff', borderRadius: 10, padding: 12, gap: 10,
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
    },
    phaseBar: { width: 4, height: 36, borderRadius: 2 },
    phaseSubject: { fontSize: 15, fontWeight: '700', color: '#111827' },
    phaseLabel: { fontSize: 12, color: '#6b7280', marginTop: 1 },
    phaseBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    phaseBadgeText: { fontSize: 12, fontWeight: '600' },

    dailySummary: {
        marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff',
        borderRadius: 10, padding: 12,
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
    },
    dailySummaryText: { fontSize: 13, fontWeight: '500', color: '#6b7280', marginBottom: 8 },
    dailyProgressBar: { height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, overflow: 'hidden' },
    dailyProgressFill: { height: '100%', backgroundColor: '#16a34a', borderRadius: 2 },

    loading: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
    modalHandle: { width: 36, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
    modalSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 18 },
    turOption: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 14, borderRadius: 10, backgroundColor: '#f9fafb', marginBottom: 8,
        borderWidth: 1, borderColor: '#e5e7eb',
    },
    turOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    turNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#004225', justifyContent: 'center', alignItems: 'center' },
    turNumberText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    turLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
    turDesc: { fontSize: 12, color: '#6b7280', marginTop: 1 },
    turHint: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
    modalCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
    modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },

    /* Block edit modal */
    blockModalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
    },
    blockModalSheet: {
        backgroundColor: '#fff', borderRadius: 20, padding: 24,
        width: '88%', maxWidth: 380,
        shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    },
    blockModalHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, marginBottom: 4,
    },
    blockModalTitle: { fontSize: 18, fontWeight: '700', color: '#111', textAlign: 'center' },
    blockModalSubject: {
        fontSize: 15, fontWeight: '600', color: '#004225', textAlign: 'center',
        marginTop: 4, marginBottom: 16,
    },
    blockFieldLabel: {
        fontSize: 12, fontWeight: '600', color: '#374151',
        marginBottom: 8, marginTop: 14,
    },
    moveRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        gap: 12,
    },
    moveBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
        backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#004225',
    },
    moveBtnDisabled: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
    moveBtnText: { fontSize: 13, fontWeight: '600', color: '#004225' },
    moveBtnTextDisabled: { color: '#d1d5db' },
    movePosition: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
    stepperRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 20, backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 10,
        borderWidth: 2, borderColor: '#e5e7eb',
    },
    stepperBtn: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    },
    stepperBtnDisabled: { opacity: 0.4 },
    stepperValue: { fontSize: 18, fontWeight: '700', color: '#004225', minWidth: 60, textAlign: 'center' },
    blockModalActions: {
        flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, gap: 12,
    },
    blockModalCancelBtn: {
        flex: 1, paddingVertical: 13, borderRadius: 12,
        backgroundColor: '#f3f4f6', alignItems: 'center',
    },
    blockModalCancelText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
    blockModalSaveBtn: {
        flex: 1, paddingVertical: 13, borderRadius: 12,
        backgroundColor: '#004225', alignItems: 'center',
        shadowColor: '#004225', shadowOpacity: 0.3, shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 }, elevation: 3,
    },
    blockModalSaveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
