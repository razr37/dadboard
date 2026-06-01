// src/screens/DadHomeScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { Avatar, StatusBadge, SectionHeader, EmptyState, formatTime } from '../components/UI';

const SETUP_KEY = 'dadboard_setup_complete';

function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function DadHomeScreen({ navigation }) {
  const { getTodayRequests, getPendingBuyRequests, updateRequestStatus, deleteRequest, family, requests } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [showSetup, setShowSetup] = useState(null); // null = loading, true/false = known

  // Step completion derived from live Firestore state
  const step2Done = family.length > 1;  // at least one member beyond Dad
  const step3Done = requests.length > 0; // at least one request received

  // Runs on every mount — DadHomeScreen remounts on sign-out/sign-in because
  // AppProvider (and the whole nav tree) is torn down and rebuilt by Root.
  // useEffect(fn, []) means "once per mount lifecycle", not "once forever".
  useEffect(() => {
    AsyncStorage.getItem(SETUP_KEY).then(val => {
      setShowSetup(val !== 'yes');
    });
  }, []);

  // Persist completion and hide wizard as soon as both steps are done,
  // regardless of whether showSetup was true or still null (loading).
  useEffect(() => {
    if (step2Done && step3Done && showSetup !== false) {
      AsyncStorage.setItem(SETUP_KEY, 'yes');
      setShowSetup(false);
    }
  }, [step2Done, step3Done, showSetup]);

  const pickups = getTodayRequests();
  const buyItems = getPendingBuyRequests();
  const otherItems = requests.filter(r => r.type === 'other' && (!r.status || r.status === 'pending'));
  const pendingCount = pickups.filter(p => p.status === 'pending').length;

  // Summary strip counts
  const todayStr = toLocalDateStr(new Date());
  const tomorrowStr = toLocalDateStr(new Date(Date.now() + 86400000));
  const next48hCount = requests.filter(
    r => r.type === 'pickup' &&
         (r.date === todayStr || r.date === tomorrowStr) &&
         r.status !== 'done'
  ).length;

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }

  function handleStatusCycle(req) {
    const next = req.status === 'pending' ? 'onway' : req.status === 'onway' ? 'done' : 'pending';
    updateRequestStatus(req.id, next);
  }

  function handleDelete(id) {
    Alert.alert('Remove request', 'Delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRequest(id) },
    ]);
  }

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dayLabel = today.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}, Dad</Text>
          <Text style={styles.dateLabel}>{dayLabel}</Text>
        </View>
        <View style={styles.headerRight}>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => navigation.navigate('SwitchUser')} style={styles.settingsBtn}>
            <Ionicons name="people-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* First-time setup wizard — show only when key not set AND at least one step still incomplete */}
        {showSetup === true && (!step2Done || !step3Done) && (
          <SetupWizard
            step2Done={step2Done}
            step3Done={step3Done}
            onInvite={() => navigation.navigate('Invite')}
          />
        )}

        {/* Summary strip */}
        <View style={styles.summaryStrip}>
          <TouchableOpacity
            style={styles.summaryItem}
            onPress={() => navigation.navigate('Schedule')}
            activeOpacity={0.65}
          >
            <Text style={styles.summaryNum}>{next48hCount}</Text>
            <View style={styles.summaryLabelRow}>
              <Text style={styles.summaryLabel}>Pickups</Text>
              <Ionicons name="chevron-forward" size={11} color={colors.textTertiary} />
            </View>
            <Text style={styles.summarySub}>next 48 hrs</Text>
          </TouchableOpacity>
          <View style={styles.summaryDivider} />
          <TouchableOpacity
            style={styles.summaryItem}
            onPress={() => navigation.navigate('Shopping')}
            activeOpacity={0.65}
          >
            <Text style={styles.summaryNum}>{buyItems.length}</Text>
            <View style={styles.summaryLabelRow}>
              <Text style={styles.summaryLabel}>Shopping</Text>
              <Ionicons name="chevron-forward" size={11} color={colors.textTertiary} />
            </View>
            <Text style={styles.summarySub}>items pending</Text>
          </TouchableOpacity>
        </View>

        {/* Today's pickups */}
        <SectionHeader
          title={`Today's pickups`}
          action="Full schedule"
          onAction={() => navigation.navigate('Schedule')}
        />

        {pickups.length === 0 ? (
          <EmptyState icon="🚗" title="All clear today" subtitle="No pickups scheduled. Enjoy your day!" />
        ) : (
          pickups.map(req => (
            <PickupCard
              key={req.id}
              req={req}
              onStatusPress={() => handleStatusCycle(req)}
              onLongPress={() => handleDelete(req.id)}
            />
          ))
        )}

        {/* Buy requests */}
        <SectionHeader
          title="Shopping requests"
          action="See all"
          onAction={() => navigation.navigate('Shopping')}
        />

        {buyItems.length === 0 ? (
          <EmptyState icon="🛒" title="Nothing to buy" subtitle="No pending shopping requests." />
        ) : (
          buyItems.slice(0, 3).map(req => (
            <BuyCard
              key={req.id}
              req={req}
              onDone={() => updateRequestStatus(req.id, 'done')}
              onDelete={() => handleDelete(req.id)}
            />
          ))
        )}

        {/* Other requests — only rendered when there are pending items */}
        {otherItems.length > 0 && (
          <>
            <SectionHeader title="Other requests" />
            {otherItems.map(req => (
              <OtherCard
                key={req.id}
                req={req}
                onDone={() => updateRequestStatus(req.id, 'done')}
              />
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ── Setup wizard ───────────────────────────────────────────────────────────────
function SetupWizard({ step2Done, step3Done, onInvite }) {
  const doneCount = 1 + (step2Done ? 1 : 0) + (step3Done ? 1 : 0);

  return (
    <View style={[styles.wizardCard, shadow.sm]}>
      <View style={styles.wizardHeader}>
        <Text style={styles.wizardTitle}>Getting started</Text>
        <View style={styles.wizardPill}>
          <Text style={styles.wizardPillText}>{doneCount} / 3</Text>
        </View>
      </View>

      {/* Step 1 — always done */}
      <WizardStep
        done
        label="You're set up as Dad"
        hint="Your dashboard is ready"
      />

      {/* Step 2 — invite family */}
      <WizardStep
        done={step2Done}
        label="Invite your family"
        hint="For family members on any phone — no app needed"
        onPress={step2Done ? undefined : onInvite}
      />

      {/* Step 3 — first request */}
      <WizardStep
        done={step3Done}
        label="Get your first request"
        hint={
          step3Done
            ? 'First request received!'
            : 'Ask a family member to send: "Pick up Ethan from school tomorrow 3pm"'
        }
        isLast
      />
    </View>
  );
}

function WizardStep({ done, label, hint, onPress, isLast }) {
  const Row = onPress ? TouchableOpacity : View;
  return (
    <Row
      style={[styles.wizardStep, !isLast && styles.wizardStepBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.wizardDot, done && styles.wizardDotDone]}>
        {done
          ? <Ionicons name="checkmark" size={13} color={colors.white} />
          : <View style={styles.wizardDotEmpty} />
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.wizardStepLabel, done && styles.wizardStepLabelDone]}>{label}</Text>
        <Text style={styles.wizardStepHint}>{hint}</Text>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      )}
    </Row>
  );
}

function PickupCard({ req, onStatusPress, onLongPress }) {
  const kidColor = colors.kids[req.colorIndex % 5];
  const isDone = req.status === 'done';

  return (
    <TouchableOpacity
      style={[styles.pickupCard, shadow.sm, isDone && styles.pickupCardDone]}
      onPress={onStatusPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {/* Left color bar */}
      <View style={[styles.colorBar, { backgroundColor: kidColor }]} />

      <View style={styles.pickupBody}>
        <View style={styles.pickupTop}>
          <Avatar name={req.fromName} colorIndex={req.colorIndex} size={32} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[styles.pickupName, isDone && styles.textDone]}>{req.fromName} · {req.activity}</Text>
            <View style={styles.pickupMeta}>
              <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
              <Text style={styles.metaText}>{req.location}</Text>
              {req.dropTo ? (
                <>
                  <Ionicons name="arrow-forward" size={12} color={colors.textTertiary} style={{ marginLeft: 6 }} />
                  <Text style={styles.metaText}>{req.dropTo}</Text>
                </>
              ) : null}
            </View>
            {req.note ? <Text style={styles.noteText}>{req.note}</Text> : null}
          </View>
          <View style={styles.pickupRight}>
            <Text style={[styles.timeText, { color: isDone ? colors.textTertiary : kidColor }]}>
              {formatTime(req.time)}
            </Text>
            <StatusBadge status={req.status} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function BuyCard({ req, onDone, onDelete }) {
  return (
    <View style={[styles.buyCard, shadow.sm]}>
      <Avatar name={req.fromName} colorIndex={req.colorIndex} size={30} />
      <View style={styles.buyBody}>
        <Text style={styles.buyItem}>{req.item}</Text>
        <Text style={styles.buyMeta}>{req.fromName} · {req.urgency}</Text>
        {req.note ? <Text style={styles.noteText}>{req.note}</Text> : null}
      </View>
      <TouchableOpacity style={styles.checkBtn} onPress={onDone}>
        <Ionicons name="checkmark" size={16} color={colors.success} />
      </TouchableOpacity>
    </View>
  );
}

function OtherCard({ req, onDone }) {
  const ts = req.createdAt
    ? new Date(req.createdAt).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })
    : '';
  return (
    <View style={[styles.buyCard, shadow.sm]}>
      <Avatar name={req.fromName} colorIndex={req.colorIndex} size={30} />
      <View style={styles.buyBody}>
        <Text style={styles.buyItem}>{req.message || req.rawMessage || '(no message)'}</Text>
        <Text style={styles.buyMeta}>{req.fromName}{ts ? ` · ${ts}` : ''}</Text>
      </View>
      <TouchableOpacity style={styles.checkBtn} onPress={onDone}>
        <Ionicons name="checkmark" size={16} color={colors.success} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg,
  },
  greeting: { ...typography.h2, color: colors.textPrimary },
  dateLabel: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    width: 22, height: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  settingsBtn: { padding: 6 },
  scroll: { paddingBottom: spacing.xl },
  wizardCard: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  wizardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.md,
  },
  wizardTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  wizardPill: {
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  wizardPillText: { fontSize: 11, fontWeight: '700', color: colors.primaryDark },
  wizardStep: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: spacing.md, paddingVertical: spacing.sm,
  },
  wizardStepBorder: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  wizardDot: {
    width: 24, height: 24, borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  wizardDotDone: { backgroundColor: colors.success },
  wizardDotEmpty: {
    width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.white,
  },
  wizardStepLabel: { ...typography.bodySmall, fontWeight: '600', color: colors.textPrimary },
  wizardStepLabelDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  wizardStepHint: { ...typography.caption, color: colors.textSecondary, marginTop: 1, lineHeight: 16 },
  summaryStrip: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.sm,
    marginBottom: spacing.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  summaryLabel: { ...typography.caption, color: colors.textSecondary },
  summarySub: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  pickupCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  pickupCardDone: { opacity: 0.55 },
  colorBar: { width: 4 },
  pickupBody: { flex: 1, padding: spacing.md },
  pickupTop: { flexDirection: 'row', alignItems: 'flex-start' },
  pickupName: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  textDone: { textDecorationLine: 'line-through', color: colors.textTertiary },
  pickupMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3, flexWrap: 'wrap' },
  metaText: { ...typography.caption, color: colors.textTertiary, marginLeft: 2 },
  noteText: { ...typography.caption, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  pickupRight: { alignItems: 'flex-end', gap: 4 },
  timeText: { fontSize: 14, fontWeight: '700' },
  buyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  buyBody: { flex: 1 },
  buyItem: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  buyMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  checkBtn: {
    width: 32, height: 32,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
});
