// src/screens/AuthScreen.js
// Dadboard — auth screen for Dad only.
//
// Kids and spouse join via magic link (WhatsApp invite from SwitchUserScreen).
// This screen handles two flows:
//   1. "Set up as Dad / Parent" — creates email account + new family
//   2. "Sign in" — email + password for returning Dad

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  signInWithEmail, createEmailAccount, createFamily, sendPasswordReset, signInWithGoogle,
} from '../utils/firebase';
import { colors, spacing, radius, typography } from '../utils/theme';
import { ClearableInput } from '../components/UI';

export default function AuthScreen() {
  const [screen, setScreen] = useState('welcome');
  const [loading, setLoading] = useState(false);

  // 2A — parent / create
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // 2B — sign in
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // ── Create parent account ──────────────────────────────────────────────────
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

  // ── Sign in ────────────────────────────────────────────────────────────────
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

  // ── Google sign-in ─────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result) return; // user cancelled the Google picker
      if (result.isNewUser) {
        const displayName = result.user.displayName || 'Dad';
        try {
          await createFamily(displayName);
        } catch (e) {
          console.error('[AuthScreen] createFamily (Google) failed:', e.code, e.message);
          Alert.alert(
            'Family setup failed',
            `Google sign-in worked but family creation failed: ${e.message || e.code}\n\nPlease sign in again to retry.`
          );
        }
      }
      // Existing users: AppContext loads their family via onAuthStateChanged automatically
    } catch (e) {
      Alert.alert('Google sign-in failed', e.message || 'Something went wrong. Please try again.');
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

        {/* ── Welcome ── */}
        {screen === 'welcome' && (
          <View style={styles.cards}>
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
            <Text style={styles.joinHint}>
              Kids and family members join via invite link — ask Dad to add you from the app.
            </Text>
          </View>
        )}

        {/* ── Set up as Dad ── */}
        {screen === 'parent' && (
          <View style={styles.form}>
            <BackBtn onPress={() => setScreen('welcome')} />
            <Text style={styles.formTitle}>Set up as Dad / Parent</Text>
            <Text style={styles.formSub}>Your family joins later using an invite link you share from the app.</Text>

            <GoogleBtn onPress={handleGoogleSignIn} loading={loading} />
            <Divider />

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

        {/* ── Sign in ── */}
        {screen === 'signin' && (
          <View style={styles.form}>
            <BackBtn onPress={() => setScreen('welcome')} />
            <Text style={styles.formTitle}>Welcome back</Text>
            <Text style={styles.formSub}>Sign in to your Dadboard account.</Text>

            <GoogleBtn onPress={handleGoogleSignIn} loading={loading} />
            <Divider />

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

function GoogleBtn({ onPress, loading }) {
  return (
    <TouchableOpacity
      style={[styles.googleBtn, loading && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading
        ? <ActivityIndicator color={colors.textPrimary} size="small" />
        : <>
            <Ionicons name="logo-google" size={18} color="#4285F4" />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </>
      }
    </TouchableOpacity>
  );
}

function Divider() {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or continue with email</Text>
      <View style={styles.dividerLine} />
    </View>
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
    'auth/email-already-in-use':   'That email is already registered. Try signing in instead.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/invalid-credential':     'Incorrect email or password.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/user-not-found':         'No account found with that email.',
    'auth/weak-password':          'Password must be at least 8 characters.',
    'auth/network-request-failed': 'No internet connection. Please try again.',
    'auth/too-many-requests':      'Too many attempts. Please wait a few minutes.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── Styles ───────────────────────────────────────────────────────────────────

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

  joinHint: {
    ...typography.caption, color: colors.textTertiary,
    textAlign: 'center', lineHeight: 18,
    marginTop: spacing.md, paddingHorizontal: spacing.md,
  },

  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    alignSelf: 'flex-start', marginBottom: spacing.lg,
  },
  backBtnText: { ...typography.bodySmall, color: colors.textSecondary },

  form: { gap: 0 },
  formTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  formSub: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },

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

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 13,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.bgCard, marginBottom: spacing.sm,
  },
  googleBtnText: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  divider: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, marginBottom: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textTertiary },

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
