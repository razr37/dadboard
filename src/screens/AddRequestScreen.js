// src/screens/AddRequestScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { PrimaryButton, GhostButton, Avatar } from '../components/UI';

const REQUEST_TYPES = [
  { key: 'pickup', label: 'Pickup / Drop-off', icon: 'car-outline' },
  { key: 'buy', label: 'Buy something', icon: 'bag-outline' },
  { key: 'other', label: 'Other request', icon: 'chatbubble-outline' },
];

const URGENCY_OPTIONS = ['Today', 'This weekend', 'This week', 'No rush'];

const VALID_TYPES = new Set(REQUEST_TYPES.map(t => t.key));

export default function AddRequestScreen({ navigation, route }) {
  const { currentUser, addRequest } = useApp();
  const [type, setType] = useState(() => {
    const dt = route?.params?.defaultType;
    if (!dt) return 'pickup';
    // 'meal' and any other unknown types open as 'other' (closest match)
    return VALID_TYPES.has(dt) ? dt : 'other';
  });

  // Pickup fields
  const [activity, setActivity] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('15:00');
  const [location, setLocation] = useState('');
  const [dropTo, setDropTo] = useState('Home');
  const [note, setNote] = useState('');

  // Buy fields
  const [item, setItem] = useState('');
  const [urgency, setUrgency] = useState('This week');

  // Other fields
  const [message, setMessage] = useState('');

  function handleSubmit() {
    if (type === 'pickup') {
      if (!activity.trim() || !location.trim()) {
        Alert.alert('Missing info', 'Please fill in the activity and pickup location.');
        return;
      }
      addRequest({
        type: 'pickup',
        fromId: currentUser.id,
        fromName: currentUser.name,
        colorIndex: currentUser.colorIndex,
        activity: activity.trim(),
        date,
        time,
        location: location.trim(),
        dropTo: dropTo.trim() || 'Home',
        note: note.trim(),
      });
    } else if (type === 'buy') {
      if (!item.trim()) {
        Alert.alert('Missing info', 'Please describe what you need.');
        return;
      }
      addRequest({
        type: 'buy',
        fromId: currentUser.id,
        fromName: currentUser.name,
        colorIndex: currentUser.colorIndex,
        item: item.trim(),
        urgency,
        note: note.trim(),
      });
    } else {
      if (!message.trim()) {
        Alert.alert('Missing info', 'Please type your request.');
        return;
      }
      addRequest({
        type: 'other',
        fromId: currentUser.id,
        fromName: currentUser.name,
        colorIndex: currentUser.colorIndex,
        message: message.trim(),
        urgency,
      });
    }

    Alert.alert('Sent!', 'Dad has been notified.', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-down" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Avatar name={currentUser.name} colorIndex={currentUser.colorIndex} size={28} />
          <Text style={styles.headerTitle}>{currentUser.name}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>New request</Text>
        <Text style={styles.pageSubtitle}>What do you need Dad to do?</Text>

        {/* Type selector */}
        <View style={styles.typeRow}>
          {REQUEST_TYPES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeBtn, type === t.key && styles.typeBtnActive]}
              onPress={() => setType(t.key)}
            >
              <Ionicons name={t.icon} size={18} color={type === t.key ? colors.primary : colors.textSecondary} />
              <Text style={[styles.typeLabel, type === t.key && styles.typeLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pickup form */}
        {type === 'pickup' && (
          <View style={styles.form}>
            <Field label="Activity / Class name" required>
              <TextInput
                style={styles.input}
                placeholder="e.g. Maths tuition, Swimming..."
                placeholderTextColor={colors.textTertiary}
                value={activity}
                onChangeText={setActivity}
              />
            </Field>

            <View style={styles.row}>
              <Field label="Date" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  value={date}
                  onChangeText={setDate}
                />
              </Field>
              <View style={{ width: spacing.md }} />
              <Field label="Time" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.textTertiary}
                  value={time}
                  onChangeText={setTime}
                />
              </Field>
            </View>

            <Field label="Pickup location" required>
              <TextInput
                style={styles.input}
                placeholder="Address or place name"
                placeholderTextColor={colors.textTertiary}
                value={location}
                onChangeText={setLocation}
              />
            </Field>

            <Field label="Drop me to">
              <TextInput
                style={styles.input}
                placeholder="Home"
                placeholderTextColor={colors.textTertiary}
                value={dropTo}
                onChangeText={setDropTo}
              />
            </Field>

            <Field label="Note for Dad">
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Any extra info..."
                placeholderTextColor={colors.textTertiary}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />
            </Field>
          </View>
        )}

        {/* Buy form */}
        {type === 'buy' && (
          <View style={styles.form}>
            <Field label="What do you need?" required>
              <TextInput
                style={styles.input}
                placeholder="e.g. Milo tins, new shoes (size 6)..."
                placeholderTextColor={colors.textTertiary}
                value={item}
                onChangeText={setItem}
              />
            </Field>

            <Field label="When do you need it?">
              <View style={styles.urgencyRow}>
                {URGENCY_OPTIONS.map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.urgencyBtn, urgency === u && styles.urgencyActive]}
                    onPress={() => setUrgency(u)}
                  >
                    <Text style={[styles.urgencyText, urgency === u && styles.urgencyTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            <Field label="Extra details">
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Brand, size, colour..."
                placeholderTextColor={colors.textTertiary}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />
            </Field>
          </View>
        )}

        {/* Other form */}
        {type === 'other' && (
          <View style={styles.form}>
            <Field label="Your request" required>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="What do you need from Dad?"
                placeholderTextColor={colors.textTertiary}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
              />
            </Field>
            <Field label="When?">
              <View style={styles.urgencyRow}>
                {URGENCY_OPTIONS.map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.urgencyBtn, urgency === u && styles.urgencyActive]}
                    onPress={() => setUrgency(u)}
                  >
                    <Text style={[styles.urgencyText, urgency === u && styles.urgencyTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
          </View>
        )}

        <View style={styles.submitRow}>
          <PrimaryButton label="Send to Dad" onPress={handleSubmit} />
          <View style={{ height: spacing.md }} />
          <GhostButton label="Cancel" onPress={() => navigation.goBack()} />
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function Field({ label, children, required, style }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>
        {label}{required ? <Text style={{ color: colors.primary }}> *</Text> : ''}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted, borderRadius: radius.full },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  scroll: { paddingHorizontal: spacing.lg },
  pageTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: 4 },
  pageSubtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  typeRow: { gap: spacing.sm, marginBottom: spacing.xl },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  typeLabel: { ...typography.body, color: colors.textSecondary },
  typeLabelActive: { color: colors.primaryDark, fontWeight: '600' },
  form: { gap: 0 },
  field: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    fontSize: 15, color: colors.textPrimary,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  urgencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  urgencyBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  urgencyActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  urgencyText: { fontSize: 13, color: colors.textSecondary },
  urgencyTextActive: { color: colors.primaryDark, fontWeight: '600' },
  submitRow: { marginTop: spacing.xl },
});
