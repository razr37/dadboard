// src/screens/SettingsScreen.js
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { ClearableInput } from '../components/UI';
import { revokeConsent } from './ConsentScreen';
import { signOut } from 'firebase/auth';
import {
  sendPasswordReset, deleteAllFamilyData, auth,
} from '../utils/firebase';

const APP_VERSION = '1.0.0';

export default function SettingsScreen({ navigation }) {
  const {
    currentUser, updateCurrentUserName,
    familyId, isSynced, authUser,
  } = useApp();

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(currentUser?.name || '');

  // ── Edit profile name ──────────────────────────────────────────────────────
  async function handleSaveName() {
    const name = draftName.trim();
    if (!name) return;
    try {
      await updateCurrentUserName(name);
      setEditingName(false);
    } catch {
      Alert.alert('Error', 'Could not update name. Please try again.');
    }
  }

  // ── Change password ────────────────────────────────────────────────────────
  function handleChangePassword() {
    const email = authUser?.email;
    if (!email) {
      Alert.alert(
        'Guest account',
        'Password reset requires a Dadboard account. Create one from the Auth screen.',
        [{ text: 'OK' }]
      );
      return;
    }
    Alert.alert(
      'Reset password',
      `We'll send a password reset link to:\n\n${email}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send link',
          onPress: async () => {
            try {
              await sendPasswordReset(email);
              Alert.alert('Sent!', `Check ${email} for the reset link.`);
            } catch {
              Alert.alert('Error', 'Could not send reset email. Try again later.');
            }
          },
        },
      ]
    );
  }

  // ── Delete account ─────────────────────────────────────────────────────────
  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently deletes:\n• All family profiles\n• All requests & meal plans\n• Your account\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: confirmDelete },
      ]
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Final confirmation',
      'Are you absolutely sure? Everything will be permanently erased.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, delete everything', style: 'destructive', onPress: performDelete },
      ]
    );
  }

  async function performDelete() {
    if (isSynced && familyId) {
      try {
        await deleteAllFamilyData(familyId);
      } catch (e) {
        console.error('Delete cloud data failed:', e.message, e.code);
        if (e?.code === 'auth/requires-recent-login') {
          Alert.alert(
            'Sign in required',
            'For security, please sign out and sign back in before deleting your account.',
            [{ text: 'OK' }]
          );
          return;
        }
        Alert.alert(
          'Partially deleted',
          `Local data will now be cleared.\n\nCloud data could not be deleted automatically (${e.message}) — it will be removed within 30 days.\n\nEmail dadboard.privacy@gmail.com for immediate removal.`,
          [{ text: 'OK' }]
        );
      }
    }

    try {
      await AsyncStorage.clear();
      await revokeConsent();
      await signOut(auth);
    } catch (e) {
      console.error('Local data clear failed:', e.message, e.code);
      Alert.alert(
        'Error',
        `Could not clear local data.\n\nError: ${e.message}\n\nEmail dadboard.privacy@gmail.com for manual deletion.`
      );
    }
  }

  // ── Sign out ───────────────────────────────────────────────────────────────
  function handleSignOut() {
    Alert.alert(
      'Sign out',
      'Sign out of your Dadboard account on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              await AsyncStorage.clear();
            } catch (e) {
              console.error('Sign out failed:', e.message);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-down" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Account ── */}
        <SectionLabel text="Account" />

        <View style={[styles.card, shadow.sm]}>
          {editingName ? (
            <View style={styles.editRow}>
              <Ionicons name="person-outline" size={18} color={colors.textTertiary} style={styles.rowIcon} />
              <ClearableInput
                style={styles.nameInput}
                wrapperStyle={{ flex: 1 }}
                value={draftName}
                onChangeText={setDraftName}
                autoFocus
                textContentType="name"
                autoComplete="name"
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
              />
              <TouchableOpacity onPress={handleSaveName} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditingName(false); setDraftName(currentUser?.name || ''); }} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SettingsRow
              icon="person-outline"
              label="Edit profile name"
              value={currentUser?.name}
              onPress={() => { setDraftName(currentUser?.name || ''); setEditingName(true); }}
            />
          )}
          <Divider />
          <SettingsRow
            icon="key-outline"
            label="Change password"
            desc={isSynced ? 'Send a reset link to your email' : 'Requires a Dadboard account'}
            onPress={handleChangePassword}
          />
        </View>

        {/* ── Family ── */}
        <SectionLabel text="Family" />

        <View style={[styles.card, shadow.sm]}>
          <SettingsRow
            icon="mail-outline"
            label="Invite family member"
            desc="Share your invite code"
            onPress={() => navigation.navigate('Invite')}
          />
          <Divider />
          <SettingsRow
            icon="people-outline"
            label="Manage members"
            desc="Switch profiles or add new members"
            onPress={() => navigation.navigate('SwitchUser')}
          />
        </View>

        {/* ── Privacy ── */}
        <SectionLabel text="Privacy" />

        <View style={[styles.card, shadow.sm]}>
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Data & Privacy"
            desc="Consent, data export, PDPA / GDPR rights"
            onPress={() => navigation.navigate('PrivacySettings')}
          />
        </View>

        {/* ── Sign out ── */}
        <SectionLabel text="Sign out" />

        <View style={[styles.card, shadow.sm]}>
          <SettingsRow
            icon="log-out-outline"
            label="Sign out"
            desc="Sign out of your account on this device"
            onPress={handleSignOut}
            destructive
          />
        </View>

        {/* ── Account removal ── */}
        <SectionLabel text="Account removal" />

        <View style={[styles.card, shadow.sm]}>
          <SettingsRow
            icon="trash-outline"
            label="Delete account & all data"
            desc="Permanently erases everything — cannot be undone"
            onPress={handleDeleteAccount}
            destructive
          />
        </View>

        {/* ── Version ── */}
        <Text style={styles.version}>Dadboard v{APP_VERSION}</Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function SectionLabel({ text }) {
  return <Text style={styles.sectionLabel}>{text.toUpperCase()}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function SettingsRow({ icon, label, desc, value, onPress, destructive }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIconWrap, destructive && { backgroundColor: colors.danger + '15' }]}>
        <Ionicons name={icon} size={18} color={destructive ? colors.danger : colors.textSecondary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, destructive && { color: colors.danger }]}>{label}</Text>
        {desc ? <Text style={styles.rowDesc}>{desc}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      <Ionicons
        name="chevron-forward"
        size={14}
        color={destructive ? colors.danger + '80' : colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
    backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, color: colors.textPrimary },
  scroll: { padding: spacing.lg },
  sectionLabel: {
    ...typography.label, color: colors.textTertiary,
    marginBottom: spacing.sm, marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  divider: { height: 0.5, backgroundColor: colors.border, marginLeft: 52 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 13, gap: spacing.sm,
  },
  rowIconWrap: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '500' },
  rowDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  rowValue: { ...typography.caption, color: colors.textTertiary, maxWidth: 100 },
  rowIcon: { marginLeft: spacing.xs },

  // Inline name edit
  editRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  nameInput: {
    flex: 1, ...typography.body, color: colors.textPrimary,
    borderBottomWidth: 1.5, borderBottomColor: colors.primary,
    paddingVertical: 4,
  },
  saveBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.md,
  },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  cancelBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  cancelBtnText: { fontSize: 13, color: colors.textSecondary },

  version: {
    ...typography.caption, color: colors.textTertiary,
    textAlign: 'center', marginTop: spacing.xl,
  },
});
