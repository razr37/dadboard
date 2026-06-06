// src/screens/ScheduleScreen.js
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { Avatar, StatusBadge, SectionHeader, EmptyState, formatTime, formatDate } from '../components/UI';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';

export default function ScheduleScreen({ navigation }) {
  const { requests, updateRequestStatus } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Build 7-day strip starting from today
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 1));

  const pickupsForDay = requests.filter(r => {
    if (r.type !== 'pickup') return false;
    const reqDate = new Date(r.date + 'T00:00:00');
    return isSameDay(reqDate, selectedDate);
  }).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddRequest')} style={styles.addBtn}>
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Day selector */}
      <View style={styles.dayStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
          {days.map((day, i) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, today);
            const hasEvents = requests.some(r => r.type === 'pickup' && isSameDay(new Date(r.date + 'T00:00:00'), day));
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dayBtn, isSelected && styles.dayBtnActive]}
                onPress={() => setSelectedDate(day)}
              >
                <Text style={[styles.dayName, isSelected && styles.dayTextActive]}>
                  {format(day, 'EEE')}
                </Text>
                <Text style={[styles.dayNum, isSelected && styles.dayTextActive]}>
                  {format(day, 'd')}
                </Text>
                {hasEvents && <View style={[styles.dot, isSelected && styles.dotActive]} />}
                {isToday && !isSelected && <Text style={styles.todayLabel}>Today</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.dateHeading}>
          {isSameDay(selectedDate, today) ? 'Today' : format(selectedDate, 'EEEE, d MMM')}
        </Text>

        {pickupsForDay.length === 0 ? (
          <EmptyState icon="📅" title="Nothing scheduled" subtitle="Tap + to add a pickup for this day" />
        ) : (
          pickupsForDay.map(req => (
            <ScheduleCard key={req.id} req={req} onStatusChange={(s) => updateRequestStatus(req.id, s)} />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function ScheduleCard({ req, onStatusChange }) {
  const kidColor = colors.kids[req.colorIndex % 5];
  return (
    <View style={[styles.card, shadow.sm]}>
      <View style={[styles.timeCol, { borderRightColor: kidColor }]}>
        <Text style={[styles.cardTime, { color: kidColor }]}>{formatTime(req.time)}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Avatar name={req.fromName} colorIndex={req.colorIndex} size={28} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.cardTitle}>{req.activity}</Text>
            <Text style={styles.cardSub}>{req.fromName}</Text>
          </View>
          <StatusBadge status={req.status} />
        </View>
        <View style={styles.cardRoute}>
          <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
          <Text style={styles.routeText}>{req.from || req.location || 'Home'}</Text>
          <Ionicons name="arrow-forward-outline" size={13} color={colors.textTertiary} style={{ marginLeft: 8 }} />
          <Text style={styles.routeText}>{req.to || req.location || ''}</Text>
          <Text style={styles.routeText}>{req.dropTo || 'Home'}</Text>
        </View>
        {req.note ? <Text style={styles.noteText}>{req.note}</Text> : null}
        <View style={styles.actions}>
          {req.status === 'pending' && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.infoLight }]} onPress={() => onStatusChange('onway')}>
              <Text style={[styles.actionText, { color: colors.info }]}>On my way</Text>
            </TouchableOpacity>
          )}
          {req.status === 'onway' && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.successLight }]} onPress={() => onStatusChange('done')}>
              <Text style={[styles.actionText, { color: colors.success }]}>Mark done</Text>
            </TouchableOpacity>
          )}
          {req.status === 'done' && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.muted }]} onPress={() => onStatusChange('pending')}>
              <Text style={[styles.actionText, { color: colors.textSecondary }]}>Undo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  addBtn: { padding: 6, backgroundColor: colors.primaryLight, borderRadius: radius.full },
  dayStrip: { backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border },
  dayScroll: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  dayBtn: {
    alignItems: 'center', width: 52, paddingVertical: spacing.sm,
    borderRadius: radius.md, gap: 2,
  },
  dayBtnActive: { backgroundColor: colors.primary },
  dayName: { ...typography.caption, color: colors.textSecondary },
  dayNum: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  dayTextActive: { color: colors.white },
  dot: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: colors.primary, marginTop: 2 },
  dotActive: { backgroundColor: colors.white },
  todayLabel: { fontSize: 9, color: colors.primary, fontWeight: '600' },
  scroll: { paddingTop: spacing.md },
  dateHeading: { ...typography.h3, color: colors.textPrimary, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  card: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    borderRadius: radius.lg, marginHorizontal: spacing.lg, marginBottom: spacing.md, overflow: 'hidden',
  },
  timeCol: {
    width: 72, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 2, paddingVertical: spacing.lg,
  },
  cardTime: { fontSize: 14, fontWeight: '700' },
  cardBody: { flex: 1, padding: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  cardSub: { ...typography.caption, color: colors.textSecondary },
  cardRoute: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  routeText: { ...typography.caption, color: colors.textTertiary },
  noteText: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full },
  actionText: { fontSize: 12, fontWeight: '600' },
});
