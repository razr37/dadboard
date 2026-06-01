// src/screens/InviteScreen.js
// Dadboard — two invite paths:
//   1. Telegram bot — no app needed, any phone
//   2. Dadboard app — full experience, Play Store

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Clipboard, Alert, Linking, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { generateTelegramInvite, auth } from '../utils/firebase';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';

const TELEGRAM_BOT = 'DadboardBot';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dadboard.app';

export default function InviteScreen({ navigation }) {
  const { familyId, isSynced, isPro, family } = useApp();
  const [copiedTelegram, setCopiedTelegram] = useState(false);
  const [copiedApp, setCopiedApp] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [tokenExpiry, setTokenExpiry] = useState(null);
  const [generatingToken, setGeneratingToken] = useState(false);

  async function generateToken() {
    if (!familyId || !auth.currentUser?.uid) return;
    setGeneratingToken(true);
    try {
      const token = await generateTelegramInvite(familyId, auth.currentUser.uid);
      setInviteToken(token);
      setTokenExpiry(new Date(Date.now() + 48 * 60 * 60 * 1000));
    } catch (e) {
      Alert.alert('Error', 'Could not generate invite link. Please try again.');
    } finally {
      setGeneratingToken(false);
    }
  }

  useEffect(() => {
    if (isPro && isSynced && familyId) {
      generateToken();
    }
  }, []);

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
  const telegramLink = inviteToken ? `https://t.me/${TELEGRAM_BOT}?start=${inviteToken}` : null;
  const telegramMessage = inviteToken
    ? `Join my Dadboard family! Message @${TELEGRAM_BOT} on Telegram with this link: t.me/${TELEGRAM_BOT}?start=${inviteToken} (expires in 48 hours)`
    : null;

  function formatExpiry(date) {
    if (!date) return '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const h = date.getHours();
    const mins = date.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    const hour12 = h % 12 || 12;
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} at ${hour12}:${mins}${ampm}`;
  }

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
        {isPro ? (
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

            {generatingToken || !inviteToken ? (
              <View style={styles.tokenLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.tokenLoadingText}>Generating secure link…</Text>
              </View>
            ) : (
              <>
                <View style={styles.linkBox}>
                  <Text style={styles.linkText} numberOfLines={1}>{telegramLink}</Text>
                </View>
                <Text style={styles.expiryNote}>Link expires {formatExpiry(tokenExpiry)} · one-time use</Text>

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

                <TouchableOpacity style={styles.regenerateBtn} onPress={generateToken}>
                  <Ionicons name="refresh-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.regenerateBtnText}>Generate new link</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View style={[styles.card, shadow.md, styles.lockedCard]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBg, { backgroundColor: colors.muted }]}>
                <Ionicons name="lock-closed" size={22} color={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.textTertiary }]}>Invite via Telegram Bot</Text>
                <Text style={styles.cardSub}>Pro feature — no app needed for iPhone users</Text>
              </View>
            </View>
            <Text style={styles.lockedDesc}>
              Let family members send requests directly via Telegram — no app installation needed for iPhone users.
            </Text>
            <TouchableOpacity
              style={styles.proBtn}
              onPress={() => navigation.navigate('ProUpgrade')}
            >
              <Ionicons name="star" size={15} color={colors.white} />
              <Text style={styles.proBtnText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          </View>
        )}

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

  // ── Token UI ───────────────────────────────────────────────────────────────
  tokenLoading: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.lg,
  },
  tokenLoadingText: { ...typography.bodySmall, color: colors.textSecondary },
  expiryNote: {
    ...typography.caption, color: colors.textTertiary,
    textAlign: 'center', marginBottom: spacing.md,
  },
  regenerateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, marginTop: spacing.sm, paddingVertical: spacing.sm,
  },
  regenerateBtnText: { ...typography.caption, color: colors.textSecondary },

  // ── Pro gate ───────────────────────────────────────────────────────────────
  lockedCard: { borderWidth: 1, borderColor: colors.border },
  lockedDesc: {
    ...typography.bodySmall, color: colors.textSecondary,
    lineHeight: 19, marginBottom: spacing.lg,
  },
  proBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary,
    borderRadius: radius.md, paddingVertical: 12,
  },
  proBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },

  // ── Guest wall ─────────────────────────────────────────────────────────────
  guestWall: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  guestTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  guestBody: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
  upgradeBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xxl },
  upgradeBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
