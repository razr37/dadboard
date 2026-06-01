// src/screens/InviteScreen.js
// Dadboard — Dad shares the familyId as an invite code.
// Family members enter this code in AuthScreen → Join family tab.

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Share, Clipboard, Alert, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';

export default function InviteScreen({ navigation }) {
  const { familyId, isSynced, family } = useApp();
  const [copied, setCopied] = useState(false);

  // Guest mode — no invite code available
  if (!isSynced || !familyId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.title}>Invite family</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.guestWall}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.guestTitle}>Account required</Text>
          <Text style={styles.guestBody}>
            Create a free Dadboard account to invite your family members and sync across devices.
          </Text>
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.upgradeBtnText}>Create account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const inviteLink = `https://dadboard.app/join?code=${familyId}`;
  const inviteMessage = `Join my Dadboard family!\n\nTap to join:\n${inviteLink}\n\nOr open the app and enter code: ${familyId}`;

  async function handleCopyLink() {
    Clipboard.setString(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleShare() {
    try {
      await Share.share({ message: inviteMessage, title: 'Join my Dadboard' });
    } catch (e) {
      Alert.alert('Share failed', 'Could not open share sheet.');
    }
  }

  async function handleWhatsApp() {
    const url = `whatsapp://send?text=${encodeURIComponent(inviteMessage)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not found', 'WhatsApp does not appear to be installed on this device.');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Invite family</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.scroll}>
        {/* Invite link card */}
        <View style={[styles.codeCard, shadow.md]}>
          <Text style={styles.codeLabel}>Your family invite link</Text>
          <Text style={styles.linkValue}>{inviteLink}</Text>
          <Text style={styles.codeHint}>
            Send this link to your family. Tapping it opens the app (or Play Store) with the invite code pre-filled.
          </Text>

          {/* WhatsApp — primary share action */}
          <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
            <Text style={styles.whatsappBtnText}>Share via WhatsApp</Text>
          </TouchableOpacity>

          <View style={styles.codeActions}>
            <TouchableOpacity
              style={[styles.codeBtn, copied && styles.codeBtnSuccess]}
              onPress={handleCopyLink}
            >
              <Ionicons
                name={copied ? 'checkmark-outline' : 'copy-outline'}
                size={16}
                color={copied ? colors.success : colors.primary}
              />
              <Text style={[styles.codeBtnText, copied && { color: colors.success }]}>
                {copied ? 'Copied!' : 'Copy link'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.codeBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={16} color={colors.primary} />
              <Text style={styles.codeBtnText}>Share via...</Text>
            </TouchableOpacity>
          </View>

          {/* Raw code fallback */}
          <Text style={styles.rawCodeNote}>Manual code: <Text style={styles.rawCode}>{familyId}</Text></Text>
        </View>

        {/* Current family members */}
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

        {/* How it works */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How joining works</Text>
          <HowStep num="1" text="Family member downloads Dadboard" />
          <HowStep num="2" text='They tap "Join family" and enter the code above' />
          <HowStep num="3" text="They create their account and appear in your family list" />
          <HowStep num="4" text="They can submit pickup requests straight to your dashboard" />
        </View>
      </ScrollView>
    </View>
  );
}

function HowStep({ num, text }) {
  return (
    <View style={styles.howStep}>
      <View style={styles.howNum}>
        <Text style={styles.howNumText}>{num}</Text>
      </View>
      <Text style={styles.howText}>{text}</Text>
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
  backBtn: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, color: colors.textPrimary },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  codeCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.xl, marginBottom: spacing.xl, alignItems: 'center',
  },
  codeLabel: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.md },
  codeValue: {
    fontSize: 13, fontFamily: 'monospace', color: colors.primaryDark,
    backgroundColor: colors.primaryLight, padding: spacing.md,
    borderRadius: radius.md, letterSpacing: 1, textAlign: 'center',
    marginBottom: spacing.md, width: '100%',
  },
  linkValue: {
    fontSize: 12, color: colors.primaryDark,
    backgroundColor: colors.primaryLight, padding: spacing.md,
    borderRadius: radius.md, textAlign: 'center',
    marginBottom: spacing.md, width: '100%',
  },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: '#25D366',
    borderRadius: radius.md, paddingVertical: 12,
    marginBottom: spacing.md, width: '100%',
  },
  whatsappBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  rawCodeNote: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.sm, textAlign: 'center' },
  rawCode: { fontFamily: 'monospace', color: colors.textSecondary },
  codeHint: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  codeActions: { flexDirection: 'row', gap: spacing.md },
  codeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  codeBtnSuccess: { borderColor: colors.success, backgroundColor: colors.successLight },
  codeBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  sectionLabel: { ...typography.label, color: colors.textTertiary, textTransform: 'uppercase', marginBottom: spacing.sm },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  memberAvatar: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 16, fontWeight: '700' },
  memberName: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  memberRole: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  ownerBadge: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  ownerBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primaryDark },
  howCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, marginTop: spacing.lg,
    borderWidth: 0.5, borderColor: colors.border,
  },
  howTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  howStep: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  howNum: { width: 22, height: 22, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  howNumText: { fontSize: 11, fontWeight: '700', color: colors.white },
  howText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 20 },
  guestWall: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  guestTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  guestBody: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
  upgradeBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xxl },
  upgradeBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
