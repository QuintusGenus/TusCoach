import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
  Note,
} from '../src/api/notes';
import { TUS_SUBJECTS, SUBJECT_COLORS, TUSSubject } from '../src/constants/subjects';

export default function NotesScreen() {
  const queryClient = useQueryClient();
  const [filterSubject, setFilterSubject] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  // Form state
  const [formSubject, setFormSubject] = useState<string>(TUS_SUBJECTS[0]);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');

  const {
    data: notes = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['notes', filterSubject],
    queryFn: () => fetchNotes(filterSubject ?? undefined),
  });

  const createMutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      closeModal();
      Alert.alert('Başarılı', 'Not kaydedildi!');
    },
    onError: (err: any) => {
      Alert.alert('Hata', err.response?.data?.detail || 'Not kaydedilemedi');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateNote(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  function closeModal() {
    setIsAdding(false);
    setEditingNote(null);
    setFormSubject(TUS_SUBJECTS[0]);
    setFormTitle('');
    setFormContent('');
  }

  function openEdit(note: Note) {
    setEditingNote(note);
    setFormSubject(note.subject || TUS_SUBJECTS[0]);
    setFormTitle(note.title);
    setFormContent(note.content || '');
    setIsAdding(true);
  }

  function handleSubmit() {
    if (!formTitle.trim()) {
      Alert.alert('Hata', 'Başlık zorunludur');
      return;
    }
    if (editingNote) {
      updateMutation.mutate({
        id: editingNote.id,
        data: {
          subject: formSubject,
          title: formTitle.trim(),
          content: formContent.trim() || undefined,
        },
      });
    } else {
      createMutation.mutate({
        subject: formSubject,
        title: formTitle.trim(),
        content: formContent.trim() || undefined,
      });
    }
  }

  function handleDelete(id: number) {
    Alert.alert('Notu Sil', 'Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Stack.Screen options={{ title: 'Notlar', headerShown: true }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Subject Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[styles.filterPill, !filterSubject && styles.filterPillActive]}
            onPress={() => setFilterSubject(null)}
          >
            <Text style={[styles.filterPillText, !filterSubject && styles.filterPillTextActive]}>
              Tümü
            </Text>
          </TouchableOpacity>
          {TUS_SUBJECTS.map((sub) => (
            <TouchableOpacity
              key={sub}
              style={[styles.filterPill, filterSubject === sub && styles.filterPillActive]}
              onPress={() => setFilterSubject(filterSubject === sub ? null : sub)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  filterSubject === sub && styles.filterPillTextActive,
                ]}
              >
                {sub}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Notes List */}
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#004225" />
        ) : notes.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome name="sticky-note-o" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Henüz not yok</Text>
            <Text style={styles.emptyHint}>İlk notunuzu oluşturmak için + tuşuna basın</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          >
            <View style={{ padding: 16, gap: 10 }}>
              {notes.map((note) => {
                const color = note.subject
                  ? SUBJECT_COLORS[note.subject as TUSSubject] || '#6b7280'
                  : '#6b7280';
                return (
                  <TouchableOpacity
                    key={note.id}
                    style={styles.noteCard}
                    onPress={() => openEdit(note)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.noteHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.noteTitle}>{note.title}</Text>
                        <View style={styles.noteMeta}>
                          {note.subject && (
                            <View style={[styles.noteTag, { backgroundColor: color + '18' }]}>
                              <Text style={[styles.noteTagText, { color }]}>{note.subject}</Text>
                            </View>
                          )}
                          <Text style={styles.noteDate}>
                            {new Date(note.created_at).toLocaleDateString('tr-TR', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDelete(note.id)}
                        style={{ padding: 6 }}
                      >
                        <FontAwesome name="trash-o" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    {note.content ? (
                      <Text style={styles.notePreview} numberOfLines={2}>
                        {note.content}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ height: 80 }} />
          </ScrollView>
        )}

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setIsAdding(true)}
          activeOpacity={0.8}
        >
          <FontAwesome name="plus" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Add/Edit Modal */}
        <Modal visible={isAdding} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeModal}>
                  <Text style={styles.modalCancel}>İptal</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {editingNote ? 'Notu Düzenle' : 'Yeni Not'}
                </Text>
                <TouchableOpacity onPress={handleSubmit} disabled={isSaving}>
                  <Text style={[styles.modalSave, isSaving && { opacity: 0.5 }]}>
                    Kaydet
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Subject Picker */}
                <Text style={styles.formLabel}>Ders</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {TUS_SUBJECTS.map((sub) => (
                    <TouchableOpacity
                      key={sub}
                      style={[
                        styles.subjectChip,
                        formSubject === sub && {
                          backgroundColor: SUBJECT_COLORS[sub] || '#004225',
                        },
                      ]}
                      onPress={() => setFormSubject(sub)}
                    >
                      <Text
                        style={[
                          styles.subjectChipText,
                          formSubject === sub && { color: '#fff' },
                        ]}
                      >
                        {sub}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.formLabel}>Başlık</Text>
                <TextInput
                  style={styles.input}
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder="Not başlığı"
                />

                <Text style={styles.formLabel}>İçerik</Text>
                <TextInput
                  style={[styles.input, { minHeight: 160, textAlignVertical: 'top' }]}
                  value={formContent}
                  onChangeText={setFormContent}
                  multiline
                  placeholder="Notlarınızı buraya yazın..."
                />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },

  // Filters
  filterScroll: {
    maxHeight: 44,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  filterPillActive: { backgroundColor: '#004225' },
  filterPillText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterPillTextActive: { color: '#fff' },

  // Note cards
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  noteHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  noteTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  noteMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  noteTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  noteTagText: { fontSize: 11, fontWeight: '600' },
  noteDate: { fontSize: 11, color: '#9ca3af' },
  notePreview: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 18,
  },

  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  emptyText: { fontSize: 16, color: '#9ca3af', marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#d1d5db', marginTop: 4 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCancel: { fontSize: 16, color: '#004225' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
  modalSave: { fontSize: 16, fontWeight: '600', color: '#004225' },
  modalBody: { padding: 20 },
  formLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
    marginBottom: 16,
  },
  subjectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  subjectChipText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
});
