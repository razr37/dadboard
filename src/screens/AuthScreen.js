// src/screens/AuthScreen.js
// Dadboard — shown when no Firebase user session exists.
//
// Three flows:
//   1. "Start as Dad" — creates email account + new family (parent setup)
//   2. "Join family" — signs in + joins existing family with invite code (kids/spouse)
//   3. "Try without account" — anonymous auth, local-only (free tier, one device)

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  signInAnonymously, signInWithEmail,
  createEmailAccount, joinFamily, createFamily, sendPasswordReset,
} from '../utils/firebase';
import { colors, spacing, radius, typography } from '../utils/theme';

const TABS = ['parent', 'join', 'guest'];

export default function AuthScreen({ initialInviteCode }) {
  const [tab, setTab] = useState(initialInviteCode ? 'join' : 'parent');
  const [loading, setLoading] = useState(false);

  // Parent — create-account fields
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Parent — sign-in fields (completely separate state; never shares password with create)
  const [signInMode, setSignInMode] = useState(false);
  const [signInPassword, setSignInPassword] = useState('');

  // Join fields
  const [joinName, setJoinName] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInviteCode || '');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  // ── Create parent account ──────────────────────────────────────────────────
  async function handleCreateParent() {
    if (!parentName.trim()) return Alert.alert('Missing info', 'Please enter your name.');
    if (!email.trim()) return Alert.alert('Missing info', 'Please enter your email address.');
    if (createPassword.length < 8) return Alert.alert('Weak password', 'Password must be at least 8 characters.');
    setLoading(true);
    try {
      await createEmailAccount(email.trim(), createPassword);
      await createFamily(parentName.trim());
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        Alert.alert(
          'Email already registered',
          'This email already has an account. Would you like to sign in instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign in',
              onPress: () => {
                setSignInPassword(''); // never carry over the create-account password
                setSignInMode(true);
              },
            },
          ]
        );
      } else {
        Alert.alert('Sign up failed', friendlyError(e.code));
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Sign in existing parent ────────────────────────────────────────────────
  async function handleSignIn() {
    if (!email.trim() || !signInPassword) return Alert.alert('Missing info', 'Enter email and password.');
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), signInPassword);
    } catch (e) {
      Alert.alert('Sign in failed', friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password ────────────────────────────────────────────────────────
  async function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert('Enter email', 'Please enter your email address first.');
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      Alert.alert('Email sent', `Password reset link sent to ${email.trim()}.`);
    } catch (e) {
      Alert.alert('Error', friendlyError(e.code));
    }
  }

  // ── Join family (kid/spouse) ───────────────────────────────────────────────
  async function handleJoin() {
    if (!joinName.trim()) return Alert.alert('Missing info', 'Enter your name.');
    if (!inviteCode.trim()) return Alert.alert('Missing info', 'Enter the invite code from Dad\'s app.');
    if (!joinEmail.trim()) return Alert.alert('Missing info', 'Enter your email address.');
    if (joinPassword.length < 8) return Alert.alert('Weak password', 'Password must be at least 8 characters.');
    setLoading(true);
    try {
      await createEmailAccount(joinEmail.trim(), joinPassword);
      // Determine next colorIndex based on existing members (simplified: use timestamp mod 5)
      const colorIndex = Date.now() % 5;
      await joinFamily(inviteCode.trim(), joinName.trim(), colorIndex);
    } catch (e) {
      Alert.alert('Join failed', friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  }

  // ── Guest / anonymous ─────────────────────────────────────────────────────
  async function handleGuest() {
    setLoading(true);
    try {
      await signInAnonymously();
    } catch (e) {
      Alert.alert('Error', 'Could not start a guest session. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoBlock}>
          <View style={styles.logoIcon}>
            <Ionicons name="car-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.logoText}>Dadboard</Text>
          <Text style={styles.logoSub}>The family pickup command centre</Text>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          <TabBtn label="I'm the Dad" icon="shield-outline" active={tab === 'parent'} onPress={() => setTab('parent')} />
          <TabBtn label="Join family" icon="people-outline" active={tab === 'join'} onPress={() => setTab('join')} />
          <TabBtn label="Try it free" icon="flash-outline" active={tab === 'guest'} onPress={() => setTab('guest')} />
        </View>

        {/* ── Parent tab ── */}
        {tab === 'parent' && !signInMode && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Set up your family</Text>
            <Text style={styles.formSub}>Create your account. Your kids join using your invite code.</Text>

            <Field label="Your name">
              <TextInput
                style={styles.input}
                placeholder="e.g. Dad, Marcus..."
                placeholderTextColor={colors.textTertiary}
                value={parentName}
                onChangeText={setParentName}
                autoCapitalize="words"
                textContentType="name"
                autoComplete="name"
              />
            </Field>
            <Field label="Email address">
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
              />
            </Field>
            <Field label="Password (min 8 characters)">
              <View style={styles.passRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Choose a strong password"
                  placeholderTextColor={colors.textTertiary}
                  value={createPassword}
                  onChangeText={setCreatePassword}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  textContentType="newPassword"
                  autoComplete="new-password"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(p => !p)}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </Field>

            <PrimaryBtn label="Create family account" onPress={handleCreateParent} loading={loading} />

            <TouchableOpacity style={styles.secondaryLink} onPress={() => { setSignInPassword(''); setSignInMode(true); }}>
              <Text style={styles.secondaryLinkText}>Already have an account? Sign in →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Sign-in mode (inside parent tab) ── */}
        {tab === 'parent' && signInMode && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Welcome back</Text>
            <Text style={styles.formSub}>Sign in to your Dadboard account.</Text>

            <Field label="Email address">
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <TextInput
                style={styles.input}
                placeholder="Your password"
                placeholderTextColor={colors.textTertiary}
                value={signInPassword}
                onChangeText={setSignInPassword}
                secureTextEntry
                autoCapitalize="none"
                textContentType="password"
                autoComplete="password"
              />
            </Field>

            <PrimaryBtn label="Sign in" onPress={handleSignIn} loading={loading} />

            <TouchableOpacity style={styles.secondaryLink} onPress={handleForgotPassword}>
              <Text style={styles.secondaryLinkText}>Forgot password? Send reset email →</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryLink} onPress={() => setSignInMode(false)}>
              <Text style={[styles.secondaryLinkText, { color: colors.textTertiary }]}>← Create a new account</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Join tab ── */}
        {tab === 'join' && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Join your family</Text>
            {initialInviteCode ? (
              <>
                <Text style={styles.formSub}>Invite link detected. Create your account to join.</Text>
                <View style={styles.detectedCodeBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={styles.detectedCodeText}>Invite code: {initialInviteCode}</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.formSub}>Ask Dad for the invite link or code (Settings → Invite).</Text>
                <Field label="Invite code from Dad">
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="Paste code here"
                    placeholderTextColor={colors.textTertiary}
                    value={inviteCode}
                    onChangeText={setInviteCode}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Field>
              </>
            )}

            <Field label="Your name">
              <TextInput
                style={styles.input}
                placeholder="e.g. Ethan, Mum..."
                placeholderTextColor={colors.textTertiary}
                value={joinName}
                onChangeText={setJoinName}
                autoCapitalize="words"
                textContentType="name"
                autoComplete="name"
              />
            </Field>
            <Field label="Your email">
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={colors.textTertiary}
                value={joinEmail}
                onChangeText={setJoinEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
              />
            </Field>
            <Field label="Password (min 8 characters)">
              <TextInput
                style={styles.input}
                placeholder="Choose a password"
                placeholderTextColor={colors.textTertiary}
                value={joinPassword}
                onChangeText={setJoinPassword}
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
                autoComplete="new-password"
              />
            </Field>

            <PrimaryBtn label="Join family" onPress={handleJoin} loading={loading} />
          </View>
        )}

        {/* ── Guest tab ── */}
        {tab === 'guest' && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Try Dadboard free</Text>
            <Text style={styles.formSub}>
              No account needed. Your data stays on this device only.{'\n\n'}
              You can upgrade to a full account later to sync across devices and invite family members.
            </Text>

            <View style={styles.guestFeatures}>
              <GuestFeatureRow icon="checkmark-circle-outline" text="Today's pickups dashboard" available />
              <GuestFeatureRow icon="checkmark-circle-outline" text="Shopping list" available />
              <GuestFeatureRow icon="checkmark-circle-outline" text="Family profiles (this device)" available />
              <GuestFeatureRow icon="close-circle-outline" text="Multi-device family sync" available={false} />
              <GuestFeatureRow icon="close-circle-outline" text="Kids on separate phones" available={false} />
              <GuestFeatureRow icon="close-circle-outline" text="Google Calendar export" available={false} />
            </View>

            <PrimaryBtn label="Start without account" onPress={handleGuest} loading={loading} color={colors.textSecondary} />

            <TouchableOpacity style={styles.secondaryLink} onPress={() => setTab('parent')}>
              <Text style={styles.secondaryLinkText}>Create a full account instead →</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.legalText}>
          By continuing you agree to our Privacy Policy (dadboard.app/privacy). Governed by Singapore PDPA + GDPR.
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TabBtn({ label, icon, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={active ? colors.primary : colors.textTertiary} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function PrimaryBtn({ label, onPress, loading, color }) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, { backgroundColor: color || colors.primary }, loading && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading
        ? <ActivityIndicator color={colors.white} size="small" />
        : <Text style={styles.primaryBtnText}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

function GuestFeatureRow({ icon, text, available }) {
  return (
    <View style={styles.guestRow}>
      <Ionicons
        name={icon}
        size={18}
        color={available ? colors.success : colors.textTertiary}
      />
      <Text style={[styles.guestRowText, !available && { color: colors.textTertiary }]}>{text}</Text>
    </View>
  );
}

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use': 'That email is already registered. Try signing in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/weak-password': 'Password must be at least 8 characters.',
    'auth/network-request-failed': 'No internet connection. Please try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  logoBlock: { alignItems: 'center', paddingTop: 64, paddingBottom: spacing.xl },
  logoIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  logoText: { fontSize: 32, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
  logoSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, padding: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.textTertiary },
  tabLabelActive: { color: colors.primaryDark },
  form: { gap: 0 },
  formTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  formSub: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  detectedCodeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.successLight || '#D1FAE5', borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.lg,
  },
  detectedCodeText: { ...typography.bodySmall, color: colors.success, fontWeight: '600', flex: 1 },
  field: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.textPrimary,
  },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyeBtn: {
    width: 44, height: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },
  codeInput: { fontFamily: 'monospace', letterSpacing: 1 },
  primaryBtn: {
    paddingVertical: 14, borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing.sm,
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  secondaryLink: { alignItems: 'center', padding: spacing.md },
  secondaryLinkText: { ...typography.bodySmall, color: colors.info },
  guestFeatures: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg,
  },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  guestRowText: { ...typography.bodySmall, color: colors.textPrimary },
  legalText: {
    ...typography.caption, color: colors.textTertiary,
    textAlign: 'center', marginTop: spacing.xl, lineHeight: 17,
  },
});
