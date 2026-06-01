// src/screens/AddRequestScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, FlatList, StyleSheet, Alert, Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { PrimaryButton, GhostButton, Avatar, ClearableInput } from '../components/UI';

const REQUEST_TYPES = [
  { key: 'pickup', label: 'Pickup / Drop-off', icon: 'car-outline' },
  { key: 'buy', label: 'Buy something', icon: 'bag-outline' },
  { key: 'other', label: 'Other request', icon: 'chatbubble-outline' },
];

const URGENCY_OPTIONS = ['Today', 'This weekend', 'This week', 'No rush'];

const VALID_TYPES = new Set(REQUEST_TYPES.map(t => t.key));

export default function AddRequestScreen({ navigation, route }) {
  const { currentUser, addRequest, favouritePlaces, addFavouritePlace, removeFavouritePlace } = useApp();
  const [type, setType] = useState(() => {
    const dt = route?.params?.defaultType;
    if (!dt) return 'pickup';
    // 'meal' and any other unknown types open as 'other' (closest match)
    return VALID_TYPES.has(dt) ? dt : 'other';
  });

  // Pickup fields
  const [activity, setActivity] = useState('');
  const [dateObj, setDateObj] = useState(new Date());
  const [timeObj, setTimeObj] = useState(() => { const d = new Date(); d.setHours(15, 0, 0, 0); return d; });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [location, setLocation] = useState('');
  const [dropTo, setDropTo] = useState('Home');
  const [note, setNote] = useState('');
  const [showMore, setShowMore] = useState(false);

  // Derived strings used in the request payload and display
  const dateStr = (() => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();
  const timeStr = `${String(timeObj.getHours()).padStart(2, '0')}:${String(timeObj.getMinutes()).padStart(2, '0')}`;
  const displayDate = dateObj.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const displayTime = timeObj.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Buy fields
  const [item, setItem] = useState('');
  const [urgency, setUrgency] = useState('This week');

  // Other fields
  const [message, setMessage] = useState('');

  function handleSubmit() {
    if (type === 'pickup') {
      if (!location.trim()) {
        Alert.alert('Missing info', 'Please choose a pickup location.');
        return;
      }
      addRequest({
        type: 'pickup',
        fromId: currentUser.id,
        fromName: currentUser.name,
        colorIndex: currentUser.colorIndex,
        activity: activity.trim() || 'Pickup',
        date: dateStr,
        time: timeStr,
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
            {/* ── Required: When ── */}
            <Field label="When">
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.input, styles.pickerBtn, { flex: 1 }]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={15} color={colors.textTertiary} />
                  <Text style={styles.pickerText}>{displayDate}</Text>
                </TouchableOpacity>
                <View style={{ width: spacing.sm }} />
                <TouchableOpacity
                  style={[styles.input, styles.pickerBtn, { width: 100 }]}
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={15} color={colors.textTertiary} />
                  <Text style={styles.pickerText}>{displayTime}</Text>
                </TouchableOpacity>
              </View>
            </Field>

            {showDatePicker && (
              <DateTimePicker
                value={dateObj}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, selected) => {
                  setShowDatePicker(false);
                  if (event.type !== 'dismissed' && selected) setDateObj(selected);
                }}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={timeObj}
                mode="time"
                is24Hour
                display="default"
                onChange={(event, selected) => {
                  setShowTimePicker(false);
                  if (event.type !== 'dismissed' && selected) setTimeObj(selected);
                }}
              />
            )}

            {/* ── Required: Where ── */}
            <Field label="Where">
              <FormInput
                value={location}
                onChangeText={setLocation}
                placeholder="Address or place name"
                onSave={() => addFavouritePlace(location)}
                isSaved={favouritePlaces.includes(location.trim())}
              />
              <FavChips
                places={favouritePlaces}
                onSelect={setLocation}
                currentValue={location}
                onRemove={removeFavouritePlace}
              />
            </Field>

            {/* ── Optional details ── */}
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => setShowMore(p => !p)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showMore ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.info}
              />
              <Text style={styles.moreBtnText}>
                {showMore ? 'Less details' : 'More details +'}
              </Text>
            </TouchableOpacity>

            {showMore && (
              <>
                <Field label="Activity / Class name">
                  <FormInput
                    value={activity}
                    onChangeText={setActivity}
                    placeholder="e.g. Maths tuition, Swimming… (defaults to Pickup)"
                  />
                </Field>
                <Field label="Drop me to">
                  <FormInput
                    value={dropTo}
                    onChangeText={setDropTo}
                    placeholder="Home"
                    onSave={() => addFavouritePlace(dropTo)}
                    isSaved={favouritePlaces.includes(dropTo.trim())}
                  />
                  <FavChips
                    places={favouritePlaces}
                    onSelect={setDropTo}
                    currentValue={dropTo}
                    onRemove={removeFavouritePlace}
                  />
                </Field>
                <Field label="Note for Dad">
                  <FormInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Any extra info..."
                    multiline
                    numberOfLines={3}
                  />
                </Field>
              </>
            )}
          </View>
        )}

        {/* Buy form */}
        {type === 'buy' && (
          <View style={styles.form}>
            <Field label="What do you need?" required>
              <FormInput
                value={item}
                onChangeText={setItem}
                placeholder="e.g. Milo tins, new shoes (size 6)..."
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
          </View>
        )}

        {/* Other form */}
        {type === 'other' && (
          <View style={styles.form}>
            <Field label="Your request" required>
              <FormInput
                value={message}
                onChangeText={setMessage}
                placeholder="What do you need from Dad?"
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

// Thin wrapper that applies screen-specific input defaults to the shared ClearableInput.
function FormInput({ multiline, ...props }) {
  return (
    <ClearableInput
      style={multiline ? [styles.input, styles.textarea] : styles.input}
      placeholderTextColor={colors.textTertiary}
      multiline={multiline}
      {...props}
    />
  );
}

// Horizontal scrollable row of saved favourite place chips.
function FavChips({ places, onSelect, currentValue, onRemove }) {
  if (!places || places.length === 0) return null;
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={places}
      keyExtractor={item => item}
      contentContainerStyle={styles.chipRow}
      style={styles.chipScroll}
      renderItem={({ item: place }) => {
        const active = currentValue.trim() === place;
        return (
          <TouchableOpacity
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(place)}
            onLongPress={() =>
              Alert.alert('Remove favourite', `Remove "${place}" from favourites?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => onRemove(place) },
              ])
            }
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{place}</Text>
          </TouchableOpacity>
        );
      }}
    />
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
  chipScroll: { marginTop: spacing.sm },
  chipRow: { gap: spacing.sm, paddingBottom: 2 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.primaryDark, fontWeight: '600' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pickerText: { fontSize: 14, color: colors.textPrimary, flex: 1 },
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
  moreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: spacing.lg,
  },
  moreBtnText: { ...typography.bodySmall, color: colors.info, fontWeight: '600' },
});
