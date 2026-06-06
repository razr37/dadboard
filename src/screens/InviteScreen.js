// src/screens/InviteScreen.js
// Invite screen — two sections:
//   1. Per-member magic links (all families) — one card per non-parent member
//   2. Telegram bot invite (Pro only) — single token for the whole family

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Clipboard, Alert, Linking, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { generateTelegramInvite, generateMemberInvite, auth } from '../utils/firebase';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';

const TELEGRAM_BOT = 'DadboardBot';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dadboard.app';

const ROLE_LABEL = {
  telegram_user: 'Telegram User',
  app_user:      'App User',
};

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

export default function InviteScreen({ navigation }) {
  const { familyId, isSynced, isPro, family } = useApp();

  // Per-member invite state: { [memberId]: { token, expiry, generating, copied } }
  const [memberInvites, setMemberInvites] = useState({});

  // Telegram invite state (Pro only)
  const [telegramToken, setTelegramToken] = useState(null);
  const [telegramExpiry, setTelegramExpiry] = useState(null);
  const [generatingTelegram, setGeneratingTelegram] = useState(false);
  const [copiedTelegram, setCopiedTelegram] = useState(false);

  // PIN prompt state
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

  function patchMember(id, patch) {
    setMemberInvites(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function generateMemberToken(member) {
    let pin = null;
    if (member.role === 'telegram_user') {
      pin = await promptForPin();
    }
    patchMember(member.id, { generating: true });
    try {
      let token, link;
      if (member.role === 'telegram_user') {
        token = await generateTelegramInvite(familyId, auth.currentUser?.uid, pin);
        link = `https://t.me/${TELEGRAM_BOT}?start=${token}`;
      } else {
        token = await generateMemberInvite(
          familyId, member.id, member.role, member.name, member.colorIndex
        );
        link = `dadboard://join?invite=${token}`;
      }
      patchMember(member.id, {
        token,
        link,
        pin,
        expiry: new Date(Date.now() + 48 * 60 * 60 * 1000),
        generating: false,
        copied: false,
      });
    } catch {
      Alert.alert('Error', 'Could not generate invite link. Please try again.');
      patchMember(member.id, { generating: false });
    }
  }

  function copyMemberLink(member, link) {
    Clipboard.setString(link);
    patchMember(member.id, { copied: true });
    setTimeout(() => patchMember(member.id, { copied: false }), 2500);
  }

  const [telegramPin, setTelegramPin] = useState(null);

  async function generateTelegramToken() {
    if (!familyId || !auth.currentUser?.uid) return;
    const pin = await promptForPin();
    setGeneratingTelegram(true);
    try {
      const token = await generateTelegramInvite(familyId, auth.currentUser.uid, pin);
      setTelegramToken(token);
      setTelegramPin(pin);
      setTelegramExpiry(new Date(Date.now() + 48 * 60 * 60 * 1000));
    } catch {
      Alert.alert('Error', 'Could not generate Telegram invite link. Please try again.');
    } finally {
      setGeneratingTelegram(false);
    }
  }

  async function handleWhatsApp(message) {
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not found', 'WhatsApp does not appear to be installed on this device.');
    }
  }

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
        </View>
      </View>
    );
  }

  const invitableMembers = family.filter(m => m.role !== 'parent');
  const telegramLink = telegramToken ? `https://t.me/${TELEGRAM_BOT}?start=${telegramToken}` : null;

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} />

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Per-member magic links ───────────────────────────────────────── */}
        {invitableMembers.length === 0 ? (
          <View style={[styles.emptyState, shadow.sm]}>
            <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No family members yet</Text>
            <Text style={styles.emptyBody}>
              Add Telegram Users or App Users from the member list, then come back here to send their invite link.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Family member invites</Text>
            {invitableMembers.map(member => {
              const invite = memberInvites[member.id] || {};
              const deepLink = invite.link || null;
              const pinNote = invite.pin ? `\n\nYour PIN is: ${invite.pin} — you'll need this to connect.` : '';
              const waMessage = deepLink
                ? member.role === 'telegram_user'
                  ? `Message @${TELEGRAM_BOT} on Telegram to join the family:\n${deepLink}${pinNote}\n\n(Link expires in 48 hours)`
                  : `${member.name} has been added to your Dadboard family! 🎉\n\n` +
                    `Install the app: ${PLAY_STORE_URL}\n\n` +
                    `Then tap this link to join: ${deepLink}\n\n(Link expires in 48 hours)`
                : null;

              return (
                <View key={member.id} style={[styles.memberCard, shadow.sm]}>
                  {/* Member identity */}
                  <View style={styles.memberCardHeader}>
                    <View style={[
                      styles.avatar,
                      { backgroundColor: member.colorIndex >= 0 ? colors.kidsLight[member.colorIndex % 5] : colors.primaryLight },
                    ]}>
                      <Text style={[
                        styles.avatarText,
                        { color: member.colorIndex >= 0 ? colors.kids[member.colorIndex % 5] : colors.primary },
                      ]}>
                        {member.name?.charAt(0)?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberRoleLabel}>{ROLE_LABEL[member.role] ?? member.role}</Text>
                    </View>
                  </View>

                  {/* Token area */}
                  {invite.generating ? (
                    <View style={styles.tokenLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.tokenLoadingText}>Generating secure link…</Text>
                    </View>
                  ) : invite.token ? (
                    <>
                      <View style={styles.linkBox}>
                        <Text style={styles.linkText} numberOfLines={1}>{deepLink}</Text>
                      </View>
                      <Text style={styles.expiryNote}>
                        Expires {formatExpiry(invite.expiry)} · one-time use
                      </Text>

                      <TouchableOpacity
                        style={styles.whatsappBtn}
                        onPress={() => handleWhatsApp(waMessage)}
                      >
                        <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
                        <Text style={styles.whatsappBtnText}>Share via WhatsApp</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.copyBtn, invite.copied && styles.copyBtnDone]}
                        onPress={() => copyMemberLink(member, deepLink)}
                      >
                        <Ionicons
                          name={invite.copied ? 'checkmark-outline' : 'copy-outline'}
                          size={15}
                          color={invite.copied ? colors.success : colors.primary}
                        />
                        <Text style={[styles.copyBtnText, invite.copied && { color: colors.success }]}>
                          {invite.copied ? 'Copied!' : 'Copy link'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.regenerateBtn}
                        onPress={() => generateMemberToken(member)}
                      >
                        <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
                        <Text style={styles.regenerateBtnText}>Regenerate link</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.generateBtn}
                      onPress={() => generateMemberToken(member)}
                    >
                      <Ionicons name="link-outline" size={16} color={colors.white} />
                      <Text style={styles.generateBtnText}>Generate invite link</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ── Telegram invite (Pro) ────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Telegram bot</Text>

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

            {generatingTelegram || !telegramToken ? (
              telegramToken === null && !generatingTelegram ? (
                <TouchableOpacity style={styles.generateBtn} onPress={generateTelegramToken}>
                  <Ionicons name="link-outline" size={16} color={colors.white} />
                  <Text style={styles.generateBtnText}>Generate Telegram invite link</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.tokenLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.tokenLoadingText}>Generating secure link…</Text>
                </View>
              )
            ) : (
              <>
                <View style={styles.linkBox}>
                  <Text style={styles.linkText} numberOfLines={1}>{telegramLink}</Text>
                </View>
                <Text style={styles.expiryNote}>
                  Expires {formatExpiry(telegramExpiry)} · one-time use
                </Text>

                <TouchableOpacity
                  style={styles.whatsappBtn}
                  onPress={() => {
                    const pinNote = telegramPin ? `\n\nYour PIN is: ${telegramPin} — you'll need this to connect.` : '';
                    handleWhatsApp(
                      `Join my Dadboard family! Message @${TELEGRAM_BOT} on Telegram with this link: ` +
                      `t.me/${TELEGRAM_BOT}?start=${telegramToken}${pinNote} (expires in 48 hours)`
                    );
                  }}
                >
                  <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
                  <Text style={styles.whatsappBtnText}>Share via WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.copyBtn, copiedTelegram && styles.copyBtnDone]}
                  onPress={() => {
                    Clipboard.setString(telegramLink);
                    setCopiedTelegram(true);
                    setTimeout(() => setCopiedTelegram(false), 2500);
                  }}
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

                <TouchableOpacity style={styles.regenerateBtn} onPress={generateTelegramToken}>
                  <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
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
            <TouchableOpacity style={styles.proBtn} onPress={() => navigation.navigate('ProUpgrade')}>
              <Ionicons name="star" size={15} color={colors.white} />
              <Text style={styles.proBtnText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          </View>
        )}

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

  sectionLabel: {
    ...typography.label, color: colors.textTertiary,
    textTransform: 'uppercase', marginBottom: spacing.sm,
  },

  // ── Per-member cards ───────────────────────────────────────────────────────
  memberCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 0.5, borderColor: colors.border,
  },
  memberCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.md, marginBottom: spacing.md,
  },
  avatar: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  memberName: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  memberRoleLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },

  // ── Telegram card ──────────────────────────────────────────────────────────
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

  // ── Shared token UI ────────────────────────────────────────────────────────
  tokenLoading: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.lg,
  },
  tokenLoadingText: { ...typography.bodySmall, color: colors.textSecondary },
  linkBox: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  linkText: { fontSize: 12, color: colors.textSecondary, fontFamily: 'monospace' },
  expiryNote: {
    ...typography.caption, color: colors.textTertiary,
    textAlign: 'center', marginBottom: spacing.md,
  },

  // ── Action buttons ─────────────────────────────────────────────────────────
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary,
    borderRadius: radius.md, paddingVertical: 11,
  },
  generateBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
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

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.xl, alignItems: 'center',
    marginBottom: spacing.lg, borderWidth: 0.5, borderColor: colors.border,
  },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyBody: {
    ...typography.bodySmall, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },

  // ── Guest wall ─────────────────────────────────────────────────────────────
  guestWall: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  guestTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  guestBody: {
    ...typography.bodySmall, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },

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
