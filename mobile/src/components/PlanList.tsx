import { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    Modal,
    TextInput,
    StyleSheet,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { SUBJECT_COLORS, type TUSSubject } from '../constants/subjects';
import type { PlanTask, UpdateTaskData, CreateTaskData } from '../api/coach';
import { colors, shadows, radius, useThemeColors } from '../ui/theme';

const TASK_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
    review: { label: 'Konu Tekrarı', icon: 'book' },
    question: { label: 'Soru Çözümü', icon: 'pencil' },
    video: { label: 'Video İzleme', icon: 'play-circle' },
    note: { label: 'Not Çıkarma', icon: 'sticky-note' },
};

const TASK_TYPES = ['review', 'question', 'video', 'note'] as const;

const PHASE_STYLES: Record<string, { label: string; icon: string; bg: string; color: string }> = {
    reading: { label: 'Okuma', icon: 'book', bg: '#dbeafe', color: '#2563eb' },
    question: { label: 'Soru', icon: 'pencil', bg: '#fef3c7', color: '#d97706' },
};

const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });
};

interface PlanListProps {
    tasks: PlanTask[];
    currentDate: string;
    planStartDate?: string;
    planEndDate?: string;
    onComplete: (id: number) => void;
    onDelete: (id: number) => void;
    onUpdateTask: (id: number, data: UpdateTaskData) => void;
    onAddTask: (data: CreateTaskData) => void;
}

export function PlanList({
    tasks, currentDate, planStartDate, planEndDate,
    onComplete, onDelete, onUpdateTask, onAddTask,
}: PlanListProps) {
    const c = useThemeColors();

    const [editingTask, setEditingTask] = useState<PlanTask | null>(null);
    const [editMinutes, setEditMinutes] = useState('');
    const [editTaskType, setEditTaskType] = useState('');
    const [editDate, setEditDate] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [addMinutes, setAddMinutes] = useState('60');
    const [addTaskType, setAddTaskType] = useState<string>('review');

    const handleEditOpen = (task: PlanTask) => {
        setEditMinutes(String(task.target_minutes));
        setEditTaskType(task.task_type);
        setEditDate(task.date);
        setEditingTask(task);
    };

    const handleEditSave = () => {
        if (!editingTask) return;
        const mins = parseInt(editMinutes, 10);
        if (isNaN(mins) || mins < 5 || mins > 180) {
            Alert.alert('Hata', 'Süre 5-180 dakika arası olmalı');
            return;
        }
        const data: UpdateTaskData = {};
        if (mins !== editingTask.target_minutes) data.target_minutes = mins;
        if (editTaskType !== editingTask.task_type) data.task_type = editTaskType;
        if (editDate !== editingTask.date) data.date = editDate;
        if (Object.keys(data).length === 0) { setEditingTask(null); return; }
        onUpdateTask(editingTask.id, data);
        setEditingTask(null);
    };

    const changeEditDate = (offset: number) => {
        const current = new Date(editDate + 'T00:00:00');
        current.setDate(current.getDate() + offset);
        const newDate = toLocalDateStr(current);
        if (planStartDate && newDate < planStartDate) return;
        if (planEndDate && newDate > planEndDate) return;
        setEditDate(newDate);
    };

    const handleAddOpen = () => { setAddMinutes('60'); setAddTaskType('review'); setShowAddModal(true); };

    const handleAddSave = () => {
        const mins = parseInt(addMinutes, 10);
        if (isNaN(mins) || mins < 5 || mins > 180) {
            Alert.alert('Hata', 'Süre 5-180 dakika arası olmalı');
            return;
        }
        onAddTask({ date: currentDate, task_type: addTaskType, target_minutes: mins });
        setShowAddModal(false);
    };

    const handleDelete = (task: PlanTask) => {
        const typeInfo = TASK_TYPE_LABELS[task.task_type];
        Alert.alert('Görevi Sil', `${task.subject} - ${typeInfo?.label || task.task_type} silinecek.`, [
            { text: 'İptal', style: 'cancel' },
            { text: 'Sil', style: 'destructive', onPress: () => onDelete(task.id) },
        ]);
    };

    const TypeChips = ({ selected, onSelect }: { selected: string; onSelect: (t: string) => void }) => (
        <View style={styles.chipRow}>
            {TASK_TYPES.map((t) => {
                const info = TASK_TYPE_LABELS[t];
                const isSelected = t === selected;
                return (
                    <TouchableOpacity
                        key={t}
                        style={[styles.chip, { backgroundColor: c.surface.containerLow, borderColor: c.surface.containerHighest }, isSelected && { backgroundColor: c.primary.main, borderColor: c.primary.main }]}
                        onPress={() => onSelect(t)}
                        activeOpacity={0.7}
                    >
                        <FontAwesome name={info.icon as any} size={11} color={isSelected ? c.white : c.onSurface.variant} />
                        <Text style={[styles.chipText, { color: c.onSurface.variant }, isSelected && { color: c.white }]}>{info.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    return (
        <View>
            {tasks.length === 0 ? (
                <View style={styles.emptyState}>
                    <FontAwesome name="check-circle-o" size={32} color={c.outline.variant} />
                    <Text style={[styles.emptyText, { color: c.onSurface.variant }]}>Bu tarih için görev yok.</Text>
                </View>
            ) : (
                tasks.map((task) => {
                    const color = task.subject ? SUBJECT_COLORS[task.subject as TUSSubject] || c.outline.main : c.outline.main;
                    const isDone = task.status === 'done';
                    const typeInfo = TASK_TYPE_LABELS[task.task_type] || { label: task.task_type, icon: 'circle' };
                    return (
                        <View key={task.id} style={[styles.taskCard, { backgroundColor: c.surface.containerLowest }, isDone && styles.taskCardDone]}>
                            <View style={[styles.colorBar, { backgroundColor: color }]} />
                            <View style={styles.taskContent}>
                                <View style={styles.taskRow}>
                                    <TouchableOpacity style={styles.taskInfo} onPress={() => !isDone && handleEditOpen(task)} disabled={isDone} activeOpacity={0.7}>
                                        <Text style={[styles.subjectText, { color: c.onSurface.main }, isDone && { textDecorationLine: 'line-through', color: c.outline.main }]}>
                                            {task.subject || 'Genel'}
                                        </Text>
                                        <View style={styles.metaRow}>
                                            {task.phase && PHASE_STYLES[task.phase] && (
                                                <View style={[styles.phaseBadge, { backgroundColor: PHASE_STYLES[task.phase].bg }]}>
                                                    <FontAwesome name={PHASE_STYLES[task.phase].icon as any} size={8} color={PHASE_STYLES[task.phase].color} />
                                                    <Text style={[styles.phaseText, { color: PHASE_STYLES[task.phase].color }]}>{PHASE_STYLES[task.phase].label}</Text>
                                                </View>
                                            )}
                                            <View style={[styles.typeBadge, { backgroundColor: c.surface.containerHigh }]}>
                                                <FontAwesome name={typeInfo.icon as any} size={9} color={c.onSurface.variant} />
                                                <Text style={[styles.typeText, { color: c.onSurface.variant }]}>{typeInfo.label}</Text>
                                            </View>
                                            <View style={[styles.minutesBadge, { backgroundColor: c.primary.container + '30' }]}>
                                                <FontAwesome name="clock-o" size={9} color={c.primary.main} />
                                                <Text style={[styles.minutesText, { color: c.primary.main }]}>{task.target_minutes} dk</Text>
                                            </View>
                                            {!isDone && <FontAwesome name="pencil" size={10} color={c.outline.main} />}
                                        </View>
                                    </TouchableOpacity>
                                    <View style={styles.actions}>
                                        {isDone ? (
                                            <View style={[styles.doneBadge, { backgroundColor: c.success + '20' }]}>
                                                <FontAwesome name="check-circle" size={12} color={c.success} />
                                                <Text style={[styles.doneText, { color: c.success }]}>Yapıldı</Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity style={[styles.completeBtn, { backgroundColor: c.primary.main }]} onPress={() => onComplete(task.id)} activeOpacity={0.7}>
                                                <FontAwesome name="check" size={11} color={c.white} />
                                            </TouchableOpacity>
                                        )}
                                        {!isDone && (
                                            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(task)} activeOpacity={0.7}>
                                                <FontAwesome name="trash-o" size={13} color={c.outline.variant} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </View>
                    );
                })
            )}

            {/* Add Task Button */}
            <TouchableOpacity style={[styles.addTaskBtn, { borderColor: c.primary.main, backgroundColor: c.primary.container + '15' }]} onPress={handleAddOpen} activeOpacity={0.7}>
                <FontAwesome name="plus" size={13} color={c.primary.main} />
                <Text style={[styles.addTaskBtnText, { color: c.primary.main }]}>Görev Ekle</Text>
            </TouchableOpacity>

            {/* Edit Task Modal */}
            <Modal visible={!!editingTask} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalSheet, { backgroundColor: c.surface.containerLowest }]}>
                        <View style={styles.modalHeader}>
                            <FontAwesome name="pencil-square-o" size={20} color={c.primary.main} />
                            <Text style={[styles.modalTitle, { color: c.onSurface.main }]}>Görevi Düzenle</Text>
                        </View>
                        <Text style={[styles.modalSubtitle, { color: c.onSurface.variant }]}>{editingTask?.subject || 'Genel'}</Text>
                        <Text style={[styles.fieldLabel, { color: c.onSurface.variant }]}>Görev Türü</Text>
                        <TypeChips selected={editTaskType} onSelect={setEditTaskType} />
                        <Text style={[styles.fieldLabel, { color: c.onSurface.variant }]}>Hedef Dakika</Text>
                        <TextInput style={[styles.modalInput, { backgroundColor: c.surface.containerLow, color: c.primary.main, borderColor: c.surface.containerHighest }]} value={editMinutes} onChangeText={setEditMinutes} keyboardType="number-pad" selectTextOnFocus />
                        <Text style={[styles.fieldLabel, { color: c.onSurface.variant }]}>Tarih</Text>
                        <View style={[styles.dateRow, { backgroundColor: c.surface.containerLow, borderColor: c.surface.containerHighest }]}>
                            <TouchableOpacity style={[styles.dateArrowBtn, { backgroundColor: c.surface.containerLowest }]} onPress={() => changeEditDate(-1)}>
                                <FontAwesome name="chevron-left" size={12} color={c.primary.main} />
                            </TouchableOpacity>
                            <Text style={[styles.dateValue, { color: c.onSurface.main }]}>{formatShortDate(editDate)}</Text>
                            <TouchableOpacity style={[styles.dateArrowBtn, { backgroundColor: c.surface.containerLowest }]} onPress={() => changeEditDate(1)}>
                                <FontAwesome name="chevron-right" size={12} color={c.primary.main} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalCancel, { backgroundColor: c.surface.containerHigh }]} onPress={() => setEditingTask(null)}>
                                <Text style={[styles.modalCancelText, { color: c.onSurface.variant }]}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalSave, { backgroundColor: c.primary.main }]} onPress={handleEditSave}>
                                <Text style={styles.modalSaveText}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Task Modal */}
            <Modal visible={showAddModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalSheet, { backgroundColor: c.surface.containerLowest }]}>
                        <View style={styles.modalHeader}>
                            <FontAwesome name="plus-circle" size={20} color={c.primary.main} />
                            <Text style={[styles.modalTitle, { color: c.onSurface.main }]}>Yeni Görev</Text>
                        </View>
                        <Text style={[styles.modalSubtitle, { color: c.onSurface.variant }]}>{formatShortDate(currentDate)} tarihine görev ekle</Text>
                        <Text style={[styles.fieldLabel, { color: c.onSurface.variant }]}>Görev Türü</Text>
                        <TypeChips selected={addTaskType} onSelect={setAddTaskType} />
                        <Text style={[styles.fieldLabel, { color: c.onSurface.variant }]}>Hedef Dakika</Text>
                        <TextInput style={[styles.modalInput, { backgroundColor: c.surface.containerLow, color: c.primary.main, borderColor: c.surface.containerHighest }]} value={addMinutes} onChangeText={setAddMinutes} keyboardType="number-pad" selectTextOnFocus />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalCancel, { backgroundColor: c.surface.containerHigh }]} onPress={() => setShowAddModal(false)}>
                                <Text style={[styles.modalCancelText, { color: c.onSurface.variant }]}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalSave, { backgroundColor: c.primary.main }]} onPress={handleAddSave}>
                                <Text style={styles.modalSaveText}>Ekle</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    emptyState: { padding: 40, alignItems: 'center', gap: 10 },
    emptyText: { fontSize: 14 },
    taskCard: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 8, borderRadius: 12, overflow: 'hidden', ...shadows.md },
    taskCardDone: { opacity: 0.55 },
    colorBar: { width: 3 },
    taskContent: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
    taskRow: { flexDirection: 'row', alignItems: 'center' },
    taskInfo: { flex: 1 },
    subjectText: { fontSize: 15, fontWeight: '600' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
    phaseBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
    phaseText: { fontSize: 10, fontWeight: '600' },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    typeText: { fontSize: 11, fontWeight: '500' },
    minutesBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    minutesText: { fontSize: 11, fontWeight: '600' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    completeBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', ...shadows.sm },
    doneBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 5 },
    doneText: { fontSize: 11, fontWeight: '600' },
    deleteBtn: { padding: 6 },
    addTaskBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginTop: 4, marginBottom: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed' },
    addTaskBtnText: { fontSize: 14, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalSheet: { borderRadius: 20, padding: 24, width: '88%', maxWidth: 380, ...shadows.lg },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 },
    modalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
    modalSubtitle: { fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },
    fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
    modalInput: { borderRadius: 12, padding: 14, fontSize: 22, fontWeight: '700', textAlign: 'center', borderWidth: 2 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 12 },
    modalCancel: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
    modalCancelText: { fontSize: 15, fontWeight: '600' },
    modalSave: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', ...shadows.md },
    modalSaveText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5 },
    chipText: { fontSize: 12, fontWeight: '600' },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, borderRadius: 12, paddingVertical: 10, borderWidth: 2 },
    dateArrowBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', ...shadows.sm },
    dateValue: { fontSize: 15, fontWeight: '600', minWidth: 120, textAlign: 'center' },
});
