// src/screens/ConsentScreen.js  — v2 (PDPA + GDPR)
//
// What's new vs v1:
//  - Detects user's locale/region at launch
//  - Shows GDPR-specific language and lawful basis table for EU/UK users
//  - Records consent with region tag, timestamp, and app version
//  - EU users get an extra "I understand my GDPR rights" checkbox
//  - Separate "Withdraw consent" and "Right to object" flows for EU users

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Linking, Alert, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { colors, spacing, radius, typography } from '../utils/theme';

export const CONSENT_KEY = 'dadboard_consent_v1';

// EU/EEA country codes + UK
const EU_REGIONS = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR',
  'HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI',
  'SK','GB', // UK (UK GDPR)
  'IS','LI','NO', // EEA non-EU
]);

// Language codes that are widely used outside the EU (e.g. en-GB is standard in
// SG, MY, HK, AU). A locale tag ending in an EU country code is not sufficient
// evidence of EU residency when the language itself is globally distributed.
// GDPR is only triggered when Localization.region explicitly confirms an EU country.
const GLOBALLY_DISTRIBUTED_LANGS = new Set(['en', 'fr', 'es', 'pt', 'nl', 'de']);

function detectRegion() {
  // No IP geolocation — we must not send the user's IP to a third party before
  // they have consented. Region is derived entirely from device settings.
  // If Localization.region is null (e.g. no SIM, emulator, certain Android builds),
  // we default to PDPA (non-EU). We never infer EU residency from language alone.
  try {
    const locale = Localization.locale || '';
    const langCode = locale.split('-')[0]?.toLowerCase();

    // Primary source: explicit device region setting.
    const region = Localization.region?.toUpperCase();

    // Locale fallback: only use the country tag from the locale string when
    // Localization.region is unavailable AND the language is not one that is
    // globally distributed (e.g. reject "en-GB" as evidence of being in the UK).
    const localePart = locale.split('-').pop()?.toUpperCase();
    const localeCountry = localePart?.length === 2 ? localePart : undefined;
    const localeRegion =
      localeCountry && !GLOBALLY_DISTRIBUTED_LANGS.has(langCode)
        ? localeCountry
        : undefined;

    const regionCode = region || localeRegion || 'SG';

    // GDPR only fires when Localization.region explicitly places the user in the
    // EU/EEA/UK. A locale-derived country code is never enough on its own.
    const isEU = !!region && EU_REGIONS.has(region);

    return { regionCode, isEU, locale };
  } catch {
    return { regionCode: 'SG', isEU: false, locale: '' };
  }
}

export async function hasConsented() {
  try {
    const val = await AsyncStorage.getItem(CONSENT_KEY);
    return val === 'accepted';
  } catch { return false; }
}

export async function recordConsent(regionInfo) {
  await AsyncStorage.setItem(CONSENT_KEY, 'accepted');
  await AsyncStorage.setItem('dadboard_consent_meta', JSON.stringify({
    timestamp: new Date().toISOString(),
    region: regionInfo.regionCode,
    isEU: regionInfo.isEU,
    locale: regionInfo.locale,
    policyVersion: '2.0',
    platform: Platform.OS,
  }));
}

export async function revokeConsent() {
  await AsyncStorage.multiRemove([CONSENT_KEY, 'dadboard_consent_meta']);
}

export default function ConsentScreen({ onAccept }) {
  const [regionInfo] = useState(() => detectRegion());
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const isEU = regionInfo.isEU;

  const [checked, setChecked] = useState({
    understand: false,
    parent: false,
    privacy: false,
    gdpr: false,       // only required for EU users
  });

  const requiredChecks = isEU
    ? ['understand', 'parent', 'privacy', 'gdpr']
    : ['understand', 'parent', 'privacy'];

  const allChecked = requiredChecks.every(k => checked[k]);
  const canProceed = scrolledToBottom && allChecked;

  // Fallback: if all boxes are ticked and the user has been on screen for 2s,
  // unlock the button regardless of scroll position. Handles short content on
  // tall screens where the strict threshold is never reached.
  useEffect(() => {
    if (scrolledToBottom) return;
    const timer = setTimeout(() => {
      if (allChecked) setScrolledToBottom(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [allChecked, scrolledToBottom]);

  function handleScroll({ nativeEvent }) {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 100) {
      setScrolledToBottom(true);
    }
  }

  async function handleAccept() {
    console.log('[ConsentScreen] handleAccept called, onAccept type:', typeof onAccept);
    setAccepting(true);
    try {
      await recordConsent(regionInfo);
    } catch (e) {
      // Storage failure must not block navigation — consent is best-effort.
      console.warn('[ConsentScreen] recordConsent failed, proceeding anyway:', e);
    }
    // onAccept() is the only thing that drives navigation — App.js handles routing.
    onAccept();
  }

  function handleDecline() {
    Alert.alert(
      'Are you sure?',
      'Without accepting the privacy terms, Dadboard cannot store your family\'s data. You can uninstall the app if you prefer.',
      [
        { text: 'Go back', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () =>
          Alert.alert('Understood', 'No data has been collected. You can uninstall Dadboard at any time.')
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Ionicons name="car-outline" size={22} color={colors.primary} />
          </View>
          <Text style={styles.logoText}>Dadboard</Text>
          {isEU && (
            <View style={styles.gdprBadge}>
              <Text style={styles.gdprBadgeText}>GDPR</Text>
            </View>
          )}
        </View>
        <Text style={styles.title}>Before we begin</Text>
        <Text style={styles.subtitle}>
          {isEU
            ? `You're in ${regionInfo.regionCode} — GDPR applies. Please read how we handle your family's data.`
            : 'Please read how Dadboard handles your family\'s data. Governed by Singapore\'s PDPA.'}
        </Text>
      </View>

      {/* Scrollable summary */}
      <ScrollView
        style={styles.scroll}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        showsVerticalScrollIndicator
      >
        <PolicySection icon="person-outline" title="What we collect">
          {`Family member names, children's activity names, pickup locations, dates/times, and shopping requests.\n\nWe do NOT collect GPS location, photos, contacts, or any financial data.`}
        </PolicySection>

        <PolicySection icon="shield-checkmark-outline" title="How we protect it">
          {`Free plan: all data stays on this device only.\n\nPro plan: syncs to Google Firebase (encrypted in transit and at rest). Each family's data is isolated — no other family can access yours.`}
        </PolicySection>

        {/* GDPR-specific lawful basis section */}
        {isEU && (
          <View style={styles.gdprSection}>
            <View style={styles.gdprSectionHeader}>
              <Ionicons name="flag-outline" size={16} color='#185FA5' />
              <Text style={styles.gdprSectionTitle}>GDPR lawful basis (EU/UK)</Text>
            </View>
            <Text style={styles.gdprBody}>
              We process your data under these lawful bases (GDPR Article 6):
            </Text>
            <LawfulBasisRow basis="Consent" activity="Pickup requests, notifications, calendar export" />
            <LawfulBasisRow basis="Contract" activity="Pro cloud sync — necessary to deliver the service" />
            <LawfulBasisRow basis="Legitimate interests" activity="Crash reporting only (no personal data)" />
            <Text style={[styles.gdprBody, { marginTop: 8 }]}>
              You may withdraw consent or object to legitimate-interest processing at any time via Settings → Data & Privacy.
            </Text>
          </View>
        )}

        <PolicySection icon="people-outline" title="Children's data">
          {isEU
            ? `GDPR Article 8: We require a parent or guardian (18+) to set up the app. Children under 16 cannot independently create accounts. By ticking the parental consent box below, you confirm you are the responsible adult.\n\nUK users: the age threshold is 13 under UK GDPR.`
            : `Dadboard is set up by a parent or guardian (18+). By adding your children's profiles, you confirm you have parental authority to do so.`
          }
        </PolicySection>

        <PolicySection icon="share-social-outline" title="Who we share data with">
          {`We do not sell your data.\n\nGoogle Firebase (Pro users): cloud sync, governed by Google's Data Processing Terms. EU data transfers use Google's Standard Contractual Clauses (GDPR Art. 46).\n\nGoogle Play Services: device token only for push notifications — no personal content.`}
        </PolicySection>

        <PolicySection icon="list-outline" title={isEU ? 'Your rights (GDPR + PDPA)' : 'Your rights (PDPA)'}>
          {isEU
            ? `Access · Correction · Erasure ("right to be forgotten") · Data portability · Restriction · Right to object · Withdraw consent · Complain to your national DPA or the ICO (UK).\n\nAll requests handled within 1 month.`
            : `Access · Correction · Deletion · Data portability · Withdraw consent.\n\nAll requests handled within 30 days.`
          }
        </PolicySection>

        <PolicySection icon="alert-circle-outline" title="Data breach">
          {isEU
            ? `GDPR Article 33: We will notify your supervisory authority within 72 hours of a breach likely to risk your rights. You will be notified directly if it poses a high risk (Article 34).`
            : `We will notify Singapore's PDPC within 3 days of a notifiable breach. You will be informed directly if your data is affected.`
          }
        </PolicySection>

        <TouchableOpacity
          style={styles.policyLink}
          onPress={() => Linking.openURL('https://dadboard.app/privacy')}
        >
          <Ionicons name="open-outline" size={14} color={colors.info} />
          <Text style={styles.policyLinkText}>Read full Privacy Policy at dadboard.app/privacy</Text>
        </TouchableOpacity>

        {isEU && (
          <TouchableOpacity
            style={styles.policyLink}
            onPress={() => Linking.openURL('https://edpb.europa.eu/about-edpb/about-edpb/members_en')}
          >
            <Ionicons name="open-outline" size={14} color={colors.info} />
            <Text style={styles.policyLinkText}>Find your EU supervisory authority (edpb.europa.eu)</Text>
          </TouchableOpacity>
        )}

        {!scrolledToBottom && (
          <View style={styles.scrollHint}>
            <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
            <Text style={styles.scrollHintText}>Scroll down to continue</Text>
          </View>
        )}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Checkboxes */}
      <View style={styles.checkboxSection}>
        <CheckItem
          checked={checked.understand}
          onToggle={() => setChecked(p => ({ ...p, understand: !p.understand }))}
          label="I understand Dadboard stores family member names, children's activity details, and pickup locations."
        />
        <CheckItem
          checked={checked.parent}
          onToggle={() => setChecked(p => ({ ...p, parent: !p.parent }))}
          label={isEU
            ? `I am a parent or guardian (18+) and I provide parental consent for any children I add${regionInfo.regionCode === 'GB' ? ' (UK: children under 13)' : ' (EU: children under 16)'}.`
            : 'I am a parent or guardian (18+) and I consent on behalf of any children I add.'}
        />
        <CheckItem
          checked={checked.privacy}
          onToggle={() => setChecked(p => ({ ...p, privacy: !p.privacy }))}
          label="I have read and agree to Dadboard's Privacy Policy."
        />
        {isEU && (
          <CheckItem
            checked={checked.gdpr}
            onToggle={() => setChecked(p => ({ ...p, gdpr: !p.gdpr }))}
            label="I understand my GDPR rights (access, erasure, portability, objection) and that I can withdraw consent at any time via Settings → Data & Privacy."
            highlight
          />
        )}
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.acceptBtn, !canProceed && styles.acceptBtnDisabled]}
          onPress={handleAccept}
          disabled={!canProceed || accepting}
          activeOpacity={0.85}
        >
          {accepting ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.acceptText}>I agree — let's get started</Text>
            </>
          )}
        </TouchableOpacity>

        {!canProceed && (
          <Text style={styles.hintText}>
            {!scrolledToBottom
              ? 'Please scroll through the summary above first.'
              : `Please tick all ${requiredChecks.length} boxes to continue.`}
          </Text>
        )}

        <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PolicySection({ icon, title, children }) {
  return (
    <View style={styles.policySection}>
      <View style={styles.policySectionHeader}>
        <Ionicons name={icon} size={16} color={colors.primary} />
        <Text style={styles.policySectionTitle}>{title}</Text>
      </View>
      <Text style={styles.policySectionBody}>{children}</Text>
    </View>
  );
}

function LawfulBasisRow({ basis, activity }) {
  return (
    <View style={styles.basisRow}>
      <View style={styles.basisTag}>
        <Text style={styles.basisTagText}>{basis}</Text>
      </View>
      <Text style={styles.basisActivity}>{activity}</Text>
    </View>
  );
}

function CheckItem({ checked, onToggle, label, highlight }) {
  return (
    <TouchableOpacity
      style={[styles.checkRow, highlight && styles.checkRowHighlight]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={13} color={colors.white} />}
      </View>
      <Text style={[styles.checkLabel, highlight && styles.checkLabelHighlight]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
    backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  logoBox: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  gdprBadge: { backgroundColor: '#DBEAFE', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  gdprBadgeText: { fontSize: 10, fontWeight: '700', color: '#185FA5' },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: 4 },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  scroll: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  policySection: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 0.5, borderColor: colors.border,
  },
  policySectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  policySectionTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  policySectionBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  gdprSection: {
    backgroundColor: '#EFF6FF', borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  gdprSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  gdprSectionTitle: { ...typography.body, fontWeight: '700', color: '#185FA5' },
  gdprBody: { fontSize: 12, color: '#1E40AF', lineHeight: 18, marginBottom: 4 },
  basisRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 4 },
  basisTag: { backgroundColor: '#185FA5', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0 },
  basisTagText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  basisActivity: { fontSize: 12, color: '#1E40AF', flex: 1, lineHeight: 17 },
  policyLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm },
  policyLinkText: { ...typography.bodySmall, color: colors.info },
  scrollHint: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', paddingVertical: spacing.sm },
  scrollHintText: { ...typography.caption, color: colors.textTertiary },
  checkboxSection: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bgCard, gap: spacing.sm,
  },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkRowHighlight: { backgroundColor: '#EFF6FF', padding: spacing.sm, borderRadius: radius.md, marginHorizontal: -spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { ...typography.bodySmall, color: colors.textPrimary, flex: 1, lineHeight: 19 },
  checkLabelHighlight: { color: '#1E40AF' },
  buttons: { paddingHorizontal: spacing.lg, paddingBottom: 36, paddingTop: spacing.md, backgroundColor: colors.bgCard },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, marginBottom: spacing.sm },
  acceptBtnDisabled: { backgroundColor: colors.muted },
  acceptText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  hintText: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginBottom: spacing.sm },
  declineBtn: { alignItems: 'center', padding: spacing.sm },
  declineText: { ...typography.bodySmall, color: colors.textSecondary },
});
