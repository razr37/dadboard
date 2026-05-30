// src/screens/ShoppingScreen.js
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { Avatar, EmptyState, SectionHeader } from '../components/UI';

export default function ShoppingScreen({ navigation }) {
  const { requests, updateRequestStatus, deleteRequest } = useApp();

  const pending = requests.filter(r => r.type === 'buy' && r.status === 'pending');
  const done = requests.filter(r => r.type === 'buy' && r.status === 'done');

  function markDone(id) { updateRequestStatus(id, 'done'); }
  function markPending(id) { updateRequestStatus(id, 'pending'); }
  function remove(id) {
    Alert.alert('Remove item', 'Delete this shopping request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRequest(id) },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Shopping list</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddRequest')} style={styles.addBtn}>
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {pending.length === 0 && done.length === 0 && (
          <EmptyState icon="🛒" title="Nothing here yet" subtitle="Family members can request items and they'll appear here." />
        )}

        {pending.length > 0 && (
          <>
            <SectionHeader title={`To get (${pending.length})`} />
            {pending.map(req => (
              <ShopCard key={req.id} req={req} onDone={() => markDone(req.id)} onDelete={() => remove(req.id)} />
            ))}
          </>
        )}

        {done.length > 0 && (
          <>
            <SectionHeader title="Got it" />
            {done.map(req => (
              <ShopCard key={req.id} req={req} isDone onUndo={() => markPending(req.id)} onDelete={() => remove(req.id)} />
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function ShopCard({ req, isDone, onDone, onUndo, onDelete }) {
  const urgencyColor = req.urgency === 'Today' || req.urgency === 'ASAP'
    ? colors.danger : req.urgency === 'This weekend'
    ? colors.warning : colors.textTertiary;

  return (
    <View style={[styles.card, shadow.sm, isDone && styles.cardDone]}>
      <TouchableOpacity style={styles.checkArea} onPress={isDone ? onUndo : onDone}>
        <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
          {isDone && <Ionicons name="checkmark" size={14} color={colors.white} />}
        </View>
      </TouchableOpacity>

      <View style={styles.cardBody}>
        <Text style={[styles.itemText, isDone && styles.itemDone]}>{req.item}</Text>
        <View style={styles.metaRow}>
          <Avatar name={req.fromName} colorIndex={req.colorIndex} size={18} />
          <Text style={styles.fromText}>{req.fromName}</Text>
          <View style={[styles.urgencyTag, { backgroundColor: isDone ? colors.muted : urgencyColor + '20' }]}>
            <Text style={[styles.urgencyText, { color: isDone ? colors.textTertiary : urgencyColor }]}>
              {req.urgency}
            </Text>
          </View>
        </View>
        {req.note ? <Text style={styles.noteText}>{req.note}</Text> : null}
      </View>

      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  addBtn: { padding: 6, backgroundColor: colors.primaryLight, borderRadius: radius.full },
  scroll: { paddingTop: spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    padding: spacing.md, gap: spacing.md,
  },
  cardDone: { opacity: 0.6 },
  checkArea: { padding: 4 },
  checkbox: {
    width: 24, height: 24, borderRadius: radius.full,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  cardBody: { flex: 1 },
  itemText: { ...typography.body, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  itemDone: { textDecorationLine: 'line-through', color: colors.textTertiary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  fromText: { ...typography.caption, color: colors.textSecondary },
  urgencyTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  urgencyText: { fontSize: 11, fontWeight: '600' },
  noteText: { ...typography.caption, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  deleteBtn: { padding: 4 },
});
