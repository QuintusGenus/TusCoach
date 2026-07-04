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
import type { PlanTask } from '../api/coach';

const TASK_TYPE_LABELS: Record<string, string> = {
    review: 'Konu Tekrarı',
    question: 'Soru Çözümü',
    video: 'Video İzleme',
    note: 'Not Çıkarma',
};

interface PlanListProps {
    tasks: PlanTask[];
    onComplete: (id: number) => void;
    onDelete: (id: number) => void;
    onUpdateMinutes: (id: number, minutes: number) => void;
}

export function PlanList({ tasks, onComplete, onDelete, onUpdateMinutes }: PlanListProps) {
    const [editingTask, setEditingTask] = useState<PlanTask | null>(null);
    const [editMinutes, setEditMinutes] = useState('');

    const handleEditOpen = (task: PlanTask) => {
        setEditMinutes(String(task.target_minutes));
        setEditingTask(task);
    };

    const handleEditSave = () => {
        if (!editingTask) return;
        const mins = parseInt(editMinutes, 10);
        if (isNaN(mins) || mins < 5) {
            Alert.alert('Hata', 'En az 5 dakika olmalı');
            return;
        }
        onUpdateMinutes(editingTask.id, mins);
        setEditingTask(null);
    };

    const handleDelete = (task: PlanTask) => {
        Alert.alert(
            'Görevi Sil',
            `${task.subject} - ${TASK_TYPE_LABELS[task.task_type] || task.task_type} silinecek. Emin misiniz?`,
            [
                { text: 'İptal', style: 'cancel' },
                { text: 'Sil', style: 'destructive', onPress: () => onDelete(task.id) },
            ],
        );
    };

    if (tasks.length === 0) {
        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Bu tarih için görev yok.</Text>
            </View>
        );
    }

    return (
        <View>
            {tasks.map((task) => {
                const color = task.subject
                    ? SUBJECT_COLORS[task.subject as TUSSubject] || '#6b7280'
                    : '#6b7280';
                const isDone = task.status === 'done';
                const typeLabel = TASK_TYPE_LABELS[task.task_type] || task.task_type;

                return (
                    <View
                        key={task.id}
                        style={[styles.taskCard, isDone && styles.taskCardDone]}
                    >
                        <View style={styles.taskRow}>
                            <View style={[styles.dot, { backgroundColor: color }]} />
                            <View style={styles.taskInfo}>
                                <Text
                                    style={[
                                        styles.subjectText,
                                        isDone && styles.textDone,
                                    ]}
                                >
                                    {task.subject || 'Genel'}
                                </Text>
                                <View style={styles.metaRow}>
                                    <View style={styles.typeBadge}>
                                        <Text style={styles.typeText}>{typeLabel}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.minutesBadge}
                                        onPress={() => !isDone && handleEditOpen(task)}
                                        disabled={isDone}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.minutesText}>
                                            {task.target_minutes} dk
                                        </Text>
                                        {!isDone && (
                                            <FontAwesome
                                                name="pencil"
                                                size={9}
                                                color="#6b7280"
                                                style={{ marginLeft: 4 }}
                                            />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.actions}>
                                {isDone ? (
                                    <View style={styles.doneBadge}>
                                        <FontAwesome name="check" size={10} color="#16a34a" />
                                        <Text style={styles.doneText}>Yapıldı</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.completeBtn}
                                        onPress={() => onComplete(task.id)}
                                        activeOpacity={0.7}
                                    >
                                        <FontAwesome name="check" size={10} color="#fff" />
                                    </TouchableOpacity>
                                )}
                                {!isDone && (
                                    <TouchableOpacity
                                        style={styles.deleteBtn}
                                        onPress={() => handleDelete(task)}
                                        activeOpacity={0.7}
                                    >
                                        <FontAwesome name="trash-o" size={12} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                );
            })}

            {/* Edit minutes modal */}
            <Modal visible={!!editingTask} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Hedef Dakika</Text>
                        <Text style={styles.modalSubtitle}>
                            {editingTask?.subject} — {TASK_TYPE_LABELS[editingTask?.task_type || ''] || ''}
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editMinutes}
                            onChangeText={setEditMinutes}
                            keyboardType="number-pad"
                            autoFocus
                            selectTextOnFocus
                        />
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
        </View>
    );
}

const styles = StyleSheet.create({
    emptyState: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#9ca3af',
    },
    taskCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    taskCardDone: {
        opacity: 0.6,
    },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    taskInfo: {
        flex: 1,
    },
    subjectText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111',
    },
    textDone: {
        textDecorationLine: 'line-through',
        color: '#9ca3af',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    typeBadge: {
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
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#004225',
        justifyContent: 'center',
        alignItems: 'center',
    },
    doneBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    doneText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#16a34a',
    },
    deleteBtn: {
        padding: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSheet: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '80%',
        maxWidth: 320,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
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
    modalInput: {
        backgroundColor: '#f3f4f6',
        borderRadius: 10,
        padding: 12,
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
        color: '#111',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        gap: 12,
    },
    modalCancel: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
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
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#004225',
        alignItems: 'center',
    },
    modalSaveText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
});
