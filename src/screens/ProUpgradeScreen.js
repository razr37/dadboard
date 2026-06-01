// src/screens/ProUpgradeScreen.js
import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';

const BENEFITS = [
  { text: 'Invite family via Telegram — no app needed for iPhone users' },
  { text: 'Unlimited family members' },
  { text: 'Status notifications back to Telegram' },
  { text: 'Priority support' },
];

export default function ProUpgradeScreen({ navigation }) {
  const { familyId } = useApp();

  function handleUpgrade() {
    const subject = encodeURIComponent('Upgrade to Pro');
    const body = encodeURIComponent(
      `Please upgrade my family to Pro.\n\nFamily ID: ${familyId ?? 'unknown'}`
    );
    Linking.openURL(`mailto:dadboard.privacy@gmail.com?subject=${subject}&body=${body}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Dadboard Pro</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={[styles.hero, shadow.md]}>
          <View style={styles.heroIcon}>
            <Ionicons name="star" size={36} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Unlock the full Dadboard experience</Text>
          <Text style={styles.heroSub}>One plan, every feature, the whole family.</Text>
        </View>

        <View style={[styles.card, shadow.sm]}>
          <Text style={styles.sectionLabel}>What you get</Text>
          {BENEFITS.map((item, i) => (
            <View key={i} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.benefitText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.priceCard, shadow.md]}>
          <Text style={styles.priceLabel}>Monthly subscription</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceCurrency}>SGD</Text>
            <Text style={styles.priceAmount}>3.99</Text>
            <Text style={styles.pricePer}>/month</Text>
          </View>

          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade}>
            <Ionicons name="star" size={16} color={colors.white} />
            <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
          </TouchableOpacity>

          <Text style={styles.manualNote}>
            We'll manually activate Pro within 24 hours and confirm by email.
          </Text>
        </View>

      </ScrollView>
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

  hero: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg,
  },
  heroIcon: {
    width: 72, height: 72, borderRadius: radius.full,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroTitle: { ...typography.h2, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  heroSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.label, color: colors.textTertiary,
    textTransform: 'uppercase', marginBottom: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: spacing.md, marginBottom: spacing.md,
  },
  benefitText: { ...typography.body, color: colors.textPrimary, flex: 1, lineHeight: 22 },

  priceCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg,
    borderWidth: 2, borderColor: colors.primary,
  },
  priceLabel: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.md },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.xl },
  priceCurrency: { ...typography.h3, color: colors.textSecondary, marginBottom: 4, marginRight: 4 },
  priceAmount: { fontSize: 48, fontWeight: '700', color: colors.textPrimary, letterSpacing: -1 },
  pricePer: { ...typography.body, color: colors.textSecondary, marginBottom: 8, marginLeft: 4 },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary,
    borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.xxl,
    width: '100%', marginBottom: spacing.lg,
  },
  upgradeBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  manualNote: {
    ...typography.caption, color: colors.textTertiary,
    textAlign: 'center', lineHeight: 16,
  },
});
