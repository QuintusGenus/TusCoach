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

/** Format a Date as YYYY-MM-DD using local timezone. */
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
    tasks,
    currentDate,
    planStartDate,
    planEndDate,
    onComplete,
    onDelete,
    onUpdateTask,
    onAddTask,
}: PlanListProps) {
    // --- Edit task state ---
    const [editingTask, setEditingTask] = useState<PlanTask | null>(null);
    const [editMinutes, setEditMinutes] = useState('');
    const [editTaskType, setEditTaskType] = useState('');
    const [editDate, setEditDate] = useState('');

    // --- Add task state ---
    const [showAddModal, setShowAddModal] = useState(false);
    const [addMinutes, setAddMinutes] = useState('60');
    const [addTaskType, setAddTaskType] = useState<string>('review');

    // --- Edit handlers ---

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

        if (Object.keys(data).length === 0) {
            setEditingTask(null);
            return;
        }

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

    // --- Add handlers ---

    const handleAddOpen = () => {
        setAddMinutes('60');
        setAddTaskType('review');
        setShowAddModal(true);
    };

    const handleAddSave = () => {
        const mins = parseInt(addMinutes, 10);
        if (isNaN(mins) || mins < 5 || mins > 180) {
            Alert.alert('Hata', 'Süre 5-180 dakika arası olmalı');
            return;
        }
        onAddTask({ date: currentDate, task_type: addTaskType, target_minutes: mins });
        setShowAddModal(false);
    };

    // --- Delete handler ---

    const handleDelete = (task: PlanTask) => {
        const typeInfo = TASK_TYPE_LABELS[task.task_type];
        Alert.alert(
            'Görevi Sil',
            `${task.subject} - ${typeInfo?.label || task.task_type} silinecek. Emin misiniz?`,
            [
                { text: 'İptal', style: 'cancel' },
                { text: 'Sil', style: 'destructive', onPress: () => onDelete(task.id) },
            ],
        );
    };

    // --- Task type chip component ---

    const TypeChips = ({
        selected,
        onSelect,
    }: {
        selected: string;
        onSelect: (t: string) => void;
    }) => (
        <View style={styles.chipRow}>
            {TASK_TYPES.map((t) => {
                const info = TASK_TYPE_LABELS[t];
                const isSelected = t === selected;
                return (
                    <TouchableOpacity
                        key={t}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => onSelect(t)}
                        activeOpacity={0.7}
                    >
                        <FontAwesome
                            name={info.icon as any}
                            size={11}
                            color={isSelected ? '#fff' : '#6b7280'}
                        />
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                            {info.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    // --- Render ---

    return (
        <View>
            {tasks.length === 0 ? (
                <View style={styles.emptyState}>
                    <FontAwesome name="check-circle-o" size={32} color="#d1d5db" />
                    <Text style={styles.emptyText}>Bu tarih için görev yok.</Text>
                </View>
            ) : (
                tasks.map((task) => {
                    const color = task.subject
                        ? SUBJECT_COLORS[task.subject as TUSSubject] || '#6b7280'
                        : '#6b7280';
                    const isDone = task.status === 'done';
                    const typeInfo = TASK_TYPE_LABELS[task.task_type] || {
                        label: task.task_type,
                        icon: 'circle',
                    };

                    return (
                        <View
                            key={task.id}
                            style={[styles.taskCard, isDone && styles.taskCardDone]}
                        >
                            <View style={[styles.colorBar, { backgroundColor: color }]} />
                            <View style={styles.taskContent}>
                                <View style={styles.taskRow}>
                                    <TouchableOpacity
                                        style={styles.taskInfo}
                                        onPress={() => !isDone && handleEditOpen(task)}
                                        disabled={isDone}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.subjectText,
                                                isDone && styles.textDone,
                                            ]}
                                        >
                                            {task.subject || 'Genel'}
                                        </Text>
                                        <View style={styles.metaRow}>
                                            {task.phase && PHASE_STYLES[task.phase] && (
                                                <View
                                                    style={[
                                                        styles.phaseBadge,
                                                        { backgroundColor: PHASE_STYLES[task.phase].bg },
                                                    ]}
                                                >
                                                    <FontAwesome
                                                        name={PHASE_STYLES[task.phase].icon as any}
                                                        size={8}
                                                        color={PHASE_STYLES[task.phase].color}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.phaseText,
                                                            { color: PHASE_STYLES[task.phase].color },
                                                        ]}
                                                    >
                                                        {PHASE_STYLES[task.phase].label}
                                                    </Text>
                                                </View>
                                            )}
                                            <View style={styles.typeBadge}>
                                                <FontAwesome
                                                    name={typeInfo.icon as any}
                                                    size={9}
                                                    color="#6b7280"
                                                />
                                                <Text style={styles.typeText}>
                                                    {typeInfo.label}
                                                </Text>
                                            </View>
                                            <View style={styles.minutesBadge}>
                                                <FontAwesome
                                                    name="clock-o"
                                                    size={9}
                                                    color="#004225"
                                                />
                                                <Text style={styles.minutesText}>
                                                    {task.target_minutes} dk
                                                </Text>
                                            </View>
                                            {!isDone && (
                                                <FontAwesome
                                                    name="pencil"
                                                    size={10}
                                                    color="#9ca3af"
                                                />
                                            )}
                                        </View>
                                    </TouchableOpacity>

                                    <View style={styles.actions}>
                                        {isDone ? (
                                            <View style={styles.doneBadge}>
                                                <FontAwesome
                                                    name="check-circle"
                                                    size={12}
                                                    color="#16a34a"
                                                />
                                                <Text style={styles.doneText}>Yapıldı</Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                style={styles.completeBtn}
                                                onPress={() => onComplete(task.id)}
                                                activeOpacity={0.7}
                                            >
                                                <FontAwesome
                                                    name="check"
                                                    size={11}
                                                    color="#fff"
                                                />
                                            </TouchableOpacity>
                                        )}
                                        {!isDone && (
                                            <TouchableOpacity
                                                style={styles.deleteBtn}
                                                onPress={() => handleDelete(task)}
                                                activeOpacity={0.7}
                                            >
                                                <FontAwesome
                                                    name="trash-o"
                                                    size={13}
                                                    color="#d1d5db"
                                                />
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
            <TouchableOpacity
                style={styles.addTaskBtn}
                onPress={handleAddOpen}
                activeOpacity={0.7}
            >
                <FontAwesome name="plus" size={13} color="#004225" />
                <Text style={styles.addTaskBtnText}>Görev Ekle</Text>
            </TouchableOpacity>

            {/* ── Edit Task Modal ── */}
            <Modal visible={!!editingTask} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <FontAwesome name="pencil-square-o" size={20} color="#004225" />
                            <Text style={styles.modalTitle}>Görevi Düzenle</Text>
                        </View>
                        <Text style={styles.modalSubtitle}>
                            {editingTask?.subject || 'Genel'}
                        </Text>

                        {/* Task type chips */}
                        <Text style={styles.fieldLabel}>Görev Türü</Text>
                        <TypeChips selected={editTaskType} onSelect={setEditTaskType} />

                        {/* Minutes */}
                        <Text style={styles.fieldLabel}>Hedef Dakika</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editMinutes}
                            onChangeText={setEditMinutes}
                            keyboardType="number-pad"
                            selectTextOnFocus
                        />

                        {/* Date selector */}
                        <Text style={styles.fieldLabel}>Tarih</Text>
                        <View style={styles.dateRow}>
                            <TouchableOpacity
                                style={styles.dateArrowBtn}
                                onPress={() => changeEditDate(-1)}
                            >
                                <FontAwesome name="chevron-left" size={12} color="#004225" />
                            </TouchableOpacity>
                            <Text style={styles.dateValue}>{formatShortDate(editDate)}</Text>
                            <TouchableOpacity
                                style={styles.dateArrowBtn}
                                onPress={() => changeEditDate(1)}
                            >
                                <FontAwesome name="chevron-right" size={12} color="#004225" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancel}
                                onPress={() => setEditingTask(null)}
                            >
                                <Text style={styles.modalCancelText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalSave}
                                onPress={handleEditSave}
                            >
                                <Text style={styles.modalSaveText}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Add Task Modal ── */}
            <Modal visible={showAddModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <FontAwesome name="plus-circle" size={20} color="#004225" />
                            <Text style={styles.modalTitle}>Yeni Görev</Text>
                        </View>
                        <Text style={styles.modalSubtitle}>
                            {formatShortDate(currentDate)} tarihine görev ekle
                        </Text>

                        {/* Task type chips */}
                        <Text style={styles.fieldLabel}>Görev Türü</Text>
                        <TypeChips selected={addTaskType} onSelect={setAddTaskType} />

                        {/* Minutes */}
                        <Text style={styles.fieldLabel}>Hedef Dakika</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={addMinutes}
                            onChangeText={setAddMinutes}
                            keyboardType="number-pad"
                            selectTextOnFocus
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancel}
                                onPress={() => setShowAddModal(false)}
                            >
                                <Text style={styles.modalCancelText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalSave}
                                onPress={handleAddSave}
                            >
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
    emptyState: {
        padding: 40,
        alignItems: 'center',
        gap: 10,
    },
    emptyText: {
        fontSize: 14,
        color: '#9ca3af',
    },
    taskCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
    },
    taskCardDone: {
        opacity: 0.55,
    },
    colorBar: {
        width: 4,
    },
    taskContent: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    taskInfo: {
        flex: 1,
    },
    subjectText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    textDone: {
        textDecorationLine: 'line-through',
        color: '#9ca3af',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 5,
    },
    phaseBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    phaseText: {
        fontSize: 10,
        fontWeight: '600',
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    typeText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6b7280',
    },
    minutesBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    minutesText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#004225',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    completeBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#004225',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#004225',
        shadowOpacity: 0.3,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    doneBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        gap: 5,
    },
    doneText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#16a34a',
    },
    deleteBtn: {
        padding: 6,
    },

    /* Add task button */
    addTaskBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginTop: 4,
        marginBottom: 8,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#004225',
        borderStyle: 'dashed',
        backgroundColor: '#f0fdf4',
    },
    addTaskBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#004225',
    },

    /* Shared modal styles */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSheet: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '88%',
        maxWidth: 380,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 4,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111',
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
        marginTop: 12,
    },
    modalInput: {
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        padding: 14,
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        color: '#004225',
        borderWidth: 2,
        borderColor: '#e5e7eb',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        gap: 12,
    },
    modalCancel: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6b7280',
    },
    modalSave: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        backgroundColor: '#004225',
        alignItems: 'center',
        shadowColor: '#004225',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    modalSaveText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },

    /* Task type chips */
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#f3f4f6',
        borderWidth: 1.5,
        borderColor: '#e5e7eb',
    },
    chipSelected: {
        backgroundColor: '#004225',
        borderColor: '#004225',
    },
    chipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b7280',
    },
    chipTextSelected: {
        color: '#fff',
    },

    /* Date selector in modal */
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        paddingVertical: 10,
        borderWidth: 2,
        borderColor: '#e5e7eb',
    },
    dateArrowBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    dateValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        minWidth: 120,
        textAlign: 'center',
    },
});
