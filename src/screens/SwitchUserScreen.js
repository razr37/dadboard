// src/screens/SwitchUserScreen.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, Linking, Clipboard, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { generateMemberInvite, generateTelegramInvite, auth } from '../utils/firebase';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { Avatar, ClearableInput } from '../components/UI';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dadboard.app';

const ROLE_OPTIONS = [
  { value: 'telegram_user', label: 'Telegram User', desc: 'Interacts via Telegram bot · no app needed' },
  { value: 'app_user',      label: 'App User',       desc: 'Full dashboard · manages all requests' },
];

const ADULT_ROLES = new Set(['parent', 'app_user']);

function roleLabel(role) {
  if (role === 'parent')        return 'Parent · receives all requests';
  if (role === 'app_user')      return 'App User · full dashboard';
  if (role === 'telegram_user') return 'Telegram User · sends via Telegram';
  return 'Telegram User · sends via Telegram';
}

export default function SwitchUserScreen({ navigation }) {
  const { family, currentUser, authUser, switchUser, addFamilyMember, deleteFamilyMember, familyId, isSynced } = useApp();
  const [newName, setNewName] = useState('');
  const [selectedRole, setSelectedRole] = useState('telegram_user');
  const [adding, setAdding] = useState(false);
  const [pinState, setPinState] = useState({ visible: false, resolve: null });
  const [pinValue, setPinValue] = useState('');

  function promptForPin() {
    return new Promise(resolve => {
      setPinValue('');
      setPinState({ visible: true, resolve });
    });
  }

  function handlePinConfirm() {
    const pin = pinValue.trim();
    const { resolve } = pinState;
    setPinState({ visible: false, resolve: null });
    setPinValue('');
    resolve(pin.length === 4 ? pin : null);
  }

  function handlePinSkip() {
    const { resolve } = pinState;
    setPinState({ visible: false, resolve: null });
    setPinValue('');
    resolve(null);
  }

  function handleSwitch(member) {
    // goBack() must fire before switchUser() changes currentUser.role.
    // A role change (parent ↔ kid) causes AppNavigator to swap the entire stack,
    // detaching this modal's navigation context before goBack() could run.
    try {
      if (navigation.canGoBack()) navigation.goBack();
      switchUser(member);
    } catch (e) {
      Alert.alert('Switch error', e.message);
    }
  }

  async function handleAddMember() {
    const name = newName.trim();
    if (!name) return;
    try {
      const member = await addFamilyMember(name, selectedRole);
      setNewName('');
      setSelectedRole('telegram_user');
      setAdding(false);

      // Offer to send a magic-link invite (synced families only)
      if (member && isSynced && familyId) {
        promptInvite(member);
      } else {
        if (navigation.canGoBack()) navigation.goBack();
      }
    } catch (e) {
      const isPermission = e?.code === 'permission-denied'
        || e?.message?.includes('Missing or insufficient permissions');
      if (isPermission) {
        Alert.alert('Permission denied', 'Only parents can add family members.');
      } else {
        Alert.alert('Error', `Could not add family member.\n\n${e.message}`);
      }
    }
  }

  async function promptInvite(member) {
    try {
      const isTelegram = member.role === 'telegram_user';
      let shareLink, waMessage;
      if (isTelegram) {
        const pin = await promptForPin();
        const token = await generateTelegramInvite(familyId, auth.currentUser?.uid, pin);
        shareLink = `https://t.me/DadboardBot?start=${token}`;
        const pinNote = pin ? `\n\nYour PIN is: ${pin} — you'll need this to connect.` : '';
        waMessage = `${member.name} has been added to your Dadboard family! 🎉\n\nTap this link to connect via Telegram:\n${shareLink}${pinNote}\n\n(Link expires in 48 hours)`;
      } else {
        const token = await generateMemberInvite(familyId, member.id, member.role, member.name, member.colorIndex);
        shareLink = `dadboard://join?invite=${token}`;
        waMessage = `${member.name} has been added to your Dadboard family! 🎉\n\nInstall the app: ${PLAY_STORE_URL}\n\nThen tap this link to join: ${shareLink}\n\n(Link expires in 48 hours)`;
      }
      const deepLink = shareLink;

      Alert.alert(
        `${member.name} added!`,
        'Send them an invite to join from their own phone?',
        [
          {
            text: 'Send via WhatsApp',
            onPress: async () => {
              const url = `whatsapp://send?text=${encodeURIComponent(waMessage)}`;
              const canOpen = await Linking.canOpenURL(url);
              if (canOpen) {
                Linking.openURL(url);
              } else {
                Alert.alert('WhatsApp not found', `Share this link with ${member.name}:\n\n${deepLink}`);
              }
              if (navigation.canGoBack()) navigation.goBack();
            },
          },
          {
            text: 'Copy link',
            onPress: () => {
              Clipboard.setString(deepLink);
              Alert.alert('Link copied!', 'Paste it in any browser or message app to share.', [
                { text: 'OK', onPress: () => { if (navigation.canGoBack()) navigation.goBack(); } },
              ]);
            },
          },
          {
            text: 'Do it later',
            style: 'cancel',
            onPress: () => { if (navigation.canGoBack()) navigation.goBack(); },
          },
        ]
      );
    } catch {
      // Token generation failed — just navigate back
      if (navigation.canGoBack()) navigation.goBack();
    }
  }

  function handleCancel() {
    setAdding(false);
    setNewName('');
    setSelectedRole('telegram_user');
  }

  function handleDelete(member) {
    Alert.alert(
      `Remove ${member.name}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFamilyMember(member.id);
            } catch (e) {
              Alert.alert('Error', `Could not remove ${member.name}.\n\n${e.message}`);
            }
          },
        },
      ]
    );
  }

  const appUsers      = family.filter(f => ADULT_ROLES.has(f.role));
  const telegramUsers = family.filter(f => f.role === 'telegram_user');

  return (
    <View style={styles.container}>
      <Modal transparent visible={pinState.visible} animationType="fade" onRequestClose={handlePinSkip}>
        <KeyboardAvoidingView
          style={styles.pinOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.pinCard}>
            <Text style={styles.pinTitle}>Set a 4-digit PIN</Text>
            <Text style={styles.pinSubtitle}>
              Optional extra security. Share the PIN separately — the family member will need it to connect.
            </Text>
            <TextInput
              style={styles.pinInput}
              value={pinValue}
              onChangeText={v => setPinValue(v.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="numeric"
              maxLength={4}
              placeholder="1234"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />
            <View style={styles.pinActions}>
              <TouchableOpacity style={styles.pinSkipBtn} onPress={handlePinSkip}>
                <Text style={styles.pinSkipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pinConfirmBtn, pinValue.length !== 4 && { opacity: 0.4 }]}
                onPress={handlePinConfirm}
                disabled={pinValue.length !== 4}
              >
                <Text style={styles.pinConfirmText}>Set PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() && navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Who's using the app?</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionLabel}>App Users</Text>
        {appUsers.map(member => (
          <MemberCard
            key={member.id}
            member={member}
            isActive={currentUser.id === member.id}
            onPress={() => handleSwitch(member)}
            canDelete={member.uid !== authUser?.uid && member.id !== authUser?.uid}
            onDelete={() => handleDelete(member)}
          />
        ))}

        {telegramUsers.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Telegram Users</Text>
            {telegramUsers.map(member => (
              <MemberCard
                key={member.id}
                member={member}
                isActive={currentUser.id === member.id}
                onPress={() => handleSwitch(member)}
                canDelete
                onDelete={() => handleDelete(member)}
              />
            ))}
          </>
        )}

        {adding ? (
          <View style={[styles.addForm, shadow.sm]}>
            <Text style={styles.addLabel}>Name</Text>
            <ClearableInput
              style={styles.input}
              placeholder="e.g. Sophia, Mum…"
              placeholderTextColor={colors.textTertiary}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              textContentType="name"
              autoComplete="name"
            />

            <Text style={[styles.addLabel, { marginTop: spacing.sm }]}>Role</Text>
            {ROLE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.roleOption, selectedRole === opt.value && styles.roleOptionActive]}
                onPress={() => setSelectedRole(opt.value)}
                activeOpacity={0.7}
              >
                <View style={[styles.radioOuter, selectedRole === opt.value && styles.radioOuterActive]}>
                  {selectedRole === opt.value && <View style={styles.radioInner} />}
                </View>
                <View style={styles.roleText}>
                  <Text style={[styles.roleLabel, selectedRole === opt.value && styles.roleLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.roleDesc}>{opt.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <View style={styles.addActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
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
            Switch to a Telegram User profile to add requests on their behalf from this device.
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function MemberCard({ member, isActive, onPress, canDelete, onDelete }) {
  const memberColor = member.colorIndex >= 0 ? colors.kids[member.colorIndex % 5] : colors.primary;
  return (
    <TouchableOpacity
      style={[styles.memberCard, shadow.sm, isActive && styles.memberCardActive, isActive && { borderColor: memberColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Avatar name={member.name} colorIndex={member.colorIndex} size={48} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.name}</Text>
        <Text style={styles.memberRole}>{roleLabel(member.role)}</Text>
      </View>
      {isActive && (
        <View style={[styles.activeCheck, { backgroundColor: memberColor }]}>
          <Ionicons name="checkmark" size={14} color={colors.white} />
        </View>
      )}
      {canDelete && !isActive && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={17} color={colors.danger} />
        </TouchableOpacity>
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
  deleteBtn: { padding: spacing.xs },
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
  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    marginBottom: spacing.sm, backgroundColor: colors.bg,
  },
  roleOptionActive: {
    borderColor: colors.primary, backgroundColor: colors.primaryLight,
  },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.primary,
  },
  roleText: { flex: 1 },
  roleLabel: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  roleLabelActive: { color: colors.primary },
  roleDesc: { ...typography.caption, color: colors.textTertiary, marginTop: 1 },
  addActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.sm },
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

  // ── PIN modal ──────────────────────────────────────────────────────────────
  pinOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl,
  },
  pinCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.xl, width: '100%',
  },
  pinTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  pinSubtitle: {
    ...typography.bodySmall, color: colors.textSecondary,
    lineHeight: 20, marginBottom: spacing.lg,
  },
  pinInput: {
    backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    fontSize: 28, fontWeight: '700', color: colors.textPrimary,
    textAlign: 'center', letterSpacing: 8, marginBottom: spacing.lg,
  },
  pinActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  pinSkipBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  pinSkipText: { fontSize: 14, color: colors.textSecondary },
  pinConfirmBtn: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.md,
  },
  pinConfirmText: { fontSize: 14, color: colors.white, fontWeight: '700' },
});
