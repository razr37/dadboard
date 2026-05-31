// src/screens/MealsScreen.js — Dad's weekly meal plan summary
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { startOfWeek, addDays } from 'date-fns';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { Avatar, EmptyState } from '../components/UI';

const DAY_NAMES_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// toISOString() returns UTC, which shifts the date back on UTC+ devices (e.g. SGT = UTC+8).
// Always format dates from local year/month/day parts instead.
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

function shiftWeek(weekStart, delta) {
  return toLocalDateStr(addDays(new Date(weekStart + 'T00:00:00'), delta * 7));
}

function formatWeekRange(weekStart) {
  const days = getWeekDays(weekStart);
  const s = new Date(days[0] + 'T00:00:00');
  const e = new Date(days[6] + 'T00:00:00');
  return `${s.getDate()} ${MONTH_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTH_SHORT[e.getMonth()]}`;
}

export default function MealsScreen({ navigation }) {
  const { family, mealPlans } = useApp();
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, 1 = next week

  const baseWeek   = getWeekStart();
  const weekStart  = weekOffset === 0 ? baseWeek : shiftWeek(baseWeek, 1);
  const todayStr   = toLocalDateStr(new Date());
  const weekDays   = getWeekDays(weekStart);

  function getMembersForMeal(date, meal) {
    return family.filter(m => mealPlans[m.id]?.[weekStart]?.[date]?.[meal] === true);
  }

  const hasAnyPlans = weekDays.some(date =>
    family.some(m => {
      const day = mealPlans[m.id]?.[weekStart]?.[date];
      return day?.lunch || day?.dinner;
    })
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Meals</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddRequest', { defaultType: 'meal' })}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekNav}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={weekOffset === 0 ? colors.border : colors.textSecondary}
            />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.weekLabel}>
              {weekOffset === 0 ? 'This week' : 'Next week'}
            </Text>
            <Text style={styles.weekDateRange}>{formatWeekRange(weekStart)}</Text>
          </View>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setWeekOffset(1)}
            disabled={weekOffset === 1}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={weekOffset === 1 ? colors.border : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!hasAnyPlans && (
          <EmptyState
            icon="🍽️"
            title="No meal plans yet"
            subtitle="Family members can set their weekly plans from the home screen."
          />
        )}

        {weekDays.map((date, i) => {
          const lunchMembers  = getMembersForMeal(date, 'lunch');
          const dinnerMembers = getMembersForMeal(date, 'dinner');
          const isToday = date === todayStr;
          const d = new Date(date + 'T00:00:00');

          return (
            <View key={date} style={[styles.dayCard, shadow.sm, isToday && styles.dayCardToday]}>
              <View style={styles.dayHeader}>
                <View style={styles.dayLabelRow}>
                  <Text style={[styles.dayName, isToday && { color: colors.primary }]}>
                    {DAY_NAMES_LONG[i]}
                  </Text>
                  <Text style={styles.dayDate}>
                    {d.getDate()} {MONTH_SHORT[d.getMonth()]}
                  </Text>
                </View>
                {isToday && (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayBadgeText}>Today</Text>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              <MealRow
                icon="sunny-outline"
                label="Lunch"
                color={colors.warning}
                eatingIn={lunchMembers}
                allMembers={family}
              />
              <MealRow
                icon="moon-outline"
                label="Dinner"
                color={colors.info}
                eatingIn={dinnerMembers}
                allMembers={family}
              />
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function MealRow({ icon, label, color, eatingIn, allMembers }) {
  const count = eatingIn.length;
  const total = allMembers.length;
  const countLabel = count === 0
    ? 'No plans'
    : count === total
      ? 'All eating in'
      : `${count}/${total} eating in`;

  return (
    <View style={styles.mealRow}>
      <View style={styles.mealLabel}>
        <Ionicons name={icon} size={13} color={color} />
        <Text style={[styles.mealLabelText, { color }]}>{label}</Text>
      </View>

      <View style={styles.avatarRow}>
        {allMembers.map(m => {
          const isEating = eatingIn.some(em => em.id === m.id);
          if (isEating) {
            return <Avatar key={m.id} name={m.name} colorIndex={m.colorIndex} size={28} />;
          }
          return (
            <View key={m.id} style={styles.ghostAvatar}>
              <Text style={styles.ghostInitial}>{m.name[0].toUpperCase()}</Text>
            </View>
          );
        })}
      </View>

      <Text style={[styles.countLabel, count === 0 && styles.countLabelEmpty]}>
        {countLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  addBtn: { padding: 6, backgroundColor: colors.primaryLight, borderRadius: radius.full },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  navBtn: { padding: spacing.md },
  weekLabel: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  weekDateRange: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 1,
  },
  scroll: { paddingTop: spacing.sm },

  // Day card
  dayCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayCardToday: {
    borderColor: colors.primary + '40',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dayLabelRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  dayName: { ...typography.h3, color: colors.textPrimary },
  dayDate: { ...typography.bodySmall, color: colors.textSecondary },
  todayBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  todayBadgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },

  // Meal row: [icon+label] [avatars...] [count]
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  mealLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  mealLabelText: { fontSize: 12, fontWeight: '600' },
  avatarRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  ghostAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },
  ghostInitial: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  countLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    minWidth: 72,
    textAlign: 'right',
  },
  countLabelEmpty: {
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
});
