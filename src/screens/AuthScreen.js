// src/screens/AuthScreen.js
// Dadboard — intent-first auth flow.
//
// Screen 1 (welcome): three intent cards → routes to screen 2A / 2B / 2C
//   2A  join    — invite code + name + role + email + password
//   2B  parent  — name + email + password → creates family automatically
//   2C  signin  — email + password
//
// initialInviteCode prop (deep-link / QR): skips welcome and pre-fills join.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  signInAnonymously, signInWithEmail,
  createEmailAccount, joinFamily, createFamily, sendPasswordReset,
} from '../utils/firebase';
import { colors, spacing, radius, typography } from '../utils/theme';
import { ClearableInput } from '../components/UI';

export default function AuthScreen({ initialInviteCode }) {
  const [screen, setScreen] = useState(initialInviteCode ? 'join' : 'welcome');
  const [loading, setLoading] = useState(false);

  // 2A — join
  const [joinName, setJoinName] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInviteCode || '');
  const [joinRole, setJoinRole] = useState('kid');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  // 2B — parent / create
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // 2C — sign in
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // ── 2A: Join family ────────────────────────────────────────────────────────
  async function handleJoin() {
    if (!inviteCode.trim()) return Alert.alert('Missing info', "Enter the invite code from Dad's app.");
    if (!joinName.trim())   return Alert.alert('Missing info', 'Enter your name.');
    if (!joinEmail.trim())  return Alert.alert('Missing info', 'Enter your email address.');
    if (joinPassword.length < 8) return Alert.alert('Weak password', 'Password must be at least 8 characters.');
    setLoading(true);
    try {
      await createEmailAccount(joinEmail.trim(), joinPassword);
      await joinFamily(inviteCode.trim(), joinName.trim(), joinRole);
    } catch (e) {
      Alert.alert('Join failed', friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  }

  // ── 2B: Create parent account ──────────────────────────────────────────────
  async function handleCreateParent() {
    if (!parentName.trim())  return Alert.alert('Missing info', 'Please enter your name.');
    if (!parentEmail.trim()) return Alert.alert('Missing info', 'Please enter your email address.');
    if (createPassword.length < 8) return Alert.alert('Weak password', 'Password must be at least 8 characters.');
    setLoading(true);
    try {
      try {
        await createEmailAccount(parentEmail.trim(), createPassword);
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
                  setSignInEmail(parentEmail.trim());
                  setSignInPassword('');
                  setScreen('signin');
                },
              },
            ]
          );
        } else {
          Alert.alert('Sign up failed', friendlyError(e.code));
        }
        return;
      }
      try {
        await createFamily(parentName.trim());
      } catch (e) {
        console.error('[AuthScreen] createFamily failed:', e.code, e.message);
        Alert.alert(
          'Family setup failed',
          `Could not create family: ${e.message || e.code || String(e)}\n\nYour account was created. Please sign in to retry.`
        );
      }
    } finally {
      setLoading(false);
    }
  }

  // ── 2C: Sign in ────────────────────────────────────────────────────────────
  async function handleSignIn() {
    if (!signInEmail.trim() || !signInPassword) return Alert.alert('Missing info', 'Enter email and password.');
    setLoading(true);
    try {
      await signInWithEmail(signInEmail.trim(), signInPassword);
    } catch (e) {
      Alert.alert('Sign in failed', friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!signInEmail.trim()) return Alert.alert('Enter email', 'Please enter your email address first.');
    try {
      await sendPasswordReset(signInEmail.trim());
      Alert.alert('Email sent', `Password reset link sent to ${signInEmail.trim()}.`);
    } catch (e) {
      Alert.alert('Error', friendlyError(e.code));
    }
  }

  // ── Guest ──────────────────────────────────────────────────────────────────
  async function handleGuest() {
    setLoading(true);
    try {
      await signInAnonymously();
    } catch {
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

        <View style={styles.logoBlock}>
          <View style={styles.logoIcon}>
            <Ionicons name="car-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.logoText}>Dadboard</Text>
          <Text style={styles.logoSub}>The family pickup command centre</Text>
        </View>

        {/* ── Screen 1: Welcome ── */}
        {screen === 'welcome' && (
          <View style={styles.cards}>
            <IntentCard
              icon="ticket-outline"
              title="I have an invite code"
              sub="Join your family's Dadboard"
              onPress={() => setScreen('join')}
            />
            <IntentCard
              icon="person-outline"
              title="Set up as Dad / Parent"
              sub="Create a new family account"
              onPress={() => setScreen('parent')}
            />
            <IntentCard
              icon="key-outline"
              title="Sign in"
              sub="Already have an account"
              onPress={() => setScreen('signin')}
            />
            <TouchableOpacity style={styles.guestLink} onPress={handleGuest} disabled={loading}>
              {loading
                ? <ActivityIndicator size="small" color={colors.textTertiary} />
                : <Text style={styles.guestLinkText}>Try without account →</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── Screen 2A: Join family ── */}
        {screen === 'join' && (
          <View style={styles.form}>
            <BackBtn onPress={() => setScreen('welcome')} />
            <Text style={styles.formTitle}>Join your family</Text>

            {initialInviteCode ? (
              <View style={styles.detectedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.detectedBadgeText}>Invite code: {initialInviteCode}</Text>
              </View>
            ) : (
              <Field label="Invite code from Dad">
                <ClearableInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="e.g. X7K2M9PQ"
                  placeholderTextColor={colors.textTertiary}
                  value={inviteCode}
                  onChangeText={t => setInviteCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </Field>
            )}

            <Field label="Your name">
              <ClearableInput
                style={styles.input}
                placeholder="e.g. Ethan, Mum…"
                placeholderTextColor={colors.textTertiary}
                value={joinName}
                onChangeText={setJoinName}
                autoCapitalize="words"
                textContentType="name"
                autoComplete="name"
              />
            </Field>

            <Field label="I am a…">
              <View style={styles.roleRow}>
                {ROLES.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.roleBtn, joinRole === opt.value && styles.roleBtnActive]}
                    onPress={() => setJoinRole(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.roleBtnText, joinRole === opt.value && styles.roleBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            <Field label="Your email">
              <ClearableInput
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

        {/* ── Screen 2B: Set up as Dad / Parent ── */}
        {screen === 'parent' && (
          <View style={styles.form}>
            <BackBtn onPress={() => setScreen('welcome')} />
            <Text style={styles.formTitle}>Set up as Dad / Parent</Text>
            <Text style={styles.formSub}>Your kids join later using an invite code you share from the app.</Text>

            <Field label="Your name">
              <ClearableInput
                style={styles.input}
                placeholder="e.g. Dad, Marcus…"
                placeholderTextColor={colors.textTertiary}
                value={parentName}
                onChangeText={setParentName}
                autoCapitalize="words"
                textContentType="name"
                autoComplete="name"
              />
            </Field>

            <Field label="Email address">
              <ClearableInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={colors.textTertiary}
                value={parentEmail}
                onChangeText={setParentEmail}
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

            <TouchableOpacity
              style={styles.secondaryLink}
              onPress={() => { setSignInEmail(parentEmail); setSignInPassword(''); setScreen('signin'); }}
            >
              <Text style={styles.secondaryLinkText}>Already have an account? Sign in →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Screen 2C: Sign in ── */}
        {screen === 'signin' && (
          <View style={styles.form}>
            <BackBtn onPress={() => setScreen('welcome')} />
            <Text style={styles.formTitle}>Welcome back</Text>
            <Text style={styles.formSub}>Sign in to your Dadboard account.</Text>

            <Field label="Email address">
              <ClearableInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={colors.textTertiary}
                value={signInEmail}
                onChangeText={setSignInEmail}
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
          </View>
        )}

        <Text style={styles.legalText}>
          By continuing you agree to our Privacy Policy (razr37.github.io/dadboard/privacy/). Governed by Singapore PDPA + GDPR.
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'kid',    label: 'Kid' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'adult',  label: 'Other Adult' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function IntentCard({ icon, title, sub, onPress }) {
  return (
    <TouchableOpacity style={styles.intentCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.intentIconWrap}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.intentBody}>
        <Text style={styles.intentTitle}>{title}</Text>
        <Text style={styles.intentSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

function BackBtn({ onPress }) {
  return (
    <TouchableOpacity style={styles.backBtn} onPress={onPress}>
      <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
      <Text style={styles.backBtnText}>Back</Text>
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

function PrimaryBtn({ label, onPress, loading }) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
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

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use':  'That email is already registered. Try signing in instead.',
    'auth/invalid-email':         'Please enter a valid email address.',
    'auth/invalid-credential':    'Incorrect email or password.',
    'auth/wrong-password':        'Incorrect password. Please try again.',
    'auth/user-not-found':        'No account found with that email.',
    'auth/weak-password':         'Password must be at least 8 characters.',
    'auth/network-request-failed':'No internet connection. Please try again.',
    'auth/too-many-requests':     'Too many attempts. Please wait a few minutes.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  // Logo
  logoBlock: { alignItems: 'center', paddingTop: 64, paddingBottom: spacing.xl },
  logoIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  logoText: { fontSize: 32, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
  logoSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },

  // Intent cards
  cards: { gap: spacing.md },
  intentCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  intentIconWrap: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  intentBody: { flex: 1 },
  intentTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  intentSub: { ...typography.caption, color: colors.textSecondary },

  // Guest link
  guestLink: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  guestLinkText: { ...typography.bodySmall, color: colors.textTertiary },

  // Back button
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    alignSelf: 'flex-start', marginBottom: spacing.lg,
  },
  backBtnText: { ...typography.bodySmall, color: colors.textSecondary },

  // Forms
  form: { gap: 0 },
  formTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  formSub: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },

  // Detected invite code badge
  detectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.successLight, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.lg,
  },
  detectedBadgeText: { ...typography.bodySmall, color: colors.success, fontWeight: '600', flex: 1 },

  // Fields
  field: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.textPrimary,
  },
  codeInput: { fontFamily: 'monospace', letterSpacing: 2 },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyeBtn: {
    width: 44, height: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },

  // Role selector
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
    alignItems: 'center', backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  roleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  roleBtnTextActive: { color: colors.primaryDark },

  // Buttons
  primaryBtn: {
    backgroundColor: colors.primary, paddingVertical: 14,
    borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm,
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  secondaryLink: { alignItems: 'center', padding: spacing.md },
  secondaryLinkText: { ...typography.bodySmall, color: colors.info },

  legalText: {
    ...typography.caption, color: colors.textTertiary,
    textAlign: 'center', marginTop: spacing.xl, lineHeight: 17,
  },
});
