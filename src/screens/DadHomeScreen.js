// src/screens/DadHomeScreen.js
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { Avatar, StatusBadge, SectionHeader, EmptyState, Card, formatTime, formatDate } from '../components/UI';

export default function DadHomeScreen({ navigation }) {
  const { getTodayRequests, getPendingBuyRequests, updateRequestStatus, deleteRequest, family } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const pickups = getTodayRequests();
  const buyItems = getPendingBuyRequests();
  const pendingCount = pickups.filter(p => p.status === 'pending').length;

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
        {/* Summary strip */}
        <View style={styles.summaryStrip}>
          <TouchableOpacity
            style={styles.summaryItem}
            onPress={() => navigation.navigate('Schedule')}
            activeOpacity={0.65}
          >
            <Text style={styles.summaryNum}>{pickups.filter(p => p.status !== 'done').length}</Text>
            <Text style={styles.summaryLabel}>Pickups left</Text>
            <Ionicons name="chevron-forward" size={11} color={colors.textTertiary} style={{ marginTop: 3 }} />
          </TouchableOpacity>
          <View style={styles.summaryDivider} />
          <TouchableOpacity
            style={styles.summaryItem}
            onPress={() => navigation.navigate('Shopping')}
            activeOpacity={0.65}
          >
            <Text style={styles.summaryNum}>{buyItems.length}</Text>
            <Text style={styles.summaryLabel}>Buy requests</Text>
            <Ionicons name="chevron-forward" size={11} color={colors.textTertiary} style={{ marginTop: 3 }} />
          </TouchableOpacity>
          <View style={styles.summaryDivider} />
          <TouchableOpacity
            style={styles.summaryItem}
            onPress={() => navigation.navigate('SwitchUser')}
            activeOpacity={0.65}
          >
            <Text style={styles.summaryNum}>{family.filter(f => f.role === 'kid').length}</Text>
            <Text style={styles.summaryLabel}>Kids</Text>
            <Ionicons name="chevron-forward" size={11} color={colors.textTertiary} style={{ marginTop: 3 }} />
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

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
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
  summaryLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
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
