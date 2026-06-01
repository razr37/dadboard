// src/screens/KidHomeScreen.js
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { startOfWeek, addDays } from 'date-fns';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { Avatar, StatusBadge, EmptyState, PrimaryButton, formatTime, formatDate } from '../components/UI';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// toISOString() returns UTC, which shifts the date back on UTC+ devices (e.g. SGT = UTC+8).
// Always derive date strings from local year/month/day parts.
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekStart(date = new Date()) {
  return toLocalDateStr(startOfWeek(date, { weekStartsOn: 1 }));
}

function getWeekDays(weekStart) {
  const base = new Date(weekStart + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => toLocalDateStr(addDays(base, i)));
}

export default function KidHomeScreen({ navigation }) {
  const { currentUser, requests } = useApp();

  const myRequests = requests
    .filter(r => r.fromId === currentUser?.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  const pending = myRequests.filter(r => r.status !== 'done');
  const done = myRequests.filter(r => r.status === 'done');
  // colorIndex can be undefined (new kid) or -1 (parent default) — both are unsafe
  // for array indexing. ?? 0 catches undefined/null; Math.max ensures no negatives.
  const safeIndex = Math.max(0, currentUser?.colorIndex ?? 0) % 5;
  const kidColor      = colors.kids[safeIndex]      || colors.primary;
  const kidColorLight = colors.kidsLight[safeIndex] || colors.primaryLight;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: kidColorLight }]}>
        <View style={styles.headerTop}>
          <Avatar name={currentUser?.name ?? ''} colorIndex={safeIndex} size={44} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.greeting}>Hi {currentUser?.name ?? 'there'}!</Text>
            <Text style={styles.greetingSub}>Send a request to Dad</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('SwitchUser')} style={styles.switchBtn}>
            <Ionicons name="swap-horizontal-outline" size={18} color={kidColor} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.bigAddBtn, { backgroundColor: kidColor }]}
          onPress={() => navigation.navigate('AddRequest')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.bigAddText}>New request</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Quick actions */}
        <View style={styles.quickRow}>
          <QuickBtn
            icon="car-outline"
            label="Pickup"
            color={kidColor}
            onPress={() => navigation.navigate('AddRequest', { defaultType: 'pickup' })}
          />
          <QuickBtn
            icon="bag-outline"
            label="Buy item"
            color={kidColor}
            onPress={() => navigation.navigate('AddRequest', { defaultType: 'buy' })}
          />
          <QuickBtn
            icon="chatbubble-outline"
            label="Other"
            color={kidColor}
            onPress={() => navigation.navigate('AddRequest', { defaultType: 'other' })}
          />
        </View>

        {/* Meals this week */}
        <Text style={styles.sectionLabel}>MEALS THIS WEEK</Text>
        <MealsThisWeek memberId={currentUser?.id} kidColor={kidColor} />

        {myRequests.length === 0 ? (
          <EmptyState icon="✉️" title="No requests yet" subtitle="Tap 'New request' to ask Dad for a pickup or anything else." />
        ) : (
          <>
            {pending.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>PENDING ({pending.length})</Text>
                {pending.map(req => <MyRequestCard key={req.id} req={req} kidColor={kidColor} />)}
              </>
            )}
            {done.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>DONE</Text>
                {done.slice(0, 5).map(req => <MyRequestCard key={req.id} req={req} kidColor={kidColor} isDone />)}
              </>
            )}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function QuickBtn({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.quickBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.quickIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function MealsThisWeek({ memberId, kidColor }) {
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, 1 = next week

  const baseWeek  = getWeekStart();
  const weekStart = weekOffset === 0 ? baseWeek : toLocalDateStr(addDays(new Date(baseWeek + 'T00:00:00'), 7));
  const weekDays  = getWeekDays(weekStart);
  const todayStr  = toLocalDateStr(new Date());

  return (
    <View style={styles.mealSection}>
      {/* Week switcher */}
      <View style={[styles.mealWeekNav, { borderColor: kidColor + '40' }]}>
        <TouchableOpacity
          onPress={() => setWeekOffset(0)}
          disabled={weekOffset === 0}
          style={styles.mealWeekBtn}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={16}
            color={weekOffset === 0 ? colors.border : kidColor}
          />
        </TouchableOpacity>

        <Text style={[styles.mealWeekLabel, { color: kidColor }]}>
          {weekOffset === 0 ? 'This week' : 'Next week'}
        </Text>

        <TouchableOpacity
          onPress={() => setWeekOffset(1)}
          disabled={weekOffset === 1}
          style={styles.mealWeekBtn}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-forward"
            size={16}
            color={weekOffset === 1 ? colors.border : kidColor}
          />
        </TouchableOpacity>
      </View>

      {/* Meal grid */}
      <View style={[styles.mealCard, shadow.sm]}>
        {weekDays.map((date, i) => (
          <MealDayRow
            key={date}
            date={date}
            dayName={DAY_NAMES[i]}
            memberId={memberId}
            weekStart={weekStart}
            kidColor={kidColor}
            isToday={date === todayStr}
            isLast={i === 6}
          />
        ))}
      </View>
    </View>
  );
}

function MealDayRow({ date, dayName, memberId, weekStart, kidColor, isToday, isLast }) {
  const { mealPlans, setMealDay } = useApp();
  const dayData = mealPlans[memberId]?.[weekStart]?.[date] || { lunch: false, dinner: false };
  const d = new Date(date + 'T00:00:00');

  function toggle(meal) {
    setMealDay(memberId, date, { ...dayData, [meal]: !dayData[meal] });
  }

  return (
    <View style={[
      styles.mealDayRow,
      isToday && { backgroundColor: kidColor + '0D' },
      !isLast && styles.mealDayRowBorder,
    ]}>
      <View style={styles.mealDayLabel}>
        <Text style={[styles.mealDayName, isToday && { color: kidColor, fontWeight: '700' }]}>
          {dayName}
        </Text>
        <Text style={styles.mealDayNum}>{d.getDate()}</Text>
      </View>
      <View style={styles.mealToggleRow}>
        <MealToggle label="Lunch" active={dayData.lunch} color={kidColor} onPress={() => toggle('lunch')} />
        <MealToggle label="Dinner" active={dayData.dinner} color={kidColor} onPress={() => toggle('dinner')} />
      </View>
    </View>
  );
}

function MealToggle({ label, active, color, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.mealToggle,
        active ? { backgroundColor: color, borderColor: color } : { borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.mealToggleText, { color: active ? colors.white : colors.textTertiary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MyRequestCard({ req, kidColor, isDone }) {
  const isPickup = req.type === 'pickup';
  const isBuy = req.type === 'buy';
  return (
    <View style={[styles.reqCard, shadow.sm, isDone && styles.reqCardDone]}>
      <View style={[styles.reqIcon, { backgroundColor: kidColor + '18' }]}>
        <Ionicons
          name={isPickup ? 'car-outline' : isBuy ? 'bag-outline' : 'chatbubble-outline'}
          size={18} color={isDone ? colors.textTertiary : kidColor}
        />
      </View>
      <View style={styles.reqBody}>
        <Text style={[styles.reqTitle, isDone && styles.textDone]}>
          {isPickup ? req.activity : isBuy ? req.item : req.message}
        </Text>
        <Text style={styles.reqMeta}>
          {isPickup ? `${formatDate(req.date)} · ${formatTime(req.time)} · ${req.location}` : isBuy ? req.urgency : req.urgency}
        </Text>
      </View>
      <StatusBadge status={req.status} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.xl },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { ...typography.h2, color: colors.textPrimary },
  greetingSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  switchBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    ...shadow.sm,
  },
  bigAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 14, borderRadius: radius.md,
  },
  bigAddText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  scroll: { paddingTop: spacing.lg },
  quickRow: {
    flexDirection: 'row', gap: spacing.md,
    paddingHorizontal: spacing.lg, marginBottom: spacing.lg,
  },
  quickBtn: { flex: 1, alignItems: 'center', gap: spacing.sm },
  quickIcon: {
    width: 52, height: 52, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '500' },
  sectionLabel: {
    ...typography.label, color: colors.textTertiary,
    paddingHorizontal: spacing.lg, marginBottom: spacing.sm, marginTop: spacing.sm,
  },
  reqCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.md,
  },
  reqCardDone: { opacity: 0.55 },
  reqIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  reqBody: { flex: 1 },
  reqTitle: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  textDone: { textDecorationLine: 'line-through', color: colors.textTertiary },
  reqMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  mealSection: {
    marginBottom: spacing.lg,
  },
  mealWeekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mealWeekBtn: { padding: spacing.sm },
  mealWeekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  mealCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  mealDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mealDayRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mealDayLabel: { width: 44 },
  mealDayName: { ...typography.label, color: colors.textSecondary },
  mealDayNum: { ...typography.caption, color: colors.textTertiary },
  mealToggleRow: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  mealToggle: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  mealToggleText: { fontSize: 12, fontWeight: '600' },
});
