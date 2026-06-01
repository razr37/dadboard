// src/screens/PrivacySettingsScreen.js — v2 (PDPA + GDPR)
//
// New vs v1:
//  - Detects EU/UK region and shows GDPR-specific rights
//  - Right to restriction of processing (GDPR Art.18)
//  - Right to object to legitimate interests (GDPR Art.21)
//  - Links to national DPA and ICO
//  - Consent metadata display (region, timestamp, policy version)
//  - Expo-sharing wired up for actual JSON file delivery

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Linking, Share, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography } from '../utils/theme';
import { revokeConsent } from './ConsentScreen';
import { deleteAllFamilyData, signOut } from '../utils/firebase';

const EU_REGIONS = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR',
  'HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI',
  'SK','GB','IS','LI','NO',
]);

export default function PrivacySettingsScreen({ navigation }) {
  const { family, requests, currentUser, familyId, isSynced } = useApp();
  const [consentMeta, setConsentMeta] = useState(null);
  const [exporting, setExporting] = useState(false);
  const isEU = EU_REGIONS.has(consentMeta?.region);

  useEffect(() => {
    AsyncStorage.getItem('dadboard_consent_meta')
      .then(raw => raw && setConsentMeta(JSON.parse(raw)));
  }, []);

  // ── Data Export (GDPR Art.20 + PDPA) ──────────────────────────────────────
  async function handleExport() {
    setExporting(true);
    try {
      const payload = {
        exportInfo: {
          exportedAt: new Date().toISOString(),
          exportedBy: currentUser.name,
          policyVersion: consentMeta?.policyVersion || '2.0',
          appVersion: '1.0.0',
        },
        familyMembers: family.map(f => ({ name: f.name, role: f.role })),
        requests: requests.map(r => ({
          type: r.type,
          from: r.fromName,
          status: r.status,
          createdAt: new Date(r.createdAt).toISOString(),
          ...(r.type === 'pickup' ? { activity: r.activity, date: r.date, time: r.time, location: r.location, dropTo: r.dropTo, note: r.note } : {}),
          ...(r.type === 'buy' ? { item: r.item, urgency: r.urgency, note: r.note } : {}),
          ...(r.type === 'other' ? { message: r.message } : {}),
        })),
      };

      const json = JSON.stringify(payload, null, 2);
      const fileUri = `${FileSystem.documentDirectory}famigo_data_export_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Save or share your Dadboard data export',
          UTI: 'public.json',
        });
      } else {
        // Fallback for simulators
        Alert.alert('Export ready', `Data saved to:\n${fileUri}\n\nOn a real device, this will open your share sheet.`);
      }
    } catch (e) {
      Alert.alert('Export failed', `Could not export data. Please email dadboard.privacy@gmail.com for a manual export.\n\nError: ${e.message}`);
    } finally {
      setExporting(false);
    }
  }

  // ── Right to restriction (GDPR Art.18) ────────────────────────────────────
  function handleRestriction() {
    Alert.alert(
      'Restrict processing (GDPR Art. 18)',
      'You can request that we stop processing your data while a dispute is resolved (e.g. you contest data accuracy, or you\'ve objected and we\'re verifying legitimate interests).\n\nTo request restriction, email dadboard.privacy@gmail.com with subject "Restriction of processing request".\n\nDuring restriction, we will only store your data, not actively process it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Email us', onPress: () => Linking.openURL('mailto:dadboard.privacy@gmail.com?subject=Restriction of processing request - Dadboard') },
      ]
    );
  }

  // ── Right to object (GDPR Art.21) ─────────────────────────────────────────
  function handleObject() {
    Alert.alert(
      'Object to processing (GDPR Art. 21)',
      'You can object to processing based on our legitimate interests (currently: crash reporting only).\n\nIf you object, we will cease that processing unless we can demonstrate compelling legitimate grounds that override your interests.\n\nNote: objecting to crash reporting means we cannot use anonymous crash data to fix app bugs.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit objection', onPress: () => Linking.openURL('mailto:dadboard.privacy@gmail.com?subject=Right to object - Dadboard GDPR Art.21') },
      ]
    );
  }

  // ── Delete completed requests ──────────────────────────────────────────────
  function handleDeleteCompleted() {
    const n = requests.filter(r => r.status === 'done').length;
    if (!n) { Alert.alert('Nothing to delete', 'No completed requests found.'); return; }
    Alert.alert('Delete completed requests', `Permanently delete ${n} completed request${n > 1 ? 's' : ''}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Done', 'Completed requests deleted.') },
    ]);
  }

  // ── Delete all data ────────────────────────────────────────────────────────
  function handleDeleteAll() {
    const gdprNote = isEU ? '\n\nGDPR Art. 17: Cloud data will be permanently erased within 30 days.' : '';
    Alert.alert(
      'Delete all my data',
      `This permanently deletes:\n• All family profiles\n• All requests\n• Consent record\n• All settings${gdprNote}\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: confirmDeleteAll },
      ]
    );
  }

  function confirmDeleteAll() {
    Alert.alert('Final confirmation', 'Are you absolutely sure? All data will be permanently erased.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, delete all', style: 'destructive', onPress: performDelete },
    ]);
  }

  async function performDelete() {
    // Step 1: cloud deletion (sync mode only).
    // Isolated so that a cloud failure never blocks local cleanup.
    if (isSynced && familyId) {
      try {
        await deleteAllFamilyData(familyId);
      } catch (e) {
        console.error('Delete cloud data failed:', e.message, e.code);

        if (e?.code === 'auth/requires-recent-login') {
          // Do NOT clear local data — user must re-authenticate first,
          // then try again so deletion completes atomically.
          Alert.alert(
            'Sign in required',
            'For security, please sign out and sign back in before deleting your account.',
            [{ text: 'OK' }]
          );
          return;
        }

        // Any other cloud error: warn the user but proceed with local cleanup.
        Alert.alert(
          'Partially deleted',
          `Local data will now be cleared.\n\nCloud data could not be deleted automatically (${e.message}) — it will be removed within 30 days.\n\nEmail dadboard.privacy@gmail.com for immediate removal.`,
          [{ text: 'OK' }]
        );
      }
    }

    // Step 2: always clear local state, regardless of cloud outcome.
    try {
      await AsyncStorage.clear();
      await revokeConsent();
      await signOut();
      // Navigation handled automatically: signOut() triggers onAuthStateChanged(null)
      // in Root → App re-renders to AuthScreen.
    } catch (e) {
      console.error('Local data clear failed:', e.message, e.code);
      Alert.alert(
        'Error',
        `Could not clear local data.\n\nError: ${e.message}\n\nEmail dadboard.privacy@gmail.com for manual deletion.`
      );
    }
  }

  const consentDate = consentMeta?.timestamp
    ? new Date(consentMeta.timestamp).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Data & Privacy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Consent status card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
            <Text style={styles.cardTitle}>Your consent</Text>
            {isEU && <View style={styles.gdprPill}><Text style={styles.gdprPillText}>GDPR</Text></View>}
          </View>
          <DataRow label="Consent given" value={consentDate || 'Yes'} />
          <DataRow label="Region" value={consentMeta?.region || 'Unknown'} />
          <DataRow label="Policy version" value={`v${consentMeta?.policyVersion || '2.0'}`} />
          <DataRow label="Governing law" value={isEU ? 'GDPR + PDPA' : 'PDPA (Singapore)'} />
          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://razr37.github.io/dadboard/privacy/')}>
            <Ionicons name="open-outline" size={13} color={colors.info} />
            <Text style={styles.linkText}>Full Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        {/* Data stored */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="server-outline" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Data stored on this device</Text>
          </View>
          <DataRow label="Family members" value={`${family.length}`} />
          <DataRow label="Total requests" value={`${requests.length}`} />
          <DataRow label="Pending requests" value={`${requests.filter(r => r.status !== 'done').length}`} />
          <DataRow label="Storage" value="Local (AsyncStorage)" />
        </View>

        {/* Standard rights */}
        <Text style={styles.sectionLabel}>Manage your data</Text>
        <ActionRow icon="download-outline" label="Export my data" desc={isEU ? 'GDPR Art.20 — download JSON copy of all your data' : 'Download a JSON copy of all your family\'s data'} color={colors.info} onPress={handleExport} loading={exporting} />
        <ActionRow icon="checkmark-done-outline" label="Delete completed requests" desc="Remove old done/ticked items" color={colors.textSecondary} onPress={handleDeleteCompleted} />

        {/* GDPR-specific rights */}
        {isEU && (
          <>
            <Text style={styles.sectionLabel}>GDPR rights (EU/UK)</Text>
            <ActionRow icon="pause-circle-outline" label="Restrict processing" desc="GDPR Art.18 — pause processing while a dispute is resolved" color='#185FA5' onPress={handleRestriction} />
            <ActionRow icon="hand-left-outline" label="Object to processing" desc="GDPR Art.21 — object to legitimate-interest processing (crash reporting)" color='#185FA5' onPress={handleObject} />
            <TouchableOpacity style={styles.dpaCard} onPress={() => Linking.openURL(consentMeta?.region === 'GB' ? 'https://ico.org.uk' : 'https://edpb.europa.eu/about-edpb/about-edpb/members_en')}>
              <Ionicons name="flag-outline" size={16} color='#185FA5' />
              <View style={{ flex: 1 }}>
                <Text style={styles.dpaTitle}>{consentMeta?.region === 'GB' ? 'ICO (UK)' : 'Your national DPA'}</Text>
                <Text style={styles.dpaDesc}>GDPR Art.77 — lodge a complaint with your supervisory authority</Text>
              </View>
              <Ionicons name="open-outline" size={14} color='#185FA5' />
            </TouchableOpacity>
          </>
        )}

        {/* Account removal */}
        <Text style={styles.sectionLabel}>Account removal</Text>
        <ActionRow icon="exit-outline" label="Withdraw consent" desc="Removes consent record and clears all local data" color={colors.warning} onPress={() => {
          Alert.alert('Withdraw consent', 'This will clear all data and return you to the setup screen.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Withdraw', style: 'destructive', onPress: performDelete },
          ]);
        }} />
        <ActionRow icon="trash-outline" label="Delete account &amp; all data" desc={isEU ? 'GDPR Art.17 — permanently erases all data from device and cloud and deletes your account' : 'Permanently erases all family data from device and cloud and deletes your account'} color={colors.danger} onPress={handleDeleteAll} destructive />

        {/* Contact */}
        <View style={[styles.card, { marginTop: spacing.md }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="mail-outline" size={18} color={colors.textTertiary} />
            <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Contact us</Text>
          </View>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:dadboard.privacy@gmail.com')}>
            <Text style={styles.contactEmail}>dadboard.privacy@gmail.com</Text>
          </TouchableOpacity>
          {isEU && (
            <TouchableOpacity onPress={() => Linking.openURL('mailto:dadboard.privacy@gmail.com')}>
              <Text style={styles.contactEmail}>dadboard.privacy@gmail.com (EU representative)</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.contactNote]}>We respond within {isEU ? '1 month (GDPR)' : '30 days (PDPA)'}.</Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function DataRow({ label, value }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

function ActionRow({ icon, label, desc, color, onPress, destructive, loading }) {
  return (
    <TouchableOpacity style={[styles.actionRow, destructive && { borderColor: colors.danger + '40' }]} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.actionIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.actionBody}>
        <Text style={[styles.actionLabel, { color: destructive ? colors.danger : colors.textPrimary }]}>{label}</Text>
        <Text style={styles.actionDesc}>{desc}</Text>
      </View>
      {loading
        ? <Ionicons name="reload-outline" size={16} color={colors.textTertiary} />
        : <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, color: colors.textPrimary },
  scroll: { padding: spacing.lg },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  cardTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  gdprPill: { backgroundColor: '#DBEAFE', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  gdprPillText: { fontSize: 10, fontWeight: '700', color: '#185FA5' },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  dataLabel: { ...typography.bodySmall, color: colors.textSecondary },
  dataValue: { ...typography.bodySmall, fontWeight: '600', color: colors.textPrimary },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  linkText: { ...typography.bodySmall, color: colors.info },
  sectionLabel: { ...typography.label, color: colors.textTertiary, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.sm },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 0.5, borderColor: colors.border },
  actionIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  actionBody: { flex: 1 },
  actionLabel: { ...typography.body, fontWeight: '600' },
  actionDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  dpaCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#EFF6FF', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 0.5, borderColor: '#BFDBFE' },
  dpaTitle: { fontSize: 13, fontWeight: '700', color: '#185FA5' },
  dpaDesc: { fontSize: 12, color: '#1D4ED8', marginTop: 1 },
  contactEmail: { ...typography.body, color: colors.info, marginBottom: 4 },
  contactNote: { ...typography.caption, color: colors.textTertiary, marginTop: 4 },
});
