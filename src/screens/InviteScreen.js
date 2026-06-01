// src/screens/InviteScreen.js
// Dadboard — two invite paths:
//   1. Telegram bot — no app needed, any phone
//   2. Dadboard app — full experience, Play Store

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Clipboard, Alert, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';

const TELEGRAM_BOT = 'DadboardBot';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dadboard.app';

export default function InviteScreen({ navigation }) {
  const { familyId, isSynced, family } = useApp();
  const [copiedTelegram, setCopiedTelegram] = useState(false);
  const [copiedApp, setCopiedApp] = useState(false);

  // ── Guest mode gate ────────────────────────────────────────────────────────
  if (!isSynced || !familyId) {
    return (
      <View style={styles.container}>
        <Header onBack={() => navigation.goBack()} />
        <View style={styles.guestWall}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.guestTitle}>Account required</Text>
          <Text style={styles.guestBody}>
            Create a free Dadboard account to invite your family members and sync across devices.
          </Text>
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => navigation.navigate('Auth')}>
            <Text style={styles.upgradeBtnText}>Create account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Invite links ────────────────────────────────────────────────────────────
  const telegramLink = `https://t.me/${TELEGRAM_BOT}?start=${familyId}`;
  const telegramMessage =
    `Join our family on Dadboard! 🚗\n\n` +
    `Send your pickup requests, shopping needs and meal plans directly to Dad — no app needed, just Telegram.\n\n` +
    `Tap to start: ${telegramLink}`;

  const appMessage =
    `Join my Dadboard family! 🚗\n\n` +
    `Download the app: ${PLAY_STORE_URL}\n\n` +
    `Then tap "Join family" and enter code: ${familyId}`;

  async function handleWhatsApp(message) {
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not found', 'WhatsApp does not appear to be installed on this device.');
    }
  }

  async function handleCopy(text, setter) {
    Clipboard.setString(text);
    setter(true);
    setTimeout(() => setter(false), 2500);
  }

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Telegram invite ──────────────────────────────────────────────── */}
        <View style={[styles.card, shadow.md]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBg, { backgroundColor: '#E8F4FD' }]}>
              <Ionicons name="paper-plane-outline" size={22} color="#229ED9" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Invite via Telegram Bot</Text>
              <Text style={styles.cardSub}>For family members on any phone — no app needed</Text>
            </View>
          </View>

          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>{telegramLink}</Text>
          </View>

          <TouchableOpacity style={styles.whatsappBtn} onPress={() => handleWhatsApp(telegramMessage)}>
            <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
            <Text style={styles.whatsappBtnText}>Share via WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.copyBtn, copiedTelegram && styles.copyBtnDone]}
            onPress={() => handleCopy(telegramLink, setCopiedTelegram)}
          >
            <Ionicons
              name={copiedTelegram ? 'checkmark-outline' : 'copy-outline'}
              size={15}
              color={copiedTelegram ? colors.success : colors.primary}
            />
            <Text style={[styles.copyBtnText, copiedTelegram && { color: colors.success }]}>
              {copiedTelegram ? 'Copied!' : 'Copy link'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── App invite ───────────────────────────────────────────────────── */}
        <View style={[styles.card, shadow.md]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBg, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Invite via Dadboard App</Text>
              <Text style={styles.cardSub}>For family members who want the full app experience</Text>
            </View>
          </View>

          <Text style={styles.codeLabel}>Family invite code</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{familyId}</Text>
          </View>

          <TouchableOpacity style={styles.whatsappBtn} onPress={() => handleWhatsApp(appMessage)}>
            <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
            <Text style={styles.whatsappBtnText}>Share via WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.copyBtn, copiedApp && styles.copyBtnDone]}
            onPress={() => handleCopy(familyId, setCopiedApp)}
          >
            <Ionicons
              name={copiedApp ? 'checkmark-outline' : 'copy-outline'}
              size={15}
              color={copiedApp ? colors.success : colors.primary}
            />
            <Text style={[styles.copyBtnText, copiedApp && { color: colors.success }]}>
              {copiedApp ? 'Copied!' : 'Copy code'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Family members ───────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Family members ({family.length})</Text>
        {family.map(member => (
          <View key={member.id || member.uid} style={[styles.memberRow, shadow.sm]}>
            <View style={[
              styles.memberAvatar,
              { backgroundColor: member.colorIndex >= 0 ? colors.kidsLight[member.colorIndex % 5] : colors.primaryLight }
            ]}>
              <Text style={[
                styles.memberAvatarText,
                { color: member.colorIndex >= 0 ? colors.kids[member.colorIndex % 5] : colors.primary }
              ]}>
                {member.name?.charAt(0)?.toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberRole}>
                {member.role === 'parent' ? 'Parent · sees all requests' : 'Kid · can send requests'}
                {member.isLocalProfile ? ' · this device' : ''}
              </Text>
            </View>
            {member.role === 'parent' && (
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerBadgeText}>You</Text>
              </View>
            )}
          </View>
        ))}

      </ScrollView>
    </View>
  );
}

function Header({ onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.title}>Invite family</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
    backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center',
  },
  title: { ...typography.h3, color: colors.textPrimary },
  scroll: { padding: spacing.lg, paddingBottom: 100 },

  // ── Cards ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: spacing.md, marginBottom: spacing.lg,
  },
  cardIconBg: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  cardSub: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },

  // ── Telegram link box ──────────────────────────────────────────────────────
  linkBox: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  linkText: { fontSize: 12, color: colors.textSecondary, fontFamily: 'monospace' },

  // ── App code box ───────────────────────────────────────────────────────────
  codeLabel: { ...typography.caption, color: colors.textTertiary, textTransform: 'uppercase', marginBottom: spacing.sm },
  codeBox: {
    backgroundColor: colors.primaryLight, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    alignItems: 'center', marginBottom: spacing.md,
  },
  codeText: {
    fontSize: 13, fontFamily: 'monospace', color: colors.primaryDark,
    letterSpacing: 1,
  },

  // ── Shared action buttons ──────────────────────────────────────────────────
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: '#25D366',
    borderRadius: radius.md, paddingVertical: 12, marginBottom: spacing.sm,
  },
  whatsappBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  copyBtnDone: { borderColor: colors.success, backgroundColor: colors.successLight },
  copyBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  // ── Family members ─────────────────────────────────────────────────────────
  sectionLabel: {
    ...typography.label, color: colors.textTertiary,
    textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 16, fontWeight: '700' },
  memberName: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  memberRole: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  ownerBadge: {
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  ownerBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primaryDark },

  // ── Guest wall ─────────────────────────────────────────────────────────────
  guestWall: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  guestTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  guestBody: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
  upgradeBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xxl },
  upgradeBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
