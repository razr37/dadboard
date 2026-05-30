// src/screens/MealsScreen.js — Dad's weekly meal plan summary
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { Avatar, EmptyState } from '../components/UI';

const DAY_NAMES_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function shiftWeek(weekStart, delta) {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().split('T')[0];
}

function formatWeekRange(weekStart) {
  const days = getWeekDays(weekStart);
  const s = new Date(days[0] + 'T00:00:00');
  const e = new Date(days[6] + 'T00:00:00');
  return `${s.getDate()} ${MONTH_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTH_SHORT[e.getMonth()]}`;
}

export default function MealsScreen() {
  const { family, mealPlans } = useApp();
  const [weekStart, setWeekStart] = useState(getWeekStart());

  const todayStr = new Date().toISOString().split('T')[0];
  const weekDays = getWeekDays(weekStart);
  const isCurrentWeek = weekStart === getWeekStart();

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
        <Text style={styles.title}>Meals</Text>

        <View style={styles.weekNav}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setWeekStart(w => shiftWeek(w, -1))}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.weekLabel}>{formatWeekRange(weekStart)}</Text>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setWeekStart(w => shiftWeek(w, 1))}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {!isCurrentWeek && (
          <TouchableOpacity onPress={() => setWeekStart(getWeekStart())} style={styles.todayLink}>
            <Text style={styles.todayLinkText}>Back to this week</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!hasAnyPlans ? (
          <EmptyState
            icon="🍽️"
            title="No meal plans yet"
            subtitle="Family members can set their weekly plans from the home screen."
          />
        ) : (
          weekDays.map((date, i) => {
            const lunchMembers = getMembersForMeal(date, 'lunch');
            const dinnerMembers = getMembersForMeal(date, 'dinner');
            const hasPlans = lunchMembers.length > 0 || dinnerMembers.length > 0;
            const isToday = date === todayStr;
            const d = new Date(date + 'T00:00:00');

            return (
              <View key={date} style={[styles.dayCard, shadow.sm, !hasPlans && styles.dayCardEmpty]}>
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

                {hasPlans ? (
                  <>
                    {lunchMembers.length > 0 && (
                      <MealRow
                        icon="sunny-outline"
                        label="Lunch"
                        members={lunchMembers}
                        color={colors.warning}
                      />
                    )}
                    {dinnerMembers.length > 0 && (
                      <MealRow
                        icon="moon-outline"
                        label="Dinner"
                        members={dinnerMembers}
                        color={colors.info}
                      />
                    )}
                  </>
                ) : (
                  <Text style={styles.noPlans}>No plans set</Text>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function MealRow({ icon, label, members, color }) {
  return (
    <View style={styles.mealRow}>
      <View style={styles.mealRowHead}>
        <Ionicons name={icon} size={13} color={color} />
        <Text style={[styles.mealLabel, { color }]}>{label}</Text>
        <Text style={styles.mealCount}>({members.length})</Text>
      </View>
      <View style={styles.memberList}>
        {members.map(m => (
          <View key={m.id} style={styles.memberChip}>
            <Avatar name={m.name} colorIndex={m.colorIndex} size={22} />
            <Text style={styles.memberName}>{m.name}</Text>
          </View>
        ))}
      </View>
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
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.md },
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
    flex: 1,
    textAlign: 'center',
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  todayLink: { alignSelf: 'center', marginTop: spacing.sm },
  todayLinkText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  scroll: { paddingTop: spacing.sm },
  dayCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  dayCardEmpty: { opacity: 0.45 },
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
  noPlans: { ...typography.bodySmall, color: colors.textTertiary, fontStyle: 'italic' },
  mealRow: { marginBottom: spacing.xs },
  mealRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  mealLabel: { ...typography.label, fontWeight: '600' },
  mealCount: { ...typography.caption, color: colors.textTertiary },
  memberList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
  },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  memberName: { ...typography.bodySmall, color: colors.textSecondary },
});
