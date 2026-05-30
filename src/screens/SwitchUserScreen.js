// src/screens/SwitchUserScreen.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { Avatar, PrimaryButton } from '../components/UI';

export default function SwitchUserScreen({ navigation }) {
  const { family, currentUser, switchUser, addFamilyMember } = useApp();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  async function handleSwitch(member) {
    await switchUser(member);
    navigation.goBack();
  }

  function handleAddMember() {
    if (!newName.trim()) return;
    addFamilyMember(newName.trim());
    setNewName('');
    setAdding(false);
  }

  const dad = family.find(f => f.role === 'parent');
  const kids = family.filter(f => f.role === 'kid');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Who's using the app?</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionLabel}>Parent</Text>
        {dad && (
          <MemberCard
            member={dad}
            isActive={currentUser.id === dad.id}
            onPress={() => handleSwitch(dad)}
            isParent
          />
        )}

        <Text style={styles.sectionLabel}>Kids</Text>
        {kids.map(kid => (
          <MemberCard
            key={kid.id}
            member={kid}
            isActive={currentUser.id === kid.id}
            onPress={() => handleSwitch(kid)}
          />
        ))}

        {adding ? (
          <View style={[styles.addForm, shadow.sm]}>
            <Text style={styles.addLabel}>Kid's name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sophia"
              placeholderTextColor={colors.textTertiary}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.addActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setAdding(false); setNewName(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !newName.trim() && { opacity: 0.4 }]}
                onPress={handleAddMember}
                disabled={!newName.trim()}
              >
                <Text style={styles.confirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addNewBtn} onPress={() => setAdding(true)}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.addNewText}>Add a family member</Text>
          </TouchableOpacity>
        )}

        <View style={styles.tip}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
          <Text style={styles.tipText}>
            Switch to a kid's profile so they can send you requests without seeing the full family view.
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function MemberCard({ member, isActive, onPress, isParent }) {
  const kidColor = member.colorIndex >= 0 ? colors.kids[member.colorIndex % 5] : colors.primary;
  return (
    <TouchableOpacity
      style={[styles.memberCard, shadow.sm, isActive && styles.memberCardActive, isActive && { borderColor: kidColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Avatar name={member.name} colorIndex={member.colorIndex} size={48} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.name}</Text>
        <Text style={styles.memberRole}>{isParent ? 'Parent · receives all requests' : 'Kid · can send requests'}</Text>
      </View>
      {isActive && (
        <View style={[styles.activeCheck, { backgroundColor: kidColor }]}>
          <Ionicons name="checkmark" size={14} color={colors.white} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center',
  },
  title: { ...typography.h3, color: colors.textPrimary },
  scroll: { paddingHorizontal: spacing.lg },
  sectionLabel: {
    ...typography.label, color: colors.textTertiary,
    textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm,
  },
  memberCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.sm,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  memberCardActive: { backgroundColor: colors.primaryLight },
  memberInfo: { flex: 1 },
  memberName: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  memberRole: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  activeCheck: {
    width: 24, height: 24, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  addNewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.lg, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed',
    marginTop: spacing.sm,
  },
  addNewText: { ...typography.body, color: colors.primary, fontWeight: '500' },
  addForm: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, marginTop: spacing.sm,
  },
  addLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    fontSize: 15, color: colors.textPrimary, marginBottom: spacing.md,
  },
  addActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  cancelText: { fontSize: 14, color: colors.textSecondary },
  confirmBtn: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.md,
  },
  confirmText: { fontSize: 14, color: colors.white, fontWeight: '700' },
  tip: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    marginTop: spacing.xl, padding: spacing.md,
    backgroundColor: colors.muted, borderRadius: radius.md,
  },
  tipText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 18 },
});
